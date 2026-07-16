import { supabase } from './supabase'
import { abandonDeadSession } from './sessionExpiry'
import type { AnyTest, CefrLevel } from '../types/test'
import type { SampleCategory, SampleContent } from '../types/sample'

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
  /** 'part' = single-part drill; missing on rows read before migration 0010. */
  scope?: 'full' | 'part'
  part_number?: number | null
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
      // A dead session (401) reads as a confusing admin error otherwise; the
      // function 403s — not 401s — a signed-in non-admin, so this is safe.
      if (ctx.status === 401) await abandonDeadSession()
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

export function adminGetTest(slug: string): Promise<{ test: AdminTestMeta; content: AnyTest }> {
  return invokeAdmin({ action: 'get', slug })
}

export function adminUpsertTest(
  slug: string,
  content: AnyTest,
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

// --- admin-users (super admin only) ----------------------------------------

export interface AdminUserRow {
  id: string
  email: string
  name: string | null
  role: 'student' | 'admin' | 'super_admin'
  created_at: string
}

async function invokeUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    let message = 'User management request failed.'
    const ctx = (error as { context?: Response }).context
    if (ctx) {
      if (ctx.status === 401) await abandonDeadSession()
      try {
        const parsed = (await ctx.json()) as { error?: string }
        if (parsed.error) message = parsed.error
      } catch {
        // keep generic message
      }
    }
    throw new Error(message)
  }
  return data as T
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const { users } = await invokeUsers<{ users: AdminUserRow[] }>({ action: 'listUsers' })
  return users
}

export function adminSetUserRole(
  userId: string,
  role: 'student' | 'admin',
): Promise<{ ok: true; userId: string; role: string }> {
  return invokeUsers({ action: 'setUserRole', userId, role })
}

// --- admin-samples (Writing/Speaking model-answer library) -----------------
// Same shape as the tests client: role-gated edge function, validator errors
// surface as ValidationError so the form can list them.

export type SampleStatus = 'draft' | 'published' | 'archived'

export interface AdminSampleRow {
  id: string
  slug: string
  category: SampleCategory
  badge: string
  title: string
  status: SampleStatus
  sort_order: number
  created_at: string
}

export interface AdminSampleFull extends AdminSampleRow {
  content: SampleContent
}

export interface SampleUpsertInput {
  slug: string
  category: SampleCategory
  badge: string
  title: string
  content: SampleContent
  status: 'draft' | 'published'
  sortOrder: number
}

async function invokeSamples<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-samples', { body })
  if (error) {
    let message = 'Samples request failed.'
    const ctx = (error as { context?: Response }).context
    if (ctx) {
      if (ctx.status === 401) await abandonDeadSession()
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

export async function adminListSamples(): Promise<AdminSampleRow[]> {
  const { samples } = await invokeSamples<{ samples: AdminSampleRow[] }>({ action: 'list' })
  return samples
}

export async function adminGetSample(slug: string): Promise<AdminSampleFull> {
  const { sample } = await invokeSamples<{ sample: AdminSampleFull }>({ action: 'get', slug })
  return sample
}

export function adminUpsertSample(
  input: SampleUpsertInput,
): Promise<{ ok: true; slug: string; id: string }> {
  return invokeSamples({ action: 'upsert', ...input })
}

export function adminSetSampleStatus(
  slug: string,
  status: 'draft' | 'published',
): Promise<{ ok: true; slug: string; status: SampleStatus }> {
  return invokeSamples({ action: 'setStatus', slug, status })
}

export function adminArchiveSample(slug: string): Promise<{ ok: true; slug: string; status: 'archived' }> {
  return invokeSamples({ action: 'delete', slug })
}
