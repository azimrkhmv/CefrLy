// Subscription plans — the canonical shape shared by the pricing page, the
// entitlements display and (mirrored) the edge functions that enforce them.
//
// Plans mirror the pricing page: free (default) | pro | premium. Free caps
// reset each calendar month (UTC); paid caps are monthly too. `null` in a limit
// means UNLIMITED.

export type PlanId = 'free' | 'pro' | 'premium'

/** A test is open to everyone ('free') or gated to paid plans ('premium'). */
export type TestAccess = 'free' | 'premium'

// The metered actions. reading/listening "sets" = single-part drills; a
// "full mock" = a complete paper (any skill). writing/speaking checks are
// schema-ready for when those skills ship.
export type ActionType =
  | 'full_mock'
  | 'reading_set'
  | 'listening_set'
  | 'writing_check'
  | 'speaking_check'

/** A per-action monthly limit; null = unlimited. */
export type PlanLimits = Record<ActionType, number | null>

/** One action's usage this period (used counts SUBMITTED attempts this month). */
export interface ActionUsage {
  used: number
  limit: number | null
  /** limit - used, floored at 0; null when the limit is unlimited. */
  remaining: number | null
}

/** What get-entitlements returns for the signed-in user. */
export interface Entitlements {
  /** Effective plan (an expired paid plan resolves to 'free'). */
  plan: PlanId
  /** What's actually stored on the profile (before expiry resolution). */
  storedPlan: PlanId
  planExpiresAt: string | null
  /** Admins/super_admins are unlimited regardless of plan. */
  isStaff: boolean
  /** Whether this user can open premium tests at all (Pro/Premium or staff). */
  premiumAccess: boolean
  /** Current usage window (calendar month, UTC). */
  periodStart: string
  periodEnd: string
  limits: PlanLimits
  usage: Record<ActionType, ActionUsage>
}
