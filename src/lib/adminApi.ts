import { supabase } from './supabase'
import type { CefrLevel, ReadingTest } from '../types/test'

// Client for the admin-tests edge function. The browser NEVER touches the
// tests/test_content tables for admin work — every read and write goes
// through the role-gated function.

export type TestStatus = 'draft' | 'published' | 'archived'

export interface AdminTestRow {
  id: string
  slug: string
  skill: string
  title: string
  status: TestStatus
  created_at: string
}

export interface AdminTestMeta extends AdminTestRow {
  target_levels: CefrLevel[]
  duration_sec: number
}

/** upsert failures carry a list of specific, human-readable problems. */
export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join('\n'))
    this.name = 'ValidationError'
  }
}

async function invokeAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-tests', { body })
  if (error) {
    let message = 'Admin request failed.'
    const ctx = (error as { context?: Response }).context
    if (ctx) {
      try {
        const parsed = (await ctx.json()) as { error?: string; errors?: string[] }
        if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
          throw new ValidationError(parsed.errors)
        }
        if (parsed.error) message = parsed.error
      } catch (err) {
        if (err instanceof ValidationError) throw err
      }
    }
    throw new Error(message)
  }
  return data as T
}

export async function adminListTests(): Promise<AdminTestRow[]> {
  const { tests } = await invokeAdmin<{ tests: AdminTestRow[] }>({ action: 'list' })
  return tests
}

export function adminGetTest(slug: string): Promise<{ test: AdminTestMeta; content: ReadingTest }> {
  return invokeAdmin({ action: 'get', slug })
}

export function adminUpsertTest(
  slug: string,
  content: ReadingTest,
  status: 'draft' | 'published',
): Promise<{ ok: true; slug: string; id: string }> {
  return invokeAdmin({ action: 'upsert', slug, content, status })
}

export function adminSetStatus(
  slug: string,
  status: 'draft' | 'published',
): Promise<{ ok: true; slug: string; status: TestStatus }> {
  return invokeAdmin({ action: 'setStatus', slug, status })
}

export function adminArchiveTest(slug: string): Promise<{ ok: true; slug: string }> {
  return invokeAdmin({ action: 'delete', slug })
}
