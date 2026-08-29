import { supabase } from './supabase'
import { PlanLimitError } from './api'
import type { SpeakingAttemptRow } from '../types/speakingResult'
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
export async function gradeSpeakingAttempt({ test, steps, answers }: GradeInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new GradingError('You need to be signed in for an AI check.')

  const attemptId = crypto.randomUUID()
  const answered = steps
    .map((step, index) => ({ step, index, clip: answers[step.id] }))
    .filter((x) => x.clip)

  if (answered.length === 0) throw new GradingError('There is nothing recorded to check.')

  const uploaded: {
    questionIndex: number
    partType: string
    questionText: string
    durationSec: number
    path: string
    mimeType: string
  }[] = []

  for (const { step, index, clip } of answered) {
    const blob = clip!.blob
    const mimeType = blob.type || 'audio/webm'
    // Path is scoped by user id — storage RLS refuses anything else.
    const path = `${user.id}/${attemptId}/${index}.${extensionFor(mimeType)}`
    // upsert MUST stay false. It compiles to INSERT ... ON CONFLICT DO UPDATE,
    // and Postgres then demands an UPDATE policy on storage.objects even when
    // nothing conflicts — so an upsert is rejected by RLS outright. Students get
    // INSERT only, deliberately: they can neither overwrite nor read a clip back.
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: mimeType,
      upsert: false,
    })
    // A retry re-uploads answers that already made it; that is not a failure.
    const alreadyThere =
      error && ((error as { statusCode?: string }).statusCode === '409' || /exist/i.test(error.message))
    if (error && !alreadyThere) {
      throw new GradingError(`Could not upload answer ${index + 1}: ${error.message}`)
    }
    uploaded.push({
      questionIndex: index,
      partType: step.task.partType,
      questionText: step.question.text,
      durationSec: clip!.durationSec,
      path,
      mimeType,
    })
  }

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

/** The student's graded speaking attempts, newest first. */
export async function fetchSpeakingAttempts(): Promise<SpeakingAttemptRow[]> {
  const { data, error } = await supabase
    .from('speaking_attempts')
    .select(
      'id, test_id, test_title, scope, part_type, status, error_message, raw_score, rating, band, result, created_at, graded_at',
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as SpeakingAttemptRow[]
}
