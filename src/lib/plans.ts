import type { ActionType, PlanId, PlanLimits } from '../types/plan'

// CANONICAL plan limits — the single source of truth for the frontend. The
// edge functions carry a byte-identical copy (supabase/functions/*/plans.ts);
// keep the two in lockstep. `null` = unlimited.
//
// PLAN_LIMITS = the monthly caps on PREMIUM tests only. Free tests are open to
// everyone, unlimited, and counted toward nothing. The free plan can't open
// premium tests at all (its row is all zeros and never consulted — the gate
// blocks free-plan users first). null = unlimited. Numbers off the pricing page:
//   Pro     → 5 premium mocks/mo, ∞ reading, ∞ listening, 10 writing, 10 speaking
//   Premium → everything unlimited
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    full_mock: 0,
    reading_set: 0,
    listening_set: 0,
    writing_check: 0,
    speaking_check: 0,
  },
  pro: {
    full_mock: 5,
    reading_set: null,
    listening_set: null,
    writing_check: 10,
    speaking_check: 10,
  },
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

export const PLAN_META: Record<PlanId, { name: string; order: number; price: string }> = {
  free: { name: 'Free', order: 0, price: 'Free' },
  pro: { name: 'Pro', order: 1, price: "75 000 so'm" },
  premium: { name: 'Premium', order: 2, price: "100 000 so'm" },
}

export const ACTION_LABEL: Record<ActionType, string> = {
  full_mock: 'Full mock tests',
  reading_set: 'Reading sets',
  listening_set: 'Listening sets',
  writing_check: 'Writing checks',
  speaking_check: 'Speaking checks',
}

/** Singular label for a metered action (used in "You've used your Free mock"). */
export const ACTION_LABEL_ONE: Record<ActionType, string> = {
  full_mock: 'full mock test',
  reading_set: 'reading set',
  listening_set: 'listening set',
  writing_check: 'writing check',
  speaking_check: 'speaking check',
}

/** Which quota a test draws from. Mirrors the edge-function copy exactly. */
export function actionForTest(skill: string, scope: 'full' | 'part'): ActionType {
  if (skill === 'writing') return 'writing_check'
  if (skill === 'speaking') return 'speaking_check'
  if (scope === 'full') return 'full_mock'
  return skill === 'listening' ? 'listening_set' : 'reading_set'
}

export function isUnlimited(limit: number | null): boolean {
  return limit === null
}

/** True once a paid plan's expiry has passed (paid → treated as free). */
export function isExpired(planExpiresAt: string | null): boolean {
  return planExpiresAt !== null && new Date(planExpiresAt).getTime() < Date.now()
}

/** The plan actually in force right now (expired paid plans fall back to free). */
export function effectivePlan(plan: PlanId, planExpiresAt: string | null): PlanId {
  if (plan !== 'free' && isExpired(planExpiresAt)) return 'free'
  return plan
}
