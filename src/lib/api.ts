import { supabase } from './supabase'
import type { SanitizedReadingTest } from '../types/test'
import type { AttemptResult, StoredAttemptResult, TestCatalogEntry } from '../types/attempt'

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

/** Sanitized test (no answers, no explanations) via the get-test edge function. */
export function fetchSanitizedTest(testId: string): Promise<SanitizedReadingTest> {
  return invokeFunction<SanitizedReadingTest>('get-test', { testId })
}

/** Grades server-side and returns the full result with explanations. */
export function submitTest(
  testId: string,
  answers: Record<string, string>,
): Promise<AttemptResult> {
  return invokeFunction<AttemptResult>('submit-test', { testId, answers })
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
