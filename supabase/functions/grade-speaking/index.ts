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
// to put a band on: it returned exactly one strength and one or two errors for
// every answer regardless of what was said, and passed a two-minute answer that
// never addressed its question as "on topic". Grading is the product here; the
// difference in cost is a fraction of a cent per attempt. Override per
// environment with GEMINI_MODEL.
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash'
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
const GEMINI_TIMEOUT_MS = 150_000

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

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

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
  // the student twice or re-run the model.
  const { data: existing } = await admin
    .from('speaking_attempts')
    .select(
      'id, user_id, status, result, raw_score, rating, band, test_id, test_title, scope, part_type, audio_manifest, grading_started_at, grading_runs, created_at',
    )
    .eq('id', attemptId)
    .maybeSingle()
  if (existing && existing.user_id !== user.id) return json({ error: 'Not found' }, 404)
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
      const graded = await gradeWithGemini(admin, apiKey, ordered)
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

FIRST, "profile" — ONE judgement of how well THIS STUDENT speaks, covering the
whole attempt. Not one per task. The same student must not come out A2 on an
easy question and B1 on a hard one: you are rating the speaker, never the
difficulty of what they were asked. Give the CEFR level
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
  each with the exact words from their transcript that answer it. This is the
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
- Write every comment in simple English; the students are Uzbek learners.
- "fixFirst" is the single most valuable thing to work on next, in one sentence.`
}

/** Download the clips and ask Gemini once. */
async function gradeWithGemini(
  admin: Client,
  apiKey: string,
  answers: AnswerIn[],
): Promise<GeminiOut> {
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

  const parts: unknown[] = [{ text: buildPrompt(answers) }, ...clips.filter(Boolean)]

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
      // Scoring against a fixed rubric needs no deliberation, and thinking
      // tokens are billed as output.
      thinkingConfig: { thinkingLevel: 'low' },
      // A ceiling on the reply. Eight transcripts plus feedback land well under
      // this; anything approaching it is the model looping, and an uncapped loop
      // returns JSON cut off mid-object, which reads to the student as a failed
      // check they then pay to retry.
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  })

  const payload = await callGemini(apiKey, body)

  const candidate = payload?.candidates?.[0]
  const text = candidate?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no content')
  // MAX_TOKENS means the JSON is truncated. Say so plainly instead of letting
  // JSON.parse fail with something meaningless.
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`The check was cut short (${candidate.finishReason})`)
  }
  return JSON.parse(text) as GeminiOut
}

/**
 * One Gemini call, with a deadline and a single retry.
 *
 * Without the deadline a hung connection ran until the platform killed the
 * function, leaving the attempt stuck on 'grading' until the hourly sweep
 * noticed. The retry covers the transient half of Gemini's failures (429, 5xx,
 * dropped socket); a 400 is our bug and is not worth paying for twice.
 */
// deno-lint-ignore no-explicit-any
async function callGemini(apiKey: string, body: string): Promise<any> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      })
      if (res.ok) return await res.json()

      const detail = (await res.text()).slice(0, 200)
      const transient = res.status === 429 || res.status >= 500
      if (!transient || attempt === 1) throw new Error(`Gemini ${res.status}: ${detail}`)
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      if (attempt === 1) {
        throw aborted ? new Error('The check timed out. Please try again.') : e
      }
    } finally {
      clearTimeout(timer)
    }
    // A short pause before the second try; an overloaded model needs a moment.
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('Gemini could not be reached')
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

  // The transcripts, to check the model's "they answered it" quotes against.
  const transcriptFor = (questionIndex: number) =>
    (out.answers?.find((a) => a.questionIndex === questionIndex)?.transcript ?? '').toLowerCase()

  const profile = out.profile?.criteria ?? null

  const blocks = BLOCKS.filter((b) => present.includes(b.key)).map((b) => {
    const judged = out.blocks?.find((x) => x.block === b.key)

    // A question counts as answered only if the quote offered as proof is
    // REALLY IN what the student said. Without this the quote requirement is
    // just a prompt instruction, and prompt instructions get ignored under load.
    const verified = (judged?.onTopic ?? []).filter((t) => {
      const quote = (t?.quote ?? '').trim().toLowerCase()
      if (quote.length < 3) return false
      const said = transcriptFor(Number(t.questionIndex))
      return said.length > 0 && said.includes(quote)
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
