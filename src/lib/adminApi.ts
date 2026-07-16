import { supabase } from './supabase'
import { abandonDeadSession } from './sessionExpiry'
import type { AnyTest, Band, CefrLevel } from '../types/test'
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

// --- admin-users (directory reads: admin+; role changes: super admin) -------

export type UserRole = 'student' | 'admin' | 'super_admin'

export interface AdminUserRow {
  id: string
  email: string
  name: string | null
  first_name: string | null
  last_name: string | null
  role: UserRole
  created_at: string
  last_sign_in_at: string | null
  onboarded_at: string | null
  self_level: string | null
  target_band: string | null
  /** Every attempt, drills included. */
  attempts_count: number
  /** Full mocks only — the subset that carries a band. */
  mocks_count: number
  last_attempt_at: string | null
  last_band: Band | null
  last_score: number | null
  last_total: number | null
  last_skill: string | null
  last_test_title: string | null
  last_mock_at: string | null
  best_band: Band | null
  best_score: number | null
  best_total: number | null
}

export interface AdminAttemptRow {
  id: string
  created_at: string
  raw_score: number
  total: number
  band: Band | null
  test_slug: string | null
  test_title: string | null
  skill: string | null
  scope: 'full' | 'part'
  part_number: number | null
}

export interface AdminUserOnboarding {
  first_exam: string | null
  self_level: string | null
  target_band: string | null
  study_timeframe: string | null
  weak_areas: string[] | null
  daily_minutes: number | null
  heard_from: string | null
  heard_from_note: string | null
  source: string | null
}

export interface AdminUserDetail {
  user: AdminUserRow
  onboarding: AdminUserOnboarding
  attempts: AdminAttemptRow[]
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

export function adminGetUser(userId: string): Promise<AdminUserDetail> {
  return invokeUsers({ action: 'getUser', userId })
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
