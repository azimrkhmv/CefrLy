import { supabase } from './supabase'
import type { Band, SanitizedTest, SessionStatus, Skill, TestMode, TestSession } from '../types/test'
import type {
  AttemptResult,
  AttemptReview,
  AttemptSummary,
  StoredAttemptResult,
  TestCatalogEntry,
} from '../types/attempt'
import type {
  DailyMinutes,
  FirstExam,
  HeardFrom,
  OnboardingAnswers,
  SelfLevel,
  StudentProfile,
  StudyPrefs,
  TargetBand,
  WeakArea,
} from '../types/profile'
import type { Sample } from '../types/sample'

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = `Request to "${name}" failed. Check that the edge function is deployed.`
    const ctx = (error as { context?: Response }).context
    if (ctx) {
      try {
        const parsed = (await ctx.json()) as { error?: string }
        if (parsed.error) message = parsed.error
      } catch {
        // keep the generic message
      }
    }
    throw new Error(message)
  }
  return data as T
}

/** Published test metadata. RLS guarantees test content/answers are unreachable here. */
export async function listTests(): Promise<TestCatalogEntry[]> {
  const { data, error } = await supabase
    .from('tests')
    .select('id, title, skill, target_levels, duration_sec, scope, part_number')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as TestCatalogEntry[]
}

/** Published Writing/Speaking samples, in catalog order. Samples carry no
 *  answer keys, so RLS-guarded direct reads are safe (published rows only). */
export async function fetchSamples(): Promise<Sample[]> {
  const { data, error } = await supabase
    .from('samples')
    .select('id, slug, category, badge, title, content')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Sample[]
}

/** Sanitized test (no answers, explanations or transcripts) via the get-test
 *  edge function — reading OR listening, discriminated by `skill`. */
export function fetchSanitizedTest(testId: string): Promise<SanitizedTest> {
  return invokeFunction<SanitizedTest>('get-test', { testId })
}

/** READ-ONLY peek: test metadata + the user's open session (no session is
 *  created). The reading exam uses this to decide picker vs. resume. */
export function fetchSessionStatus(testId: string): Promise<SessionStatus> {
  return invokeFunction<SessionStatus>('session-status', { testId })
}

/** Begin a session in the chosen mode (or resume the one already open).
 *  `durationSec` is only needed for practice; simulation ignores it. */
export function startSession(
  testId: string,
  mode: TestMode,
  durationSec?: number,
): Promise<{ session: TestSession }> {
  return invokeFunction<{ session: TestSession }>('start-session', { testId, mode, durationSec })
}

/** Pause or resume a practice session's timer (server-authoritative). */
export function controlSession(
  sessionId: string,
  action: 'pause' | 'resume',
): Promise<{ session: TestSession }> {
  return invokeFunction<{ session: TestSession }>('session-control', { sessionId, action })
}

/** Abandon an open session: closes it server-side WITHOUT grading — the
 *  attempt is cancelled, nothing is stored, and there is nothing to resume. */
export function cancelSession(sessionId: string): Promise<{ ok: true }> {
  return invokeFunction<{ ok: true }>('session-control', { sessionId, action: 'cancel' })
}

/** Grades server-side and returns the full result with explanations. */
export function submitTest(
  testId: string,
  answers: Record<string, string>,
): Promise<AttemptResult> {
  return invokeFunction<AttemptResult>('submit-test', { testId, answers })
}

/** Full study review of a SUBMITTED attempt (content + keys + transcripts +
 *  the graded answers) — server enforces that only the owner can fetch it. */
export function fetchAttemptReview(attemptId: string): Promise<AttemptReview> {
  return invokeFunction<AttemptReview>('review-attempt', { attemptId })
}

/** Exchange a MilliyMock hand-off token for a one-time login token hash. */
export function milliymockHandoff(token: string): Promise<{ tokenHash: string }> {
  return invokeFunction<{ tokenHash: string }>('milliymock-handoff', { token })
}

/** All of the signed-in user's attempts, newest first (RLS: own rows only).
 *  `skill` comes from the joined test; if the test row is gone we fall back to
 *  the skill captured in the stored result, else 'reading' (legacy attempts). */
export async function fetchMyAttempts(): Promise<AttemptSummary[]> {
  const { data, error } = await supabase
    .from('attempts')
    .select(
      'id, test_id, raw_score, total, band, created_at, result, tests(title, skill, scope, part_number)',
    )
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const test = row.tests as
      | { title?: string; skill?: string; scope?: string; part_number?: number | null }
      | { title?: string; skill?: string; scope?: string; part_number?: number | null }[]
      | null
    const testRow = Array.isArray(test) ? test[0] : test
    const stored = (row.result ?? {}) as Partial<StoredAttemptResult>
    const skill: Skill =
      testRow?.skill === 'listening' || stored.skill === 'listening' ? 'listening' : 'reading'
    // Part drills score out of their own count and carry no CEFR band; the
    // joined test row is the source, the stored result the fallback.
    const scope = testRow?.scope === 'part' || stored.scope === 'part' ? 'part' : 'full'
    return {
      id: row.id as string,
      testId: (row.test_id as string | null) ?? null,
      testTitle: testRow?.title ?? stored.testTitle ?? 'Test',
      skill,
      scope,
      partNumber: testRow?.part_number ?? stored.partNumber ?? null,
      rawScore: row.raw_score as number,
      total: row.total as number,
      band: (row.band as Band | null) ?? null,
      createdAt: row.created_at as string,
    }
  })
}

const PROFILE_COLUMNS =
  'id, name, onboarded_at, first_exam, self_level, target_band, exam_month, weak_areas, daily_minutes, heard_from, heard_from_note'

function mapProfile(row: Record<string, unknown>): StudentProfile {
  return {
    id: row.id as string,
    name: (row.name as string | null) ?? null,
    onboardedAt: (row.onboarded_at as string | null) ?? null,
    firstExam: (row.first_exam as FirstExam | null) ?? null,
    selfLevel: (row.self_level as SelfLevel | null) ?? null,
    targetBand: (row.target_band as TargetBand | null) ?? null,
    examMonth: (row.exam_month as string | null) ?? null,
    weakAreas: (row.weak_areas as WeakArea[] | null) ?? [],
    dailyMinutes: (row.daily_minutes as DailyMinutes | null) ?? null,
    heardFrom: (row.heard_from as HeardFrom | null) ?? null,
    heardFromNote: (row.heard_from_note as string | null) ?? null,
  }
}

async function ownUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Not signed in.')
  return id
}

/** The signed-in user's profile row (RLS: own row only). */
export async function fetchMyProfile(): Promise<StudentProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', await ownUserId())
    .single()
  if (error) throw new Error(error.message)
  return mapProfile(data as Record<string, unknown>)
}

/** Save the one-time onboarding answers and stamp onboarded_at, so the wizard
 *  never shows again. Column grants limit the writable fields; CHECK
 *  constraints re-validate every value server-side. */
export async function saveOnboarding(answers: OnboardingAnswers): Promise<StudentProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_exam: answers.firstExam,
      self_level: answers.selfLevel,
      target_band: answers.targetBand,
      exam_month: answers.examMonth,
      weak_areas: answers.weakAreas,
      daily_minutes: answers.dailyMinutes,
      heard_from: answers.heardFrom,
      heard_from_note: answers.heardFrom === 'other' ? answers.heardFromNote : null,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', await ownUserId())
    .select(PROFILE_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return mapProfile(data as Record<string, unknown>)
}

/** Update the study preferences editable in /settings (attribution and the
 *  onboarded_at stamp are deliberately not touchable here). */
export async function updateStudyPrefs(prefs: StudyPrefs): Promise<StudentProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      target_band: prefs.targetBand,
      exam_month: prefs.examMonth,
      weak_areas: prefs.weakAreas,
      daily_minutes: prefs.dailyMinutes,
    })
    .eq('id', await ownUserId())
    .select(PROFILE_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return mapProfile(data as Record<string, unknown>)
}

/** Re-load a past attempt (RLS: only the owner can read it). */
export async function fetchAttempt(attemptId: string): Promise<AttemptResult> {
  const { data, error } = await supabase
    .from('attempts')
    .select('id, result')
    .eq('id', attemptId)
    .single()
  if (error) throw new Error(error.message)
  const stored = data.result as StoredAttemptResult
  return { attemptId: data.id as string, ...stored }
}
