import { supabase } from './supabase'
import type { Band, SanitizedTest, Skill } from '../types/test'
import type {
  AttemptResult,
  AttemptSummary,
  StoredAttemptResult,
  TestCatalogEntry,
} from '../types/attempt'

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
    .select('id, title, skill, target_levels, duration_sec')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as TestCatalogEntry[]
}

/** Sanitized test (no answers, explanations or transcripts) via the get-test
 *  edge function — reading OR listening, discriminated by `skill`. */
export function fetchSanitizedTest(testId: string): Promise<SanitizedTest> {
  return invokeFunction<SanitizedTest>('get-test', { testId })
}

/** Grades server-side and returns the full result with explanations. */
export function submitTest(
  testId: string,
  answers: Record<string, string>,
): Promise<AttemptResult> {
  return invokeFunction<AttemptResult>('submit-test', { testId, answers })
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
    .select('id, test_id, raw_score, total, band, created_at, result, tests(title, skill)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const test = row.tests as { title?: string; skill?: string } | { title?: string; skill?: string }[] | null
    const testRow = Array.isArray(test) ? test[0] : test
    const stored = (row.result ?? {}) as Partial<StoredAttemptResult>
    const skill: Skill =
      testRow?.skill === 'listening' || stored.skill === 'listening' ? 'listening' : 'reading'
    return {
      id: row.id as string,
      testId: (row.test_id as string | null) ?? null,
      testTitle: testRow?.title ?? stored.testTitle ?? 'Test',
      skill,
      rawScore: row.raw_score as number,
      total: row.total as number,
      band: row.band as Band,
      createdAt: row.created_at as string,
    }
  })
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
