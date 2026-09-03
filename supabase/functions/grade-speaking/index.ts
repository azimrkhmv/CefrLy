// grade-speaking: score a finished speaking attempt with Gemini and throw the
// audio away.
//
// The browser uploads each answer to the private `speaking-temp` bucket and
// calls this once. We read the clips, send them in ONE model call together with
// the official rubric, store the transcript + feedback, and delete the audio.
// Nothing about a student's voice is kept.
//
// ONE CALL, NOT ONE PER ANSWER — that is forced by the rubric, not chosen for
// cost: a block score depends on how many of its three answers are on topic, so
// the answers of a block have to be judged together.
//
// The Gemini key lives ONLY in this function's secrets. It is never sent to the
// browser, and the browser can never call Gemini directly.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'
import { effectivePlan, hasPremiumAccess, monthStartUTC, PLAN_LIMITS, type PlanId } from './plans.ts'
import {
  BLOCKS,
  bandForRating,
  blockForPart,
  estimateRatingFromBlock,
  estimateRatingFromProfile,
  MAX_RAW,
  ratingForRaw,
  RUBRIC_TEXT,
  scoreBlock,
  type BlockJudgement,
  type BlockKey,
  type SpeakingProfile,
} from './rubric.ts'

const BUCKET = 'speaking-temp'
// FLASH, NOT FLASH-LITE. On the cheap tier the marking was not reliable enough
// to put a band on: it returned a fixed quota of errors and strengths for every
// answer regardless of what was said, passed unanswered questions as "on
// topic", and its B1-vs-B2 calls flipped students' bands at the boundary.
// Grading is the product here; the cost difference is a fraction of a cent.
//
// The env override is honoured EXCEPT for retired models: a stale
// GEMINI_MODEL=gemini-3.1-flash-lite secret silently undid this upgrade once —
// the first attempt through the "new" grader came back marked by the old model.
// gemini-3.1-flash itself was later retired by Google (404 from generateContent,
// 2026-09-01), so it is on the blocklist too. Secrets cannot be edited from this
// environment, so the guard lives here.
const RETIRED_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.1-flash']
const envModel = Deno.env.get('GEMINI_MODEL')
const MODEL = envModel && !RETIRED_MODELS.includes(envModel) ? envModel : 'gemini-3.7-flash'
/** A run still unfinished after this long is assumed dead, and may be retried.
 *  Anything younger is treated as in flight — see the double-grade guard. */
const RUN_STALE_MS = 5 * 60 * 1000
/** Rate limits. A FAILED grade deliberately costs the student no allowance, so
 *  without these a retry loop could burn tokens without limit. Staff bypass. */
const MAX_RUNS_PER_ATTEMPT = 5
const MAX_ATTEMPTS_PER_HOUR = 10
/** Ceilings on the model call itself. Without a cap a runaway generation comes
 *  back truncated, JSON.parse throws, and the retry pays full price again. */
const MAX_OUTPUT_TOKENS = 8192
/** One block's share of that ceiling. Each call now writes three transcripts at
 *  most, so the old whole-paper budget would only ever hide a runaway. */
const BLOCK_OUTPUT_TOKENS = 4096
/** Per-TRY ceiling, deliberately impatient. At 95s one hanging primary model
 *  consumed the whole runway: every block waited the full 95s, the fallback
 *  models got scraps, and OpenRouter never got a turn (run 7, 2026-09-02).
 *  A model that hasn't answered in 40s is not about to; move down the ladder —
 *  the healthy lanes answer in 7-25s. */
const GEMINI_TIMEOUT_MS = 40_000
/** Time callGemini must LEAVE for the OpenRouter fallback after it. The ladder
 *  is worthless if the direct lane is allowed to spend the reserve too. */
const OR_RESERVE_MS = 40_000

interface AnswerIn {
  questionIndex: number
  partType: string
  questionText: string
  durationSec: number
  /** Object path inside the bucket, written by the browser. Absent when the
   *  student never recorded this question. */
  path?: string
  mimeType?: string
  /** No recording. Sent anyway, so the rubric can see the question went
   *  unanswered instead of judging a short block as a complete one. */
  missing?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // OPS RESCUE PATH (2026-09-02): a matching x-rescue-secret header may regrade
  // an EXISTING attempt on its owner's behalf — used to restart checks server-
  // side during the Gemini outage instead of asking a student to press retry.
  // It can only re-run an attempt that already exists, as its real owner, and
  // the secret lives only in this function's env. Requires verify_jwt off, so
  // ordinary requests are authenticated by getUser() below exactly as before.
  const rescueSecret = Deno.env.get('RESCUE_SECRET')
  const isRescue = !!rescueSecret && req.headers.get('x-rescue-secret') === rescueSecret

  let user: { id: string } | null = null
  if (!isRescue) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data } = await userClient.auth.getUser()
    if (!data.user) return json({ error: 'Unauthorized' }, 401)
    user = { id: data.user.id }
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'Grading is not configured yet.', code: 'no_grader' }, 503)

  let body: {
    attemptId?: string
    testId?: string
    testTitle?: string
    scope?: 'full' | 'part'
    partType?: string | null
    answers?: AnswerIn[]
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const attemptId = body.attemptId
  if (!attemptId) return json({ error: 'attemptId is required' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Fetched before the plan gate: the rescue path grades as the attempt's real
  // owner, so the owner has to be known before their plan can be checked.
  const { data: existing } = await admin
    .from('speaking_attempts')
    .select(
      'id, user_id, status, result, raw_score, rating, band, test_id, test_title, scope, part_type, audio_manifest, grading_started_at, grading_runs, created_at',
    )
    .eq('id', attemptId)
    .maybeSingle()
  if (isRescue) {
    if (!existing) return json({ error: 'Not found' }, 404)
    user = { id: existing.user_id }
  }
  if (!user) return json({ error: 'Unauthorized' }, 401)
  if (existing && existing.user_id !== user.id) return json({ error: 'Not found' }, 404)

  // --- Plan gate. Runs BEFORE any download or model call, so a free-plan user
  // never costs a token. -----------------------------------------------------
  const { data: profile } = await admin
    .from('profiles')
    .select('role, plan, plan_expires_at')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role ?? 'student'
  const isStaff = role === 'admin' || role === 'super_admin'
  const plan: PlanId = isStaff
    ? 'premium'
    : effectivePlan((profile?.plan ?? 'free') as PlanId, profile?.plan_expires_at ?? null)

  if (!isStaff && !hasPremiumAccess(plan)) {
    return json(
      {
        error: 'AI speaking checks are part of Pro and Premium.',
        code: 'premium_only',
        action: 'speaking_check',
        plan,
      },
      403,
    )
  }

  // An attempt already graded is returned as-is: calling twice must not charge
  // the student twice or re-run the model. (Row fetched above, pre-plan-gate.)
  if (existing?.status === 'done') return json({ attemptId, ...existing }, 200)

  // DOUBLE-GRADE GUARD. An attempt already being graded is left alone: the page
  // polls until the row turns 'done', so a second call has nothing to add and
  // everything to break — it would pay Gemini twice for one exam, and whichever
  // run finished first would delete the clips the other was still reading.
  // A run older than RUN_STALE_MS is assumed dead (the function was killed
  // mid-call) and may be started again.
  if (existing?.status === 'grading') {
    const startedAt = Date.parse(existing.grading_started_at ?? existing.created_at ?? '')
    if (Number.isFinite(startedAt) && Date.now() - startedAt < RUN_STALE_MS) {
      return json({ attemptId, status: 'grading' }, 202)
    }
  }

  // Rate limits. Two shapes of abuse, two cheap checks: retrying ONE attempt
  // forever, and starting endless new ones.
  const runsSoFar = (existing?.grading_runs ?? 0) as number
  if (!isStaff && runsSoFar >= MAX_RUNS_PER_ATTEMPT) {
    return json(
      { error: 'This attempt has been checked too many times. Please record it again.' },
      429,
    )
  }
  if (!isStaff && !existing) {
    const { count: startedThisHour } = await admin
      .from('speaking_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    if ((startedThisHour ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
      return json({ error: 'Too many checks in the last hour. Please try again later.' }, 429)
    }
  }

  // A RETRY sends nothing but the id: the clips are still in the bucket and the
  // manifest on the row says which question each one answers. That is the whole
  // point of storing it — otherwise closing the tab stranded recoverable audio.
  const answers = ((body.answers?.length ? body.answers : existing?.audio_manifest) ?? [])
    .filter((a: AnswerIn) => a && (a.path || a.missing))
  const testId = body.testId ?? existing?.test_id
  const testTitle = body.testTitle ?? existing?.test_title
  if (!testId || !testTitle) return json({ error: 'This attempt cannot be graded again.' }, 400)
  if (answers.length === 0) return json({ error: 'No answers to grade' }, 400)

  // The paths come from the browser, and this function reads AND DELETES them
  // with the service_role key — which ignores the storage policy that pins a
  // student to their own folder. Without this check, passing someone else's
  // "<their id>/<attempt>/0.webm" would transcribe their recording into this
  // result and then delete it. Every clip must live under the caller's folder.
  const ownPrefix = `${user.id}/`
  const foreign = answers.find(
    (a: AnswerIn) =>
      !a.missing &&
      (typeof a.path !== 'string' || !a.path.startsWith(ownPrefix) || a.path.includes('..')),
  )
  if (foreign) return json({ error: 'Invalid recording path' }, 400)
  if (!answers.some((a: AnswerIn) => a.path)) return json({ error: 'No answers to grade' }, 400)

  const limit = isStaff ? null : PLAN_LIMITS[plan].speaking_check
  if (limit !== null) {
    // Only completed checks count. A failed grade cost the student nothing, so
    // it must not eat an allowance either.
    const { count } = await admin
      .from('speaking_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'done')
      .gte('created_at', monthStartUTC())
    const used = count ?? 0
    if (used >= limit) {
      return json(
        {
          error: 'Monthly speaking checks used up.',
          code: 'plan_limit',
          action: 'speaking_check',
          plan,
          limit,
          used,
        },
        403,
      )
    }
  }

  const rawScope = body.scope ?? existing?.scope
  const scope = rawScope === 'part' ? 'part' : 'full'
  const partType = scope === 'part' ? (body.partType ?? existing?.part_type ?? null) : null

  await admin.from('speaking_attempts').upsert({
    id: attemptId,
    user_id: user.id,
    test_id: testId,
    test_title: testTitle,
    scope,
    part_type: partType,
    status: 'grading',
    error_message: null,
    // Written BEFORE the model call so a failure leaves enough behind to retry.
    audio_manifest: answers,
    // Stamped here, not after grading: the guard above reads it to tell an
    // in-flight run from a dead one.
    grading_started_at: new Date().toISOString(),
    grading_runs: runsSoFar + 1,
  })

  const ordered = [...answers].sort((a, b) => a.questionIndex - b.questionIndex)

  // GRADING RUNS IN THE BACKGROUND. The student used to hold this request open
  // for the whole download + model call, watching a spinner, with the wall-clock
  // limit as a hard deadline. The analyze page already polls while the row says
  // 'grading', so answering 202 straight away puts them on their own results
  // page immediately and takes the timeout off the table.
  const work = (async () => {
    try {
      // ONE CLOCK FOR THE WHOLE RUN, anchored at the request, not per call.
      // Each model call carrying its own fresh budget was the failure: the four
      // block calls finished at ~100s of the platform's 150s, and the profile
      // call then started with a full budget of its own on a 50s runway — the
      // platform killed the process mid-call and the attempt froze on
      // 'grading'. Everything downstream spends from THIS deadline, and the
      // profile pass falls back to arithmetic when too little of it is left.
      const deadline = Date.now() + 135_000
      const graded = await gradeWithGemini(admin, apiKey, ordered, deadline)
      const summary = score(ordered, graded, scope)

      await admin
        .from('speaking_attempts')
        .update({
          status: 'done',
          raw_score: summary.rawScore,
          rating: summary.rating,
          // Drills store NULL: an estimate from one block is not a CEFR band and
          // must never reach the dashboard's trend or best-band tiles.
          band: scope === 'full' ? summary.band : null,
          result: summary.result,
          graded_at: new Date().toISOString(),
          error_message: null,
          // The clips are about to be deleted; the manifest points at nothing now.
          audio_manifest: null,
        })
        .eq('id', attemptId)

      // Grading succeeded — the audio has served its only purpose.
      await deleteClips(admin, ordered.map((a) => a.path))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await admin
        .from('speaking_attempts')
        .update({ status: 'failed', error_message: message.slice(0, 500) })
        .eq('id', attemptId)
      // Clips are deliberately KEPT on failure so a retry is possible; the
      // hourly sweep removes them if the student never comes back.
    }
  })()

  // Abandoned clips are the hourly sweep-speaking-audio job's business, NOT
  // this request's — walking the whole bucket used to be added to the student's
  // wait for no reason.
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
    .EdgeRuntime
  if (runtime?.waitUntil) {
    runtime.waitUntil(work)
  } else {
    // Local `deno serve` has no EdgeRuntime; fall back to the old behaviour so
    // development still works, just without the early answer.
    await work
  }

  return json({ attemptId, status: 'grading' }, 202)
})

// deno-lint-ignore no-explicit-any
type Client = any

/** Per-answer feedback as the model returns it. */
interface AnswerOut {
  questionIndex: number
  transcript: string
  wordsPerMinute: number
  fillerCount: number
  pronunciation: string
  fluency: string
  errors: { quote: string; type: string; fix: string }[]
  strengths: { quote: string; why: string }[]
  improved: string
}

/** What the model reports for one block: WHICH questions were answered, each
 *  with the words that answer them. A count alone let a two-minute answer that
 *  never named a decision pass as "on topic, 1 of 1". */
interface BlockOut {
  block: string
  onTopic: { questionIndex: number; quote: string }[]
  coverage: 'full' | 'partial'
  balanced: boolean
  reason: string
}

interface GeminiOut {
  answers: AnswerOut[]
  profile: SpeakingProfile
  blocks: BlockOut[]
  summary: string
  fixFirst: string
}

const LEVELS = ['below_A2', 'A2', 'B1', 'B2', 'C1']

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionIndex: { type: 'integer' },
          transcript: { type: 'string' },
          wordsPerMinute: { type: 'integer' },
          fillerCount: { type: 'integer' },
          pronunciation: { type: 'string' },
          fluency: { type: 'string' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                quote: { type: 'string' },
                type: {
                  type: 'string',
                  enum: ['grammar', 'vocabulary', 'word_order', 'register', 'coherence'],
                },
                fix: { type: 'string' },
              },
              required: ['quote', 'type', 'fix'],
              propertyOrdering: ['quote', 'type', 'fix'],
            },
          },
          strengths: {
            type: 'array',
            items: {
              type: 'object',
              properties: { quote: { type: 'string' }, why: { type: 'string' } },
              required: ['quote', 'why'],
              propertyOrdering: ['quote', 'why'],
            },
          },
          improved: { type: 'string' },
        },
        required: [
          'questionIndex',
          'transcript',
          'wordsPerMinute',
          'fillerCount',
          'pronunciation',
          'fluency',
          'errors',
          'strengths',
          'improved',
        ],
        propertyOrdering: [
          'questionIndex',
          'transcript',
          'wordsPerMinute',
          'fillerCount',
          'pronunciation',
          'fluency',
          'errors',
          'strengths',
          'improved',
        ],
      },
    },
    // ONE profile for the whole attempt. Judged per block, the same speaker came
    // out A2 in Part 1 and B1 in Part 2 of one sitting — see rubric.ts.
    profile: {
      type: 'object',
      properties: {
        criteria: {
          type: 'object',
          properties: {
            grammar: { type: 'string', enum: LEVELS },
            vocabulary: { type: 'string', enum: LEVELS },
            pronunciation: { type: 'string', enum: LEVELS },
            fluency: { type: 'string', enum: LEVELS },
            coherence: { type: 'string', enum: LEVELS },
          },
          required: ['grammar', 'vocabulary', 'pronunciation', 'fluency', 'coherence'],
          propertyOrdering: ['grammar', 'vocabulary', 'pronunciation', 'fluency', 'coherence'],
        },
        evidence: { type: 'string' },
      },
      required: ['criteria', 'evidence'],
      propertyOrdering: ['criteria', 'evidence'],
    },
    // NO SCORE HERE, DELIBERATELY. The model reports what it heard and we do the
    // arithmetic (scoreBlock in rubric.ts). Asking for the number invited a top
    // mark handed out over the model's own list of grammar errors.
    //
    // "onTopic" is a LIST WITH QUOTES, not a count: an answer that talked around
    // the question for two minutes without ever answering it used to be counted
    // as answered, because counting is cheap and quoting is not.
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          block: { type: 'string', enum: ['q1_3', 'q4_6', 'q7', 'q8'] },
          onTopic: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                questionIndex: { type: 'integer' },
                quote: { type: 'string' },
              },
              required: ['questionIndex', 'quote'],
              propertyOrdering: ['questionIndex', 'quote'],
            },
          },
          coverage: { type: 'string', enum: ['full', 'partial'] },
          balanced: { type: 'boolean' },
          reason: { type: 'string' },
        },
        // coverage and balanced are REQUIRED now. Left optional, the model simply
        // omitted them, and the long turns lost the only thing that separates a
        // full answer from half of one.
        required: ['block', 'onTopic', 'coverage', 'balanced', 'reason'],
        propertyOrdering: ['block', 'onTopic', 'coverage', 'balanced', 'reason'],
      },
    },
    summary: { type: 'string' },
    fixFirst: { type: 'string' },
  },
  // Order matters: the transcripts are produced FIRST, then the profile is
  // judged from them, then each block is checked against that profile. Asking
  // for the judgement before the evidence exists invites a guess.
  required: ['answers', 'profile', 'blocks', 'summary', 'fixFirst'],
  propertyOrdering: ['answers', 'profile', 'blocks', 'summary', 'fixFirst'],
}

function buildPrompt(answers: AnswerIn[]): string {
  const blocksPresent = [...new Set(answers.map((a) => blockForPart(a.partType)))]
  // Recordings are numbered over the ANSWERED questions only, because that
  // is the order they are attached in. Unanswered ones are listed in place
  // with no recording, so the model sees the gap instead of a shorter paper.
  let recordingNo = 0
  const list = answers
    .map((a) =>
      a.missing || !a.path
        ? `questionIndex ${a.questionIndex}, ${blockForPart(a.partType)} — NO ANSWER RECORDED\n` +
          `Question: ${a.questionText}`
        : `Recording ${++recordingNo} — questionIndex ${a.questionIndex}, ` +
          `${blockForPart(a.partType)}, ${Math.round(a.durationSec)}s\n` +
          `Question: ${a.questionText}`,
    )
    .join('\n\n')

  return `You are an examiner for the Uzbek Multilevel (CEFR) English speaking exam.
You are given the student's recorded answers, in order. Judge them against the
official rubric below and return JSON only.

${RUBRIC_TEXT}

YOU DO NOT AWARD MARKS. The mark is calculated from your judgement, so judge
accurately and let the arithmetic happen elsewhere.

You are given ONE task of a longer paper. Judge only what is here; another pass
puts the whole sitting together afterwards.

FIRST, "profile" — ONE judgement of how well THIS STUDENT speaks, from what you
can hear in these recordings. Not one per question. You are rating the speaker,
never the difficulty of what they were asked. Give the CEFR level
(below_A2 | A2 | B1 | B2 | C1) for each of:
  · grammar — B1 means simple structures are right but complex ones break down;
    B2 means complex structures are attempted and mostly work; C1 means a range
    of them is used accurately with only slips. Errors in BASIC agreement
    ("he love", "picture show") are A2 or below, whatever else is present.
  · vocabulary — B1 is enough for the topic with visible wrong choices; B2 covers
    the topic with occasional imprecision; C1 is precise and varied.
  · pronunciation — B1 is intelligible but mispronunciation sometimes obscures
    meaning; B2 rarely obscures it; C1 is clear throughout.
  · fluency — weigh the pauses, repetition and self-correction you can hear.
    Speech that repeats a word or phrase to fill time is not B2 fluency.
  · coherence — B1 links ideas with simple connectives only; C1 links them well.
Plus "evidence": the actual quotes that put those levels where they are. If your
evidence contradicts a level, change the level.

THEN one entry for each of these blocks — ${blocksPresent.join(', ')} — with:
- "onTopic": the list of that block's questions the student ACTUALLY ANSWERED,
  each with its questionIndex EXACTLY AS PRINTED in the list below (never
  renumber from 0 or 1) and the exact words from their transcript that answer
  it. This is the
  test: if you cannot quote the part of the answer that addresses the question,
  it was NOT answered, and it does not belong in the list. Two minutes of talking
  around a question — repeating it back, or saying it is important — is not an
  answer. Neither is a memorised speech aimed at a different question.
- "coverage": "full" if the response covers everything the task asked for,
  "partial" if it covers it only in part. Required for every block.
- "balanced": for Q8, true only if BOTH sides of the argument are genuinely made;
  a well-spoken one-sided answer is not balanced. Send false for other blocks.
- "reason": one sentence, naming what you heard.

THE RECORDINGS, in the order they are attached:

${list}

Rules:
- Transcribe each recording word for word, including grammatical mistakes. Do
  NOT silently correct the student — the transcript is what they actually said.
- Judge pronunciation and fluency from the AUDIO itself, not from the transcript.
- Every error's "quote" MUST be an exact substring of that answer's transcript,
  so it can be highlighted. Never paraphrase a quote. Same for strengths, which
  are the genuinely good vocabulary or structures the student used — leave the
  list empty rather than inventing one.
- List EVERY error you find, not a fixed number. A weak answer has many; a strong
  one may have none. Returning one error and one strength for every answer
  regardless of what was said is not marking, and it is obvious when it happens.
- "improved" rewrites the student's OWN answer roughly one CEFR level above what
  they produced, keeping their ideas and their length. Do not write a perfect C2
  model answer: it has to be something this student could realistically reach.
- Memorised or off-topic answers do not go in "onTopic".
- If a recording is silent or has no meaningful speech, give an empty transcript
  and leave that question out of "onTopic".
- A question marked NO ANSWER RECORDED was not attempted. Return it in "answers"
  with an empty transcript, and leave it out of "onTopic" — the rubric turns on
  HOW MANY questions were answered on topic, so a block with a missing answer
  cannot reach the top mark.
- Write every comment in simple English; the students are Uzbek learners.`
}

/** The pieces of the full schema, reused by the per-block and profile calls. */
const BLOCK_CALL_SCHEMA = {
  type: 'object',
  properties: {
    answers: RESPONSE_SCHEMA.properties.answers,
    profile: RESPONSE_SCHEMA.properties.profile,
    blocks: RESPONSE_SCHEMA.properties.blocks,
  },
  required: ['answers', 'profile', 'blocks'],
  propertyOrdering: ['answers', 'profile', 'blocks'],
}

const PROFILE_CALL_SCHEMA = {
  type: 'object',
  properties: {
    profile: RESPONSE_SCHEMA.properties.profile,
    summary: { type: 'string' },
    fixFirst: { type: 'string' },
  },
  required: ['profile', 'summary', 'fixFirst'],
  propertyOrdering: ['profile', 'summary', 'fixFirst'],
}

/**
 * ONE CALL PER BLOCK, RUN SIDE BY SIDE — and the whole paper's transcripts are
 * then read back in ONE text-only call that fixes the single profile.
 *
 * The rubric still forbids judging an answer alone (a block's mark depends on
 * how many of ITS questions were answered), and it still forbids judging the
 * same speaker twice (a profile per block made one student A2 in Part 1 and B1
 * in Part 2). A block is the smallest unit that satisfies the first rule, and
 * the profile pass satisfies the second.
 *
 * The reason for splitting is time, and it is not a nicety: eight recordings in
 * one call meant one model response writing eight transcripts plus all the
 * feedback, and the platform kills this function at 150 seconds. Past that the
 * process dies mid-fetch — no error, no 'failed' row, the student watching
 * "checking…" forever. Four smaller responses generated in parallel finish in
 * roughly the time of the longest one.
 */
async function gradeWithGemini(
  admin: Client,
  apiKey: string,
  answers: AnswerIn[],
  deadline: number,
): Promise<GeminiOut> {
  // Grouped in the order the blocks appear, so the merged output stays in paper
  // order without a second sort of anything but the answers.
  const groups = new Map<string, AnswerIn[]>()
  for (const a of answers) {
    const key = blockForPart(a.partType)
    const list = groups.get(key)
    if (list) list.push(a)
    else groups.set(key, [a])
  }

  const parts = await Promise.all(
    [...groups.entries()].map(([key, list]) => gradeBlock(admin, apiKey, key, list, deadline)),
  )

  const mergedAnswers = parts
    .flatMap((p) => p.answers ?? [])
    .sort((a, b) => a.questionIndex - b.questionIndex)
  const mergedBlocks = parts.flatMap((p) => p.blocks ?? [])

  const overall = await judgeSpeaker(apiKey, mergedAnswers, parts, deadline)

  return {
    answers: mergedAnswers,
    blocks: mergedBlocks,
    profile: overall.profile,
    summary: overall.summary,
    fixFirst: overall.fixFirst,
  }
}

/** Grade ONE block: its clips, its questions, its own reading of the speaker. */
async function gradeBlock(
  admin: Client,
  apiKey: string,
  blockKey: string,
  answers: AnswerIn[],
  deadline: number,
): Promise<GeminiOut> {
  // A block nobody recorded costs no call: the paper still has to show the
  // questions as unanswered, which is arithmetic, not judgement.
  if (!answers.some((a) => a.path && !a.missing)) {
    return {
      answers: answers.map((a) => ({
        questionIndex: a.questionIndex,
        transcript: '',
        wordsPerMinute: 0,
        fillerCount: 0,
        pronunciation: '',
        fluency: '',
        errors: [],
        strengths: [],
        improved: '',
      })),
      profile: null as unknown as SpeakingProfile,
      blocks: [
        {
          block: blockKey,
          onTopic: [],
          coverage: 'partial',
          balanced: false,
          reason: 'No answer was recorded for this task.',
        },
      ],
      summary: '',
      fixFirst: '',
    }
  }

  const parts = await promptParts(admin, answers)
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: BLOCK_CALL_SCHEMA,
      temperature: 0,
      thinkingConfig: { thinkingLevel: 'low' },
      maxOutputTokens: BLOCK_OUTPUT_TOKENS,
    },
  })
  // The same request in provider-neutral form, for the OpenRouter fallback.
  // deno-lint-ignore no-explicit-any
  const typed = parts as any[]
  const neutral: NeutralRequest = {
    prompt: typed[0].text,
    clips: typed.slice(1).map((p) => ({
      data: p.inline_data.data,
      format: /mp4|m4a/.test(p.inline_data.mime_type ?? '') ? 'mp4' : 'webm',
    })),
    schema: BLOCK_CALL_SCHEMA,
    maxTokens: BLOCK_OUTPUT_TOKENS,
  }
  // Spend from the run's clock, minus what the profile fallback and the final
  // row update still need after us. Downloads above already ate into it.
  const payload = await callModel(apiKey, body, deadline - Date.now() - 15_000, neutral)
  return payload as GeminiOut
}

/** The prompt plus this block's audio, in the order the prompt numbers them. */
async function promptParts(admin: Client, answers: AnswerIn[]): Promise<unknown[]> {
  // Downloaded together, not one after another: eight clips fetched in series
  // added seconds of pure waiting before the model even saw the first one. The
  // ORDER of the attachments still matters (the prompt numbers them), so the
  // results are mapped back in place rather than pushed as they arrive.
  const clips = await Promise.all(
    answers.map(async (a) => {
      if (a.missing || !a.path) return null // announced in the prompt; no audio to attach
      const { data, error } = await admin.storage.from(BUCKET).download(a.path)
      if (error || !data) throw new Error(`Missing recording for question ${a.questionIndex + 1}`)
      return {
        inline_data: {
          mime_type: a.mimeType || data.type || 'audio/webm',
          data: base64(new Uint8Array(await data.arrayBuffer())),
        },
      }
    }),
  )

  return [{ text: buildPrompt(answers) }, ...clips.filter(Boolean)]
}

/** Call Gemini and hand back the parsed JSON, or throw something a student can
 *  read. Every call in this function goes through here. */
/** Provider-neutral shape of one grading request, so a second provider can
 *  retry it when Google cannot be reached at all. */
interface NeutralRequest {
  prompt: string
  clips: { data: string; format: string }[]
  schema: unknown
  maxTokens: number
}

// deno-lint-ignore no-explicit-any
async function callModel(
  apiKey: string,
  body: string,
  budgetMs?: number,
  neutral?: NeutralRequest,
): Promise<any> {
  const started = Date.now()
  // OPENROUTER_FIRST=1 flips the ladder during a Google-direct incident: the
  // OpenRouter lane answers in seconds while the direct lane hangs for its
  // whole timeout, so leading with it removes a ~40s tax from every check.
  // Unset the secret when Google recovers — the direct lane is cheaper.
  const orKey = Deno.env.get('OPENROUTER_API_KEY')
  const orFirst = Deno.env.get('OPENROUTER_FIRST') === '1'
  let orSpent = false
  if (orFirst && orKey && neutral) {
    orSpent = true
    try {
      return await callOpenRouter(orKey, neutral, Math.max(30_000, (budgetMs ?? 95_000) - 40_000))
    } catch (e) {
      console.log(`openrouter-first failed (${String(e).slice(0, 80)}); trying Gemini direct`)
    }
  }
  try {
    const payload = await callGemini(apiKey, body, budgetMs != null ? budgetMs - (Date.now() - started) : undefined)

    const candidate = payload?.candidates?.[0]
    const text = candidate?.content?.parts?.[0]?.text
    if (!text) throw new Error('Gemini returned no content')
    // MAX_TOKENS means the JSON is truncated. Say so plainly instead of letting
    // JSON.parse fail with something meaningless.
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(`The check was cut short (${candidate.finishReason})`)
    }
    return JSON.parse(text)
  } catch (e) {
    // SECOND PROVIDER, AUTOMATIC. Google's whole ladder failing (all models,
    // all retries — a real outage, 2026-09-02) used to be the end of the road.
    // OpenRouter reaches the same models through separately provisioned
    // capacity, so it regularly answers while the direct lane is jammed.
    // (Skipped when the OpenRouter-first path above already spent its shot.)
    const remaining = budgetMs != null ? budgetMs - (Date.now() - started) : 60_000
    if (orSpent || !orKey || !neutral || remaining < 10_000) throw e
    console.log(`gemini lane exhausted (${String(e).slice(0, 80)}); trying OpenRouter`)
    return await callOpenRouter(orKey, neutral, remaining)
  }
}

/** ChatGPT's audio models reject webm (tested against a real clip, 2026-09-02:
 *  400 from openai/gpt-audio however the format is labelled), so recordings can
 *  only fall back to Gemini via OpenRouter's capacity. Text-only calls have no
 *  such constraint and try ChatGPT first — a different vendor entirely. */
const OR_AUDIO_MODELS = ['google/gemini-3.7-flash', 'google/gemini-3.6-flash', 'google/gemini-2.5-flash']
const OR_TEXT_MODELS = ['openai/gpt-audio', 'google/gemini-3.7-flash', 'google/gemini-2.5-flash']

// deno-lint-ignore no-explicit-any
async function callOpenRouter(orKey: string, req: NeutralRequest, budgetMs: number): Promise<any> {
  const deadline = Date.now() + budgetMs
  const models = req.clips.length ? OR_AUDIO_MODELS : OR_TEXT_MODELS
  let lastError: Error = new Error('The backup grader could not be reached')

  for (const model of models) {
    const remaining = deadline - Date.now()
    if (remaining < 8_000) throw lastError
    const t0 = Date.now()
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${orKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    `${req.prompt}\n\nReturn ONLY a JSON object matching this exact schema, ` +
                    `with no prose around it:\n${JSON.stringify(req.schema)}`,
                },
                ...req.clips.map((c) => ({
                  type: 'input_audio',
                  input_audio: { data: c.data, format: c.format },
                })),
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: req.maxTokens,
        }),
        signal: AbortSignal.timeout(Math.min(95_000, remaining)),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        lastError = new Error(
          `OpenRouter ${model} ${res.status}: ${String(payload?.error?.message ?? '').slice(0, 150)}`,
        )
        console.log(`openrouter fail ${model} ${res.status} in ${Date.now() - t0}ms`)
        continue
      }
      const text = payload?.choices?.[0]?.message?.content
      if (!text) {
        lastError = new Error(`OpenRouter ${model} returned no content`)
        continue
      }
      console.log(`openrouter ok ${model} in ${Date.now() - t0}ms`)
      // Some models wrap JSON in a markdown fence despite instructions.
      return JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''))
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      console.log(`openrouter error ${model} after ${Date.now() - t0}ms: ${String(e).slice(0, 80)}`)
    }
  }
  throw lastError
}

/**
 * ONE judgement of the speaker, over the whole paper.
 *
 * Text only, so it is quick: the transcripts are already written, and the two
 * things that genuinely need ears — pronunciation and fluency — are carried in
 * as the levels each block's own listening produced. If this call fails the
 * grade is NOT lost: the block readings are averaged instead, which is a worse
 * profile but an honest one, and losing the paper is worse than either.
 */
async function judgeSpeaker(
  apiKey: string,
  answers: AnswerOut[],
  parts: GeminiOut[],
  deadline: number,
): Promise<{ profile: SpeakingProfile; summary: string; fixFirst: string }> {
  const heard = parts
    .map((p) => p.profile?.criteria)
    .filter(Boolean) as SpeakingProfile['criteria'][]
  if (heard.length === 0) throw new Error('Gemini returned no judgement of the speaker')

  // This pass is a REFINEMENT, not a requirement — the block judgements already
  // hold a defensible profile. On a slow Gemini day the blocks use most of the
  // run, and starting one more model call on the leftovers is how a finished
  // grade got killed at the platform's wall-clock limit. Too little time left →
  // take the arithmetic fallback and SAVE THE PAPER.
  const remaining = deadline - Date.now() - 10_000
  if (remaining < 15_000) {
    console.log(`judgeSpeaker skipped, ${remaining}ms left`)
    return {
      profile: averageProfile(heard, parts),
      summary: parts.map((p) => p.blocks?.[0]?.reason ?? '').filter(Boolean).join(' '),
      fixFirst: '',
    }
  }

  const transcripts = answers
    .map((a) => `questionIndex ${a.questionIndex}: ${a.transcript || '(nothing said)'}`)
    .join('\n\n')
  const listened = heard
    .map(
      (c, i) =>
        `Task ${i + 1}: pronunciation ${c.pronunciation}, fluency ${c.fluency}, ` +
        `grammar ${c.grammar}, vocabulary ${c.vocabulary}, coherence ${c.coherence}`,
    )
    .join('\n')

  const judgePrompt = `You are an examiner for the Uzbek Multilevel (CEFR) English speaking exam.

${RUBRIC_TEXT}

Below is EVERYTHING one student said in one sitting, task by task, followed by
what the examiner who listened to each task judged.

Give ONE judgement of how well THIS STUDENT speaks — grammar, vocabulary,
pronunciation, fluency, coherence, each as below_A2 | A2 | B1 | B2 | C1 — plus
"evidence": the quotes from these transcripts that put those levels where they
are. You are rating the speaker, never the difficulty of the task: the same
student must not come out A2 on an easy question and B1 on a hard one. Where the
tasks disagree, weigh the longer answers more heavily.

You cannot hear the recordings. For PRONUNCIATION and FLUENCY, take the levels
from the per-task judgements below — those were made with the audio. For
grammar, vocabulary and coherence, judge the transcripts yourself. Errors in
basic agreement ("he love", "picture show") are A2 or below, whatever else is
present.

Then "summary": a few sentences to the student about their speaking overall, and
"fixFirst": the single most valuable thing to work on next, in one sentence.
Write both in simple English; the students are Uzbek learners.

WHAT THEY SAID:

${transcripts}

WHAT EACH TASK'S EXAMINER JUDGED:

${listened}`

  try {
    const out = await callModel(
      apiKey,
      JSON.stringify({
        contents: [{ parts: [{ text: judgePrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: PROFILE_CALL_SCHEMA,
          temperature: 0,
          thinkingConfig: { thinkingLevel: 'low' },
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
      remaining,
      { prompt: judgePrompt, clips: [], schema: PROFILE_CALL_SCHEMA, maxTokens: MAX_OUTPUT_TOKENS },
    )
    if (!out?.profile?.criteria) throw new Error('no profile')
    return {
      profile: out.profile as SpeakingProfile,
      summary: out.summary ?? '',
      fixFirst: out.fixFirst ?? '',
    }
  } catch {
    return {
      profile: averageProfile(heard, parts),
      summary: parts.map((p) => p.blocks?.[0]?.reason ?? '').filter(Boolean).join(' '),
      fixFirst: '',
    }
  }
}

/** Fallback only: the middle of what each task's examiner heard. Rounded DOWN
 *  on a tie, because inventing half a level upwards is a mark we cannot defend. */
function averageProfile(
  heard: SpeakingProfile['criteria'][],
  parts: GeminiOut[],
): SpeakingProfile {
  const dims = ['grammar', 'vocabulary', 'pronunciation', 'fluency', 'coherence'] as const
  const criteria = {} as SpeakingProfile['criteria']
  for (const dim of dims) {
    const ranks = heard
      .map((c) => LEVELS.indexOf(c[dim]))
      .filter((n) => n >= 0)
      .sort((a, b) => a - b)
    const middle = ranks.length ? ranks[Math.floor((ranks.length - 1) / 2)] : 0
    criteria[dim] = LEVELS[middle] as SpeakingProfile['criteria'][typeof dim]
  }
  return {
    criteria,
    evidence: parts.map((p) => p.profile?.evidence ?? '').filter(Boolean).join(' '),
  }
}

/**
 * One Gemini call, with a deadline, backoff, and a drop to an older flash model.
 *
 * Without the deadline a hung connection ran until the platform killed the
 * function, leaving the attempt stuck on 'grading' until the hourly sweep
 * noticed. Retries cover the transient half of Gemini's failures (429, 5xx,
 * dropped socket); a 400 is our bug and is not worth paying for twice.
 *
 * ONE retry 1.5s apart was not enough. The newest flash tier answers 503
 * "high demand" in bursts that outlast a couple of seconds, and every one of
 * those was shown to a student as a failed check. So: three tries per model
 * with growing gaps, then the same again on the previous flash generation,
 * which is rarely busy at the same moment. Marking on 3.6 or 3.5 is worse than
 * on 3.7 but far better than telling a student to record their exam again.
 */
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash']
const TRIES_PER_MODEL = 3
const BACKOFF_MS = [2000, 6000]
/** Whole-call budget. The grade runs in waitUntil, which the platform still
 *  kills at its own wall-clock limit — retrying past this just loses the row.
 *
 *  THE LIMIT IS 150 SECONDS, NOT 240. Set above it, this budget was decoration:
 *  a full mock whose single model call ran long was killed by the platform
 *  mid-fetch, so the catch that writes 'failed' never ran and the attempt sat on
 *  'grading' forever with no error and no retry button (2026-09-02, two real
 *  students' papers). Everything here now has to finish well inside it. */
const TOTAL_BUDGET_MS = 132_000

// deno-lint-ignore no-explicit-any
async function callGemini(apiKey: string, body: string, budgetMs?: number): Promise<any> {
  // Reserve the fallback's share up front (when a fallback exists to reserve
  // for): the direct lane gets the rest, floor 30s so it can still try once.
  const granted = Math.min(budgetMs ?? TOTAL_BUDGET_MS, TOTAL_BUDGET_MS)
  // No reserve when OpenRouter led and already had its turn — the direct lane
  // is the LAST resort then and may spend everything that is left.
  const orWaiting =
    Deno.env.get('OPENROUTER_API_KEY') && Deno.env.get('OPENROUTER_FIRST') !== '1'
  const deadline = Date.now() + Math.max(30_000, granted - (orWaiting ? OR_RESERVE_MS : 0))
  // The fallbacks are only worth trying if they are not the model that just
  // failed, and a retired name must never come back through this door.
  const models = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL && !RETIRED_MODELS.includes(m))]
  let lastError: Error = new Error('Gemini could not be reached')

  for (const model of models) {
    for (let attempt = 0; attempt < TRIES_PER_MODEL; attempt++) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw lastError

      const startedAt = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), Math.min(GEMINI_TIMEOUT_MS, remaining))
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: controller.signal,
          },
        )
        // Logged because there is no other way to see where a run's time went:
        // the model call is the only slow thing here, and when it overruns the
        // platform kills the process before anything can be written down.
        if (res.ok) {
          console.log(`gemini ok ${model} in ${Date.now() - startedAt}ms`)
          return await res.json()
        }

        const detail = (await res.text()).slice(0, 200)
        const err = new Error(`Gemini ${res.status}: ${detail}`)
        // A 4xx that is not a rate limit will not fix itself on a retry: either
        // the body is wrong or this model does not exist. Give up on THIS model
        // and move to the next one rather than sleeping between identical
        // failures — a retired name in the fallback list must cost one call, not
        // three, and must never abort the models still worth trying.
        if (res.status !== 429 && res.status < 500) {
          lastError = err
          break
        }
        lastError = res.status === 503 || res.status === 429
          ? new Error('The AI examiner is busy right now. Please try the check again in a few minutes.')
          : err
      } catch (e) {
        const abort = e instanceof Error && e.name === 'AbortError'
        console.log(
          `gemini ${abort ? 'timeout' : 'error'} ${model} after ${Date.now() - startedAt}ms`,
        )
        lastError = abort
          ? new Error('The check timed out. Please try again.')
          : e instanceof Error
            ? e
            : new Error(String(e))
        // A TIMEOUT IS NOT A BUSY SIGNAL. 503 and 429 pass in a second or two,
        // so they are worth sitting out on the same model; a model that did not
        // answer inside the whole per-call budget will not answer faster on an
        // identical retry. Three of those in a row ate the run before the
        // faster fallbacks were ever reached. Time out once, change model.
        if (abort) break
      } finally {
        clearTimeout(timer)
      }

      const pause = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]
      if (Date.now() + pause >= deadline) throw lastError
      await new Promise((r) => setTimeout(r, pause))
    }
  }
  throw lastError
}

/** Chunked so a long clip cannot blow the argument limit of String.fromCharCode. */
function base64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Turn the model's block scores into the exam's raw / rating / band. */
function score(answers: AnswerIn[], out: GeminiOut, scope: 'full' | 'part') {
  const present = [...new Set(answers.map((a) => blockForPart(a.partType)))]
  const questionsIn = (key: BlockKey) =>
    answers.filter((a) => blockForPart(a.partType) === key).length

  // Case and punctuation must not decide a mark: the model writes the quote and
  // the transcript in the same response, but an apostrophe or a comma rendered
  // differently between the two used to fail the substring check.
  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

  // ALL of a block's transcripts pooled, because the model's onTopic
  // questionIndex is not trustworthy: graded one block per call since the
  // parallel split, it numbers the block's questions relative to the call
  // (0/1) instead of the paper (6/7), so a REAL quote was checked against the
  // WRONG question's transcript and whole blocks of C1 speech scored 0. A
  // quote found anywhere in the block's own speech proves the answer; the
  // index only ever chose which transcript to search, so pooling loses nothing
  // a wrong index hadn't already lost.
  const blockTranscript = (key: BlockKey) =>
    normalize(
      answers
        .filter((a) => blockForPart(a.partType) === key)
        .map((a) => out.answers?.find((x) => x.questionIndex === a.questionIndex)?.transcript ?? '')
        .join('\n'),
    )

  const profile = out.profile?.criteria ?? null

  const blocks = BLOCKS.filter((b) => present.includes(b.key)).map((b) => {
    const judged = out.blocks?.find((x) => x.block === b.key)

    // A question counts as answered only if the quote offered as proof is
    // REALLY IN what the student said. Without this the quote requirement is
    // just a prompt instruction, and prompt instructions get ignored under load.
    // Duplicate quotes count once — one sentence cannot answer three questions.
    const pool = blockTranscript(b.key)
    const seenQuotes = new Set<string>()
    const verified = (judged?.onTopic ?? []).filter((t) => {
      const quote = normalize(t?.quote ?? '')
      if (quote.length < 3 || seenQuotes.has(quote)) return false
      seenQuotes.add(quote)
      if (pool.includes(quote)) return true
      // Logged because a failed verification is silent otherwise: it presents
      // as "off topic" and nobody can tell a lying model from a broken check.
      console.log(`quote verify FAILED ${b.key}: "${(t?.quote ?? '').slice(0, 80)}"`)
      return false
    })
    const questionCount = questionsIn(b.key)

    // The mark is OURS to compute (scoreBlock). No profile means the model
    // returned something unusable — score 0 rather than guess something
    // flattering.
    const judgement: BlockJudgement | null = profile
      ? {
          block: b.key,
          criteria: profile,
          onTopicCount: Math.min(questionCount, verified.length),
          coverage: judged?.coverage === 'partial' ? 'partial' : 'full',
          balanced: judged?.balanced === true,
          reason: judged?.reason ?? '',
        }
      : null
    const score = judgement ? Math.max(0, Math.min(b.max, scoreBlock(judgement))) : 0
    return {
      key: b.key,
      label: b.label,
      max: b.max,
      score,
      reason: judged?.reason ?? '',
      // Stored so the analyze page can SHOW the working.
      criteria: profile ?? undefined,
      onTopicCount: judgement?.onTopicCount,
      questionCount,
      coverage: judgement?.coverage,
      balanced: b.key === 'q8' ? judgement?.balanced : undefined,
    }
  })

  const rawScore = blocks.reduce((n, b) => n + b.score, 0)
  const full = scope === 'full'
  const drill = blocks[0]

  // A FULL PAPER is scored by the official table — raw out of 21, straight to
  // the rating. A DRILL has no such total: one block's mark is bounded by its
  // own task, so its /75 is estimated from HOW THE STUDENT SPOKE (the profile)
  // and then reduced for questions they did not answer. That is the only way a
  // B2 speaker on Part 1.1 lands at B2 instead of being told they are B1.
  const rating = full
    ? ratingForRaw(rawScore)
    : profile && drill
      ? estimateRatingFromProfile(profile, {
          block: drill.key,
          onTopicCount: drill.onTopicCount ?? 0,
          questionCount: drill.questionCount,
          coverage: drill.coverage,
          balanced: drill.balanced,
        })
      : // Older attempts, graded before profiles existed.
        estimateRatingFromBlock(drill?.key as BlockKey, drill?.score ?? 0)
  const band = bandForRating(rating)

  return {
    rawScore,
    maxRaw: full ? MAX_RAW : (blocks[0]?.max ?? 0),
    rating,
    band,
    /** True when `rating`/`band` are scaled from a single block, not earned over
     *  the whole paper — the UI must say so. */
    estimated: !full,
    result: {
      blocks,
      answers: (out.answers ?? []).map((a) => ({
        ...a,
        questionText: answers.find((x) => x.questionIndex === a.questionIndex)?.questionText ?? '',
        durationSec: answers.find((x) => x.questionIndex === a.questionIndex)?.durationSec ?? 0,
      })),
      summary: out.summary ?? '',
      fixFirst: out.fixFirst ?? '',
      // The one language judgement the whole mark rests on, shown to the student
      // with the quotes behind it — so a band is something they can check.
      profile: out.profile?.criteria ? out.profile : undefined,
      // Stored so the page never has to infer the denominator from the blocks
      // it happens to have: skipping a whole part would otherwise turn 12/21
      // into a flattering "12 of 15".
      maxRaw: full ? MAX_RAW : (blocks[0]?.max ?? 0),
      // Where a drill's /75 came from, so the page can say so honestly:
      // 'criteria' = estimated from how the student spoke; 'block' = an older
      // attempt whose estimate was scaled from the block mark.
      estimateBasis: full ? undefined : profile ? 'criteria' : 'block',
      model: MODEL,
    },
  }
}

async function deleteClips(admin: Client, paths: string[]) {
  if (paths.length === 0) return
  await admin.storage.from(BUCKET).remove(paths)
}
