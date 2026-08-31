import { supabase } from './supabase'
import { PlanLimitError } from './api'
import type { SpeakingAttemptRow, SpeakingAttemptSummary } from '../types/speakingResult'
import type { SpeakingStep } from './speakingQuestions'
import type { StepAnswer } from '../components/speaking/QuestionRunner'

// ---------------------------------------------------------------------------
// Sending a finished speaking attempt off to be graded.
//
// The clips go to the PRIVATE `speaking-temp` bucket, the edge function reads
// them once and deletes them. They are never public, never played back, and
// nothing here can read them again — storage RLS grants the student insert only.
// The Gemini key lives in the function's secrets; this file never sees it.
// ---------------------------------------------------------------------------

const BUCKET = 'speaking-temp'

export interface GradeInput {
  test: { id: string; title: string; scope: 'full' | 'part'; partType?: string | null }
  steps: SpeakingStep[]
  answers: Record<string, StepAnswer>
  /** The id this sitting is graded under. Fixed when the exam starts and kept in
   *  the draft, so clips uploaded before a reload belong to the same attempt as
   *  the ones after it. */
  attemptId: string
}

/**
 * Put ONE answer in the bucket, the moment it is recorded.
 *
 * This is what makes a speaking attempt survive a reload: by the time the
 * student presses Submit the audio is already on the server, so a stray Ctrl+R
 * costs nothing and the finish is instant. Every take gets its own filename —
 * a retake must not collide with the take it replaces (students may only INSERT
 * into this bucket, so overwriting is refused by RLS anyway), and the loser of
 * the race is swept within the hour.
 */
export async function uploadAnswerClip(
  attemptId: string,
  questionIndex: number,
  blob: Blob,
): Promise<{ path: string; mimeType: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new GradingError('You need to be signed in.')

  const mimeType = blob.type || 'audio/webm'
  const take = crypto.randomUUID().slice(0, 8)
  // Path is scoped by user id — storage RLS refuses anything else.
  const path = `${user.id}/${attemptId}/${questionIndex}-${take}.${extensionFor(mimeType)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType,
    upsert: false,
  })
  if (error) throw new GradingError(error.message)
  return { path, mimeType }
}

/** Thrown when grading itself failed (not a plan problem) — retryable. */
export class GradingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GradingError'
  }
}

const extensionFor = (mime: string) =>
  mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : mime.includes('wav') ? 'wav' : 'webm'

/**
 * Upload every recorded answer, then ask the server to grade them.
 * Returns the attempt id; the analyze page reads the row it wrote.
 */
export async function gradeSpeakingAttempt({
  test,
  steps,
  answers,
  attemptId,
}: GradeInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new GradingError('You need to be signed in for an AI check.')

  const all = steps.map((step, index) => ({ step, index, clip: answers[step.id] }))
  const answered = all.filter((x) => x.clip)

  if (answered.length === 0) throw new GradingError('There is nothing recorded to check.')

  const uploaded: {
    questionIndex: number
    partType: string
    questionText: string
    durationSec: number
    path?: string
    mimeType?: string
    /** No recording for this question. Sent anyway — see below. */
    missing?: true
  }[] = []

  // Almost every clip is already up here — uploadAnswerClip sent it the moment
  // it was recorded. What is left is the rare answer whose upload failed or was
  // still in flight when Submit was pressed, and those go together rather than
  // one after another.
  const uploads = await Promise.all(
    answered.map(async ({ step, index, clip }) => {
      const row = {
        questionIndex: index,
        partType: step.task.partType,
        questionText: step.question.text,
        durationSec: clip!.durationSec,
      }
      if (clip!.path) return { ...row, path: clip!.path, mimeType: clip!.mimeType }
      if (!clip!.blob) throw new GradingError(`Answer ${index + 1} was lost before it was saved.`)
      const { path, mimeType } = await uploadAnswerClip(attemptId, index, clip!.blob)
      return { ...row, path, mimeType }
    }),
  )
  uploaded.push(...uploads)

  // Questions with NO recording are reported too, not quietly dropped. The
  // rubric scores a block by how many of its questions were answered on topic —
  // send only the answered ones and the grader sees a two-question block where
  // the paper had three, and marks it as if nothing were missed. Skipping would
  // raise the score.
  for (const { step, index } of all.filter((x) => !x.clip)) {
    uploaded.push({
      questionIndex: index,
      partType: step.task.partType,
      questionText: step.question.text,
      durationSec: 0,
      missing: true,
    })
  }
  uploaded.sort((a, b) => a.questionIndex - b.questionIndex)

  const { data, error } = await supabase.functions.invoke('grade-speaking', {
    body: {
      attemptId,
      testId: test.id,
      testTitle: test.title,
      scope: test.scope,
      partType: test.partType ?? null,
      answers: uploaded,
    },
  })

  if (error) {
    // Surface plan problems as PlanLimitError so the UI can show the upgrade
    // wall instead of a generic failure.
    const ctx = (error as { context?: Response }).context
    if (ctx) {
      try {
        const parsed = (await ctx.json()) as {
          error?: string
          code?: string
          action?: 'speaking_check'
          plan?: 'free' | 'pro' | 'premium'
          limit?: number
        }
        if (parsed.code === 'plan_limit' || parsed.code === 'premium_only') {
          throw new PlanLimitError(
            parsed.error ?? 'This needs a paid plan.',
            parsed.code,
            parsed.action ?? 'speaking_check',
            parsed.plan ?? 'free',
            parsed.limit ?? null,
          )
        }
        throw new GradingError(parsed.error ?? 'The AI check failed. Please try again.')
      } catch (e) {
        if (e instanceof PlanLimitError || e instanceof GradingError) throw e
      }
    }
    throw new GradingError('The AI check could not be reached. Please try again.')
  }

  return (data as { attemptId?: string })?.attemptId ?? attemptId
}

/**
 * Ask the server to grade an attempt again. The clips are still in the bucket
 * and the attempt row remembers which question each one answers, so this needs
 * nothing but the id — a retry works even after the exam tab was closed. Only
 * possible within the hour before the clips are swept.
 */
export async function retrySpeakingAttempt(attemptId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('grade-speaking', {
    body: { attemptId },
  })
  if (!error) return
  const ctx = (error as { context?: Response }).context
  if (ctx) {
    try {
      const parsed = (await ctx.json()) as { error?: string }
      throw new GradingError(parsed.error ?? 'The AI check failed again.')
    } catch (e) {
      if (e instanceof GradingError) throw e
    }
  }
  throw new GradingError('The AI check could not be reached.')
}

/** Read one graded attempt (RLS limits this to the student's own rows). */
export async function fetchSpeakingAttempt(id: string): Promise<SpeakingAttemptRow | null> {
  const { data, error } = await supabase
    .from('speaking_attempts')
    .select(
      'id, test_id, test_title, scope, part_type, status, error_message, raw_score, rating, band, result, audio_manifest, created_at, graded_at',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as SpeakingAttemptRow | null) ?? null
}

export interface RecheckRequest {
  id: string
  attempt_id: string
  reason: string
  status: 'open' | 'reviewed' | 'rejected'
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

/**
 * Ask a human to look at a score again. This does NOT re-run the AI: the
 * recordings are gone after grading, so a second automatic pass would read the
 * same transcript and reach the same answer. It puts the complaint in front of
 * an admin.
 */
export async function requestRecheck(attemptId: string, reason: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You need to be signed in.')
  const { error } = await supabase
    .from('speaking_recheck_requests')
    .insert({ attempt_id: attemptId, user_id: user.id, reason: reason.trim() })
  if (error) {
    // The unique constraint on attempt_id is the "already asked" case.
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error('You have already asked us to look at this attempt.')
    }
    throw new Error(error.message)
  }
}

/** The student's own recheck request for an attempt, if they raised one. */
export async function fetchRecheck(attemptId: string): Promise<RecheckRequest | null> {
  const { data, error } = await supabase
    .from('speaking_recheck_requests')
    .select('id, attempt_id, reason, status, admin_note, created_at, reviewed_at')
    .eq('attempt_id', attemptId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as RecheckRequest | null) ?? null
}

/**
 * The student's graded speaking attempts, newest first.
 *
 * `result` is DELIBERATELY not selected. It holds every transcript, every
 * correction and every rewritten answer of an attempt, and the list views
 * (My results, the Speaking catalog) show nothing but the score and the date —
 * so fifty rows of it were being downloaded and thrown away. The analyze page
 * fetches the full row by id when it actually needs the detail.
 */
export async function fetchSpeakingAttempts(): Promise<SpeakingAttemptSummary[]> {
  const { data, error } = await supabase
    .from('speaking_attempts')
    .select(
      'id, test_id, test_title, scope, part_type, status, error_message, raw_score, rating, band, created_at, graded_at',
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as SpeakingAttemptSummary[]
}
