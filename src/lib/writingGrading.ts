import { supabase } from './supabase'
import { PlanLimitError } from './api'
import type { WritingAttemptRow, WritingAttemptSummary, WritingAnswerRow } from '../types/writingResult'
import type { WritingTask, WritingTest } from '../types/test'

// ---------------------------------------------------------------------------
// Sending a finished writing attempt off to be marked.
//
// The text goes straight to the grade-writing edge function, which stores it,
// answers 202, and marks it in the background; the report page polls the row.
// The model key lives in the function's secrets — this file never sees it, and
// the browser can never call the model directly.
//
// The BAND IS NOT COMPUTED HERE and must never be. A student who can post their
// own score is not sitting an exam. `writing_attempts` has no insert or update
// policy for exactly that reason: only the service_role key writes there.
// ---------------------------------------------------------------------------

/** Thrown when the check itself failed (not a plan problem) — retryable. */
export class WritingGradingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WritingGradingError'
  }
}

/** The prompt as plain text. The task achievement criterion is unmarkable
 *  without the question, and the stored prompt is HTML. */
export function promptToText(html: string): string {
  const el = document.createElement('div')
  el.innerHTML = html
  // Block boundaries become newlines so bullet lists do not run together into
  // one unreadable line the examiner has to guess the shape of.
  el.querySelectorAll('li, p, br, blockquote, h1, h2, h3, h4').forEach((node) => {
    node.insertAdjacentText('beforebegin', '\n')
  })
  return (el.textContent ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n')
    .trim()
}

/** The word target a task is judged against: what the paper actually asked for. */
export const targetWordsFor = (task: WritingTask): number => task.maxWords ?? task.minWords

/** Build the payload for one task from the paper and what the student typed. */
export function answerRowFor(task: WritingTask, text: string): WritingAnswerRow {
  return {
    taskId: task.id,
    taskType: task.taskType,
    taskLabel: task.label,
    text,
    targetWords: targetWordsFor(task),
    promptTitle: task.prompt.title,
    promptText: promptToText(task.prompt.html),
  }
}

export interface SubmitWritingInput {
  test: WritingTest
  /** taskId → the text written. */
  answers: Record<string, string>
  /** The id this sitting is marked under, fixed when the attempt starts. */
  attemptId: string
}

/**
 * Submit a finished paper for marking. Returns the attempt id; the report page
 * reads the row it wrote.
 *
 * EVERY task of the paper is sent, including the ones left blank. Sending only
 * what was written would hand the grader a two-task paper where the exam had
 * three, and the missing 24 points would quietly stop counting — "skip the
 * essay, score higher". The server applies the zero rules to a blank.
 */
export async function submitWritingAttempt({
  test,
  answers,
  attemptId,
}: SubmitWritingInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new WritingGradingError('You need to be signed in for an AI check.')

  const tasks = test.tasks.map((task) => answerRowFor(task, answers[task.id] ?? ''))
  if (!tasks.some((t) => t.text.trim())) {
    throw new WritingGradingError('There is nothing written to check.')
  }

  const { data, error } = await supabase.functions.invoke('grade-writing', {
    body: {
      attemptId,
      testId: test.id,
      testTitle: test.title,
      scope: test.scope ?? 'full',
      taskType: (test.scope ?? 'full') === 'part' ? test.tasks[0]?.taskType ?? null : null,
      tasks,
    },
  })

  if (error) throw await gradingError(error, 'The AI check could not be reached. Please try again.')
  return (data as { attemptId?: string })?.attemptId ?? attemptId
}

/**
 * Ask the server to mark an attempt again. The text is on the row, so this
 * needs nothing but the id — a retry works even after the exam tab was closed,
 * and (unlike Speaking, whose recordings are swept within hours) it still works
 * days later.
 */
export async function retryWritingAttempt(attemptId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('grade-writing', {
    body: { attemptId },
  })
  if (error) throw await gradingError(error, 'The AI check could not be reached.')
}

/** Turn a functions-invoke failure into something the UI can act on: a plan wall
 *  where the server said so, a retryable grading error otherwise. */
async function gradingError(error: unknown, fallback: string): Promise<Error> {
  const ctx = (error as { context?: Response }).context
  if (ctx) {
    try {
      const parsed = (await ctx.json()) as {
        error?: string
        code?: string
        action?: 'writing_check'
        plan?: 'free' | 'pro' | 'premium'
        limit?: number
      }
      if (parsed.code === 'plan_limit' || parsed.code === 'premium_only') {
        return new PlanLimitError(
          parsed.error ?? 'This needs a paid plan.',
          parsed.code,
          parsed.action ?? 'writing_check',
          parsed.plan ?? 'free',
          parsed.limit ?? null,
        )
      }
      return new WritingGradingError(parsed.error ?? fallback)
    } catch {
      // Fall through to the generic message below.
    }
  }
  return new WritingGradingError(fallback)
}

/** Read one marked attempt (RLS limits this to the student's own rows). */
export async function fetchWritingAttempt(id: string): Promise<WritingAttemptRow | null> {
  const { data, error } = await supabase
    .from('writing_attempts')
    .select(
      'id, test_id, test_title, scope, task_type, status, error_message, raw_score, rating, band, answers, result, created_at, graded_at',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as WritingAttemptRow | null) ?? null
}

/**
 * The student's writing attempts, newest first.
 *
 * `result` and `answers` are DELIBERATELY not selected — they hold every essay
 * and every correction, and the list views show a score and a date. The report
 * page fetches the full row by id when it actually needs them.
 */
export async function fetchWritingAttempts(): Promise<WritingAttemptSummary[]> {
  const { data, error } = await supabase
    .from('writing_attempts')
    .select(
      'id, test_id, test_title, scope, task_type, status, error_message, raw_score, rating, band, created_at, graded_at',
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as WritingAttemptSummary[]
}
