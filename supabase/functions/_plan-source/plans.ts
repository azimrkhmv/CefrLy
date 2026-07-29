// CANONICAL Deno copy of the plan config — MIRROR of src/lib/plans.ts.
// Supabase deploys each function from its own directory (no shared imports),
// so this file is duplicated into every function that needs it
// (start-session, get-entitlements, admin-users). Edit this master copy, then
// re-copy it into those dirs. Keep the numbers identical to src/lib/plans.ts
// and the pricing page.

export type PlanId = 'free' | 'pro' | 'premium'

/** A test is open to everyone ('free') or gated to paid plans ('premium'). */
export type TestAccess = 'free' | 'premium'

export type ActionType =
  | 'full_mock'
  | 'reading_set'
  | 'listening_set'
  | 'writing_check'
  | 'speaking_check'

export type PlanLimits = Record<ActionType, number | null>

// PLAN_LIMITS = the monthly caps on PREMIUM tests only (free tests are unlimited
// for everyone and never counted). null = unlimited. The free plan can't open
// premium tests at all, so its row is all zeros and never actually consulted
// (the gate blocks free-plan users before the limit check).
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { full_mock: 0, reading_set: 0, listening_set: 0, writing_check: 0, speaking_check: 0 },
  pro: { full_mock: 5, reading_set: null, listening_set: null, writing_check: 10, speaking_check: 10 },
  premium: {
    full_mock: null,
    reading_set: null,
    listening_set: null,
    writing_check: null,
    speaking_check: null,
  },
}

/** Whether a plan may open premium tests at all (Pro & Premium; not Free). */
export function hasPremiumAccess(plan: PlanId): boolean {
  return plan === 'pro' || plan === 'premium'
}

export const ACTION_TYPES: ActionType[] = [
  'full_mock',
  'reading_set',
  'listening_set',
  'writing_check',
  'speaking_check',
]

export function isPlanId(v: unknown): v is PlanId {
  return v === 'free' || v === 'pro' || v === 'premium'
}

/** Which quota a test draws from. Mirrors src/lib/plans.ts exactly. */
export function actionForTest(skill: string, scope: 'full' | 'part'): ActionType {
  if (skill === 'writing') return 'writing_check'
  if (skill === 'speaking') return 'speaking_check'
  if (scope === 'full') return 'full_mock'
  return skill === 'listening' ? 'listening_set' : 'reading_set'
}

/** The plan actually in force (an expired paid plan falls back to free). */
export function effectivePlan(plan: PlanId, planExpiresAt: string | null): PlanId {
  if (plan !== 'free' && planExpiresAt !== null && new Date(planExpiresAt).getTime() < Date.now()) {
    return 'free'
  }
  return plan
}

/** First instant of the current calendar month, UTC — the usage window start. */
export function monthStartUTC(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

/** First instant of NEXT calendar month, UTC — the usage window end. */
export function monthEndUTC(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
}
