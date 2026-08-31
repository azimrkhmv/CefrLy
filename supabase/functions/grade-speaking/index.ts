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
  MAX_RAW,
  ratingForRaw,
  RUBRIC_TEXT,
  type BlockKey,
} from './rubric.ts'

const BUCKET = 'speaking-temp'
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite'
/** Clips left behind by an abandoned attempt are swept after this long. */
const ORPHAN_MS = 60 * 60 * 1000

interface AnswerIn {
  questionIndex: number
  partType: string
  questionText: string
  durationSec: number
  /** Object path inside the bucket, written by the browser. */
  path: string
  mimeType?: string
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
      'id, user_id, status, result, raw_score, rating, band, test_id, test_title, scope, part_type, audio_manifest',
    )
    .eq('id', attemptId)
    .maybeSingle()
  if (existing && existing.user_id !== user.id) return json({ error: 'Not found' }, 404)
  if (existing?.status === 'done') return json({ attemptId, ...existing }, 200)

  // A RETRY sends nothing but the id: the clips are still in the bucket and the
  // manifest on the row says which question each one answers. That is the whole
  // point of storing it — otherwise closing the tab stranded recoverable audio.
  const answers = ((body.answers?.length ? body.answers : existing?.audio_manifest) ?? [])
    .filter((a: AnswerIn) => a && a.path)
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
    (a: AnswerIn) => typeof a.path !== 'string' || !a.path.startsWith(ownPrefix) || a.path.includes('..'),
  )
  if (foreign) return json({ error: 'Invalid recording path' }, 400)

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
  })

  const ordered = [...answers].sort((a, b) => a.questionIndex - b.questionIndex)

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
    await sweepOrphans(admin, user.id)

    return json({ attemptId, status: 'done', ...summary }, 200)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await admin
      .from('speaking_attempts')
      .update({ status: 'failed', error_message: message.slice(0, 500) })
      .eq('id', attemptId)
    // Clips are deliberately KEPT on failure so a retry is possible; the sweep
    // removes them within the hour if the student never comes back.
    return json({ error: 'Grading failed. You can try again.', code: 'grading_failed' }, 502)
  }
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

interface GeminiOut {
  answers: AnswerOut[]
  blocks: { block: string; score: number; reason: string }[]
  summary: string
  fixFirst: string
}

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
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          block: { type: 'string', enum: ['q1_3', 'q4_6', 'q7', 'q8'] },
          score: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['block', 'score', 'reason'],
        propertyOrdering: ['block', 'score', 'reason'],
      },
    },
    summary: { type: 'string' },
    fixFirst: { type: 'string' },
  },
  required: ['answers', 'blocks', 'summary', 'fixFirst'],
  propertyOrdering: ['answers', 'blocks', 'summary', 'fixFirst'],
}

function buildPrompt(answers: AnswerIn[]): string {
  const blocksPresent = [...new Set(answers.map((a) => blockForPart(a.partType)))]
  const list = answers
    .map(
      (a, i) =>
        `Recording ${i + 1} — questionIndex ${a.questionIndex}, ${blockForPart(a.partType)}, ` +
        `${Math.round(a.durationSec)}s\nQuestion: ${a.questionText}`,
    )
    .join('\n\n')

  return `You are an examiner for the Uzbek Multilevel (CEFR) English speaking exam.
You are given the student's recorded answers, in order. Grade them against the
official rubric below and return JSON only.

${RUBRIC_TEXT}

Score ONLY these blocks: ${blocksPresent.join(', ')}. Give exactly one score per block.

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
- "improved" rewrites the student's OWN answer roughly one CEFR level above what
  they produced, keeping their ideas and their length. Do not write a perfect C2
  model answer: it has to be something this student could realistically reach.
- Score memorised or off-topic answers 0, as the rubric requires.
- If a recording is silent or has no meaningful speech, give an empty transcript
  and reflect it in the block score.
- Write every comment in simple English; the students are Uzbek learners.
- "fixFirst" is the single most valuable thing to work on next, in one sentence.`
}

/** Download the clips and ask Gemini once. */
async function gradeWithGemini(
  admin: Client,
  apiKey: string,
  answers: AnswerIn[],
): Promise<GeminiOut> {
  const parts: unknown[] = [{ text: buildPrompt(answers) }]

  for (const a of answers) {
    const { data, error } = await admin.storage.from(BUCKET).download(a.path)
    if (error || !data) throw new Error(`Missing recording for question ${a.questionIndex + 1}`)
    parts.push({
      inline_data: {
        mime_type: a.mimeType || data.type || 'audio/webm',
        data: base64(new Uint8Array(await data.arrayBuffer())),
      },
    })
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
          // Scoring against a fixed rubric needs no deliberation, and thinking
          // tokens are billed as output.
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
    },
  )

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const payload = await res.json()
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text) as GeminiOut
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
  const blocks = BLOCKS.filter((b) => present.includes(b.key)).map((b) => {
    const got = out.blocks?.find((x) => x.block === b.key)
    // Clamp: the model must not be able to invent a score outside the rubric.
    const raw = Math.round(Number(got?.score ?? 0))
    return {
      key: b.key,
      label: b.label,
      max: b.max,
      score: Math.max(0, Math.min(b.max, Number.isFinite(raw) ? raw : 0)),
      reason: got?.reason ?? '',
    }
  })

  const rawScore = blocks.reduce((n, b) => n + b.score, 0)
  const full = scope === 'full'
  const rating = full
    ? ratingForRaw(rawScore)
    : estimateRatingFromBlock(blocks[0]?.key as BlockKey, blocks[0]?.score ?? 0)
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
      model: MODEL,
    },
  }
}

async function deleteClips(admin: Client, paths: string[]) {
  if (paths.length === 0) return
  await admin.storage.from(BUCKET).remove(paths)
}

/** Remove clips from attempts that were uploaded but never graded. */
async function sweepOrphans(admin: Client, userId: string) {
  const { data: folders } = await admin.storage.from(BUCKET).list(userId, { limit: 100 })
  const cutoff = Date.now() - ORPHAN_MS
  const stale: string[] = []
  for (const folder of (folders ?? []) as Client[]) {
    const { data: files } = await admin.storage
      .from(BUCKET)
      .list(`${userId}/${folder.name}`, { limit: 100 })
    for (const f of (files ?? []) as Client[]) {
      const at = Date.parse(f.created_at ?? '')
      if (Number.isFinite(at) && at < cutoff) stale.push(`${userId}/${folder.name}/${f.name}`)
    }
  }
  if (stale.length > 0) await admin.storage.from(BUCKET).remove(stale)
}
