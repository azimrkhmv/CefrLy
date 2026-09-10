// grade-writing: mark a finished writing attempt against the official
// Multilevel rubric.
//
// The browser sends the text the student typed. This function asks a model to
// JUDGE it — four criteria per task, with quotes behind them — and then does
// ALL THE ARITHMETIC ITSELF: weights, underlength caps, zero-mark rules, the
// /36 → /75 conversion and the CEFR band (rubric.ts + scoring.ts, both pure and
// covered by scoring.test.ts). A model never returns a band, and never returns
// a score. That is the rule Speaking arrived at after a student who answered
// every question was shown 35/75 and then 75/75 for the same paper.
//
// The model key lives ONLY in this function's secrets. It is never sent to the
// browser, and the browser can never call the model directly.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'
import { effectivePlan, hasPremiumAccess, monthStartUTC, PLAN_LIMITS, type PlanId } from './plans.ts'
import { CRITERIA, RUBRIC_TEXT, TASKS, type Criterion, type WritingTaskType } from './rubric.ts'
import { scoreAttempt, type TaskIn, type TaskJudgement } from './scoring.ts'

const RETIRED_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.1-flash']
const envModel = Deno.env.get('GEMINI_MODEL')
const MODEL = envModel && !RETIRED_MODELS.includes(envModel) ? envModel : 'gemini-3.7-flash'
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash']

/** A run still unfinished after this long is assumed dead, and may be retried. */
const RUN_STALE_MS = 5 * 60 * 1000
/** A FAILED grade deliberately costs the student no allowance, so without these
 *  a retry loop could burn tokens without limit. Staff bypass both. */
const MAX_RUNS_PER_ATTEMPT = 5
const MAX_ATTEMPTS_PER_HOUR = 15
/** Marking three tasks with inline corrections and an improved version of each
 *  is the long output on this function; a truncated JSON body is the thing this
 *  prevents. */
const MAX_OUTPUT_TOKENS = 8192
const CALL_TIMEOUT_MS = 40_000
/** Text-only grading is fast. The whole run gets well under the platform's
 *  ceiling, and the two judges run side by side inside it. */
const TOTAL_BUDGET_MS = 110_000
const TRIES_PER_MODEL = 2
const BACKOFF_MS = [800, 2000]

/** Longest answer accepted, in characters. The tasks ask for 50-250 words; this
 *  is many times that, and it stops a pasted novel becoming a token bill. */
const MAX_TEXT_CHARS = 12_000

interface TaskInBody {
  taskId?: string
  taskType?: string
  taskLabel?: string
  text?: string
  targetWords?: number
  /** What the student was asked to do — the model cannot judge task achievement
   *  without it. Plain text; the browser strips the prompt's HTML. */
  promptTitle?: string
  promptText?: string
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
  const { data: authData } = await userClient.auth.getUser()
  if (!authData.user) return json({ error: 'Unauthorized' }, 401)
  const user = { id: authData.user.id }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'Grading is not configured yet.', code: 'no_grader' }, 503)

  let body: {
    attemptId?: string
    testId?: string
    testTitle?: string
    scope?: 'full' | 'part'
    taskType?: string | null
    tasks?: TaskInBody[]
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

  const { data: existing } = await admin
    .from('writing_attempts')
    .select(
      'id, user_id, status, test_id, test_title, scope, task_type, answers, grading_started_at, grading_runs, created_at',
    )
    .eq('id', attemptId)
    .maybeSingle()
  if (existing && existing.user_id !== user.id) return json({ error: 'Not found' }, 404)

  // --- Plan gate. Runs BEFORE the model call, so a free-plan user never costs
  // a token. ------------------------------------------------------------------
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
        error: 'AI writing checks are part of Pro and Premium.',
        code: 'premium_only',
        action: 'writing_check',
        plan,
      },
      403,
    )
  }

  // Already marked: calling twice must not charge the student twice.
  if (existing?.status === 'done') return json({ attemptId, status: 'done' }, 200)

  // DOUBLE-GRADE GUARD. The report page polls while the row says 'grading', so
  // a second call has nothing to add and everything to break — it would pay for
  // one paper twice. A run older than RUN_STALE_MS is assumed dead (the function
  // was killed mid-call) and may be started again.
  if (existing?.status === 'grading') {
    const startedAt = Date.parse(existing.grading_started_at ?? existing.created_at ?? '')
    if (Number.isFinite(startedAt) && Date.now() - startedAt < RUN_STALE_MS) {
      return json({ attemptId, status: 'grading' }, 202)
    }
  }

  const runsSoFar = (existing?.grading_runs ?? 0) as number
  if (!isStaff && runsSoFar >= MAX_RUNS_PER_ATTEMPT) {
    return json({ error: 'This attempt has been checked too many times.' }, 429)
  }
  if (!isStaff && !existing) {
    const { count: startedThisHour } = await admin
      .from('writing_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    if ((startedThisHour ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
      return json({ error: 'Too many checks in the last hour. Please try again later.' }, 429)
    }
  }

  // A RETRY sends nothing but the id: the text is on the row. Unlike speaking's
  // clips it never expires, so a check can be re-run days later.
  const rawTasks = body.tasks?.length ? body.tasks : (existing?.answers as TaskInBody[] | null) ?? []
  const testId = body.testId ?? existing?.test_id
  const testTitle = body.testTitle ?? existing?.test_title
  if (!testId || !testTitle) return json({ error: 'This attempt cannot be graded again.' }, 400)

  const tasks = normalizeTasks(rawTasks)
  if (tasks.length === 0) return json({ error: 'There is nothing written to check.' }, 400)
  if (!tasks.some((t) => t.text.trim())) {
    return json({ error: 'There is nothing written to check.' }, 400)
  }

  const limit = isStaff ? null : PLAN_LIMITS[plan].writing_check
  if (limit !== null) {
    // Only completed checks count. A failed grade cost the student nothing, so
    // it must not eat an allowance either.
    const { count } = await admin
      .from('writing_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'done')
      .gte('created_at', monthStartUTC())
    const used = count ?? 0
    if (used >= limit) {
      return json(
        {
          error: 'Monthly writing checks used up.',
          code: 'plan_limit',
          action: 'writing_check',
          plan,
          limit,
          used,
        },
        403,
      )
    }
  }

  const scope = (body.scope ?? existing?.scope) === 'part' ? 'part' : 'full'
  const taskType = scope === 'part' ? (tasks[0]?.taskType ?? null) : null

  await admin.from('writing_attempts').upsert({
    id: attemptId,
    user_id: user.id,
    test_id: testId,
    test_title: testTitle,
    scope,
    task_type: taskType,
    status: 'grading',
    error_message: null,
    // Written BEFORE the model call, so a failed run leaves everything a retry
    // needs — and so the student's work is safe the moment they press Submit.
    answers: tasks,
    grading_started_at: new Date().toISOString(),
    grading_runs: runsSoFar + 1,
  })

  // GRADING RUNS IN THE BACKGROUND. The report page polls while the row says
  // 'grading', so answering 202 straight away puts the student on their own
  // results page immediately and takes the platform's wall-clock limit off the
  // table. (Awaited when EdgeRuntime is absent — i.e. local `deno serve`.)
  const work = (async () => {
    try {
      const deadline = Date.now() + TOTAL_BUDGET_MS
      const graded = await judgePaper(apiKey, tasks, deadline)

      // A model that returned nothing for a task the student plainly wrote is a
      // FAILED grade, not a zero. Recording 0 would put a mark the student did
      // not earn on their record, and scoring.ts deliberately refuses to invent
      // one — so the refusal has to be caught here.
      const unjudged = tasks.filter(
        (t, i) =>
          t.text.trim().length > 0 &&
          !graded.tasks.find((j) => j.taskId === t.taskId) &&
          !graded.tasks[i],
      )
      if (unjudged.length > 0) throw new Error('The examiner did not mark every task.')

      const result = scoreAttempt(tasks, graded.tasks, scope, {
        summary: graded.summary,
        fixFirst: graded.fixFirst,
      })

      await admin
        .from('writing_attempts')
        .update({
          status: 'done',
          raw_score: result.raw36,
          rating: result.rating,
          // Drills store NULL: an extrapolation from one task is not a CEFR band
          // and must never reach the dashboard's trend or best-band tiles.
          band: scope === 'full' ? result.band : null,
          result: { ...result, model: MODEL, review: graded.review },
          graded_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', attemptId)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.log(`grade-writing failed for ${attemptId}: ${message}`)
      await admin
        .from('writing_attempts')
        .update({ status: 'failed', error_message: message.slice(0, 300) })
        .eq('id', attemptId)
    }
  })()

  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime
  if (runtime?.waitUntil) runtime.waitUntil(work)
  else await work

  return json({ attemptId, status: 'grading' }, 202)
})

/** Trust nothing from the browser: the text is the student's, but the task type,
 *  the label and the target are all marks-affecting and must be known values. */
function normalizeTasks(raw: TaskInBody[]): TaskIn[] {
  const out: TaskIn[] = []
  for (const t of raw ?? []) {
    const taskType = (t?.taskType ?? '') as WritingTaskType
    if (!TASKS[taskType]) continue
    const text = typeof t?.text === 'string' ? t.text.slice(0, MAX_TEXT_CHARS) : ''
    out.push({
      taskId: String(t?.taskId ?? `${taskType}-${out.length}`),
      taskType,
      taskLabel: String(t?.taskLabel ?? TASKS[taskType].label).slice(0, 40),
      text,
      targetWords:
        Number.isFinite(t?.targetWords) && (t!.targetWords as number) > 0
          ? Math.min(1000, Math.round(t!.targetWords as number))
          : undefined,
      promptTitle: typeof t?.promptTitle === 'string' ? t.promptTitle.slice(0, 200) : undefined,
      promptText: typeof t?.promptText === 'string' ? t.promptText.slice(0, 2500) : undefined,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// The model call.
// ---------------------------------------------------------------------------

interface PaperJudgement {
  tasks: TaskJudgement[]
  summary?: string
  fixFirst?: string
}

/**
 * TWO EXAMINERS, AND THE LOWER MARK STANDS.
 *
 * One call at temperature 0 is one opinion, and asking twice at identical
 * settings just gets the same opinion twice. Two readings at different
 * temperatures disagree where the writing is genuinely borderline, and taking
 * the LOWER of each criterion is the conservative resolution: a band this
 * student can defend. (Speaking v28, for the same reason — a single reading was
 * what let a paper with A2 grammar score 75/75.)
 *
 * If the second reading fails, the first one stands rather than losing the
 * paper. Both are stored on the row so a challenged mark can be re-examined.
 */
async function judgePaper(
  apiKey: string,
  tasks: TaskIn[],
  deadline: number,
): Promise<PaperJudgement & { review: unknown }> {
  const prompt = buildPrompt(tasks)
  const schema = paperSchema(tasks)

  const [a, b] = await Promise.allSettled([
    callModel(apiKey, prompt, schema, 0, deadline),
    callModel(apiKey, prompt, schema, 0.4, deadline),
  ])

  const first = a.status === 'fulfilled' ? (a.value as PaperJudgement) : null
  const second = b.status === 'fulfilled' ? (b.value as PaperJudgement) : null

  if (!first && !second) {
    throw a.status === 'rejected' ? a.reason : new Error('The examiner could not be reached.')
  }
  if (!first || !second) {
    const only = (first ?? second)!
    return { ...only, review: { judges: [only], note: 'one reading only' } }
  }

  return { ...mergeJudgements(first, second, tasks), review: { judges: [first, second] } }
}

/** Per-criterion minimum of the two readings; the prose comes from whichever
 *  examiner marked the task lower, so the feedback matches the mark shown. */
function mergeJudgements(a: PaperJudgement, b: PaperJudgement, tasks: TaskIn[]): PaperJudgement {
  const pick = (p: PaperJudgement, id: string, i: number) =>
    p.tasks?.find((t) => t?.taskId === id) ?? p.tasks?.[i]

  const merged = tasks.map((task, i) => {
    const ja = pick(a, task.taskId, i)
    const jb = pick(b, task.taskId, i)
    if (!ja) return { ...(jb ?? {}), taskId: task.taskId }
    if (!jb) return { ...ja, taskId: task.taskId }

    const criteria: Partial<Record<Criterion, unknown>> = {}
    for (const c of CRITERIA) {
      const va = Number((ja.criteria ?? {})[c])
      const vb = Number((jb.criteria ?? {})[c])
      const both = [va, vb].filter((v) => Number.isFinite(v))
      // A criterion only ONE examiner returned is missing evidence from the
      // other, not a zero from them — take what there is.
      if (both.length) criteria[c] = Math.min(...both)
    }

    const totalOf = (j: TaskJudgement) =>
      CRITERIA.reduce((n, c) => n + (Number((j.criteria ?? {})[c]) || 0), 0)
    const stricter = totalOf(ja) <= totalOf(jb) ? ja : jb

    return {
      ...stricter,
      taskId: task.taskId,
      criteria,
      // An accusation needs only one examiner to make it, and both to be sure.
      // Off-topic and memorised ZERO a paper, so they take BOTH: one model's
      // hunch may not erase somebody's work (verify.ts).
      offTopic: ja.offTopic === true && jb.offTopic === true,
      memorised: ja.memorised === true && jb.memorised === true,
    }
  })

  // The paper-level prose comes from whichever examiner marked the PAPER lower,
  // for the same reason the per-task prose does: the words a student reads have
  // to match the mark they were given.
  const paperTotal = (p: PaperJudgement) =>
    (p.tasks ?? []).reduce(
      (n, j) => n + CRITERIA.reduce((m, c) => m + (Number((j?.criteria ?? {})[c]) || 0), 0),
      0,
    )
  const strictPaper = paperTotal(a) <= paperTotal(b) ? a : b
  return {
    tasks: merged,
    summary: strictPaper.summary || a.summary || b.summary,
    fixFirst: strictPaper.fixFirst || a.fixFirst || b.fixFirst,
  }
}

function buildPrompt(tasks: TaskIn[]): string {
  // STATIC TEXT FIRST — the preamble and the rubric are byte-identical on every
  // call, which is what implicit prompt caching needs. NEVER move the student's
  // answers above RUBRIC_TEXT (the same rule as grade-speaking).
  const preamble = `You are an experienced examiner for the Uzbek Multilevel (CEFR) English
writing paper. You mark to the official rubric below.

YOUR JOB IS TO JUDGE, NOT TO SCORE. For each task return the FOUR official
criteria as bands 0-9, with quotes from the student's own text behind them. Do
NOT return an overall band, a total, a percentage or a CEFR level: the marks,
the weights, the length rules and the conversion to a final score are all
applied by the system afterwards, from the criteria you give.

Return, per task:
  · criteria: task_achievement, grammar, vocabulary, coherence — each 0-9.
  · evidence: two or three sentences quoting the text, saying why those bands.
  · offTopic: true ONLY if the response does not address the task that was set.
    This ZEROES the task, so it is a statement about the response, not about its
    quality. A weak or partial answer to the right question is NOT off topic.
  · memorised: true ONLY if the response is a pre-learned or copied text
    unrelated to this prompt. This also zeroes the task. If unsure, false.
  · contentPoints: each point the prompt asked for, and whether it was covered.
  · strengths: up to three exact quotes worth keeping, each with a short reason.
  · corrections: up to eight specific fixes. "quote" MUST be copied EXACTLY from
    the student's text, word for word — it is used to highlight the words in
    place, so an approximate quote cannot be shown. Keep quotes short (2-12
    words). "suggestion" is the corrected wording. "type" is one of grammar,
    vocabulary, spelling, punctuation, register, coherence. Correct the most
    instructive mistakes, not every one.
  · improved: the student's OWN answer rewritten about one band higher — same
    content, same ideas, better English. Not a model answer to the prompt.
  · comment: one or two sentences of feedback on this task, addressed to the
    student as "you", in English.

Then, for the paper as a whole: "summary" (three or four sentences on where
this writer is and what is holding them back) and "fixFirst" (the single change
that would raise the mark most, in one sentence).

Feedback is written in ENGLISH only, and is addressed to the student directly.
Be specific and be kind: name the fault and show the fix.

OFFICIAL RUBRIC
${RUBRIC_TEXT}`

  const body = tasks
    .map((t, i) => {
      const meta = TASKS[t.taskType]
      const prompt = [t.promptTitle, t.promptText].filter(Boolean).join('\n')
      return `
--- TASK ${i + 1} of ${tasks.length} · id: ${t.taskId} · ${t.taskLabel} ---
Rubric family: ${meta.family === 'task_1' ? 'Task 1 (letter/email)' : 'Task 2 (essay)'}
The prompt the student answered:
${prompt || '(the prompt was not recorded)'}

THE STUDENT'S ANSWER (mark this, exactly as written — spelling and all):
"""
${t.text || '(nothing was written)'}
"""`
    })
    .join('\n')

  return `${preamble}\n\nTHE PAPER TO MARK — ${tasks.length} task(s). Use the id given for each.\n${body}`
}

/** The response schema. `offTopic` and `memorised` are REQUIRED so that a model
 *  which simply forgot them cannot read as an accusation — see verify.ts. */
function paperSchema(tasks: TaskIn[]) {
  return {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        minItems: tasks.length,
        items: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            criteria: {
              type: 'object',
              properties: {
                task_achievement: { type: 'integer' },
                grammar: { type: 'integer' },
                vocabulary: { type: 'integer' },
                coherence: { type: 'integer' },
              },
              required: ['task_achievement', 'grammar', 'vocabulary', 'coherence'],
            },
            evidence: { type: 'string' },
            offTopic: { type: 'boolean' },
            memorised: { type: 'boolean' },
            contentPoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: { point: { type: 'string' }, covered: { type: 'boolean' } },
                required: ['point', 'covered'],
              },
            },
            strengths: {
              type: 'array',
              items: {
                type: 'object',
                properties: { quote: { type: 'string' }, why: { type: 'string' } },
                required: ['quote', 'why'],
              },
            },
            corrections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  quote: { type: 'string' },
                  type: { type: 'string' },
                  suggestion: { type: 'string' },
                  note: { type: 'string' },
                },
                required: ['quote', 'type', 'suggestion'],
              },
            },
            improved: { type: 'string' },
            comment: { type: 'string' },
          },
          required: ['taskId', 'criteria', 'evidence', 'offTopic', 'memorised', 'comment'],
        },
      },
      summary: { type: 'string' },
      fixFirst: { type: 'string' },
    },
    required: ['tasks', 'summary', 'fixFirst'],
  }
}

// deno-lint-ignore no-explicit-any
async function callModel(
  apiKey: string,
  prompt: string,
  schema: unknown,
  temperature: number,
  deadline: number,
): Promise<any> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  })

  // OPENROUTER_FIRST=1 flips the ladder during a Google-direct incident.
  const orKey = Deno.env.get('OPENROUTER_API_KEY')
  const orFirst = Deno.env.get('OPENROUTER_FIRST') === '1'
  if (orFirst && orKey) {
    try {
      return await callOpenRouter(orKey, prompt, schema, temperature, deadline)
    } catch (e) {
      console.log(`openrouter-first failed (${String(e).slice(0, 80)}); trying Gemini direct`)
    }
  }

  try {
    const payload = await callGemini(apiKey, body, deadline)
    const candidate = payload?.candidates?.[0]
    const text = candidate?.content?.parts?.[0]?.text
    if (!text) throw new Error('The examiner returned no content')
    // MAX_TOKENS means the JSON is truncated. Say so plainly instead of letting
    // JSON.parse fail with something meaningless the student paid to retry.
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(`The check was cut short (${candidate.finishReason})`)
    }
    return JSON.parse(text)
  } catch (e) {
    // A FALLBACK INSIDE ONE VENDOR IS NOT A FALLBACK. OpenRouter reaches these
    // models through separately provisioned capacity and regularly answers
    // while the direct lane is jammed.
    if (!orKey || orFirst || deadline - Date.now() < 12_000) throw e
    console.log(`gemini lane exhausted (${String(e).slice(0, 80)}); trying OpenRouter`)
    return await callOpenRouter(orKey, prompt, schema, temperature, deadline)
  }
}

// Writing is text only, so unlike Speaking the ladder is not constrained by
// which vendor can read which audio format: a genuinely different vendor leads.
const OR_MODELS = ['openai/gpt-5.1', 'google/gemini-3.7-flash', 'anthropic/claude-sonnet-5']

// deno-lint-ignore no-explicit-any
async function callOpenRouter(
  orKey: string,
  prompt: string,
  schema: unknown,
  temperature: number,
  deadline: number,
): Promise<any> {
  let lastError: Error = new Error('The backup examiner could not be reached')

  for (const model of OR_MODELS) {
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
              content:
                `${prompt}\n\nReturn ONLY a JSON object matching this exact schema, ` +
                `with no prose around it:\n${JSON.stringify(schema)}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature,
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal: AbortSignal.timeout(Math.min(CALL_TIMEOUT_MS, remaining)),
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

// deno-lint-ignore no-explicit-any
async function callGemini(apiKey: string, body: string, deadline: number): Promise<any> {
  const models = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL && !RETIRED_MODELS.includes(m))]
  let lastError: Error = new Error('The examiner could not be reached')

  for (const model of models) {
    for (let attempt = 0; attempt < TRIES_PER_MODEL; attempt++) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw lastError

      const startedAt = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), Math.min(CALL_TIMEOUT_MS, remaining))
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
        if (res.ok) {
          console.log(`gemini ok ${model} in ${Date.now() - startedAt}ms`)
          return await res.json()
        }

        const detail = (await res.text()).slice(0, 200)
        const err = new Error(`Gemini ${res.status}: ${detail}`)
        // A 4xx that is not a rate limit will not fix itself on a retry: either
        // the body is wrong or this model does not exist. Move to the next model
        // rather than sleeping between identical failures.
        if (res.status !== 429 && res.status < 500) {
          lastError = err
          break
        }
        lastError =
          res.status === 503 || res.status === 429
            ? new Error('The AI examiner is busy right now. Please try the check again shortly.')
            : err
      } catch (e) {
        const abort = e instanceof Error && e.name === 'AbortError'
        console.log(`gemini ${abort ? 'timeout' : 'error'} ${model} after ${Date.now() - startedAt}ms`)
        lastError = abort
          ? new Error('The check timed out. Please try again.')
          : e instanceof Error
            ? e
            : new Error(String(e))
        // A TIMEOUT IS NOT A BUSY SIGNAL: a model that did not answer inside the
        // whole per-call budget will not answer faster on an identical retry.
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
