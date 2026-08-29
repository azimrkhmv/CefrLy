// get-entitlements: the signed-in user's plan + this month's usage against the
// plan's caps. Read-only; the browser uses it to show the plan, remaining
// allowances and upgrade prompts. Enforcement itself lives in start-session —
// this endpoint only REPORTS, so a tampered client can't gain anything.
//
// Usage = SUBMITTED attempts in the current calendar month (UTC), classified by
// action type (full mock / reading set / listening set / writing / speaking).
// Admins & super_admins are unlimited regardless of plan.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'
import {
  ACTION_TYPES,
  actionForTest,
  effectivePlan,
  hasPremiumAccess,
  monthEndUTC,
  monthStartUTC,
  PLAN_LIMITS,
  type ActionType,
  type PlanId,
} from './plans.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, plan, plan_expires_at')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) return json({ error: profileError.message }, 500)

  const role = profile?.role ?? 'student'
  const isStaff = role === 'admin' || role === 'super_admin'
  const storedPlan = (profile?.plan ?? 'free') as PlanId
  const planExpiresAt = (profile?.plan_expires_at as string | null) ?? null
  // Staff bypass all caps; otherwise an expired paid plan resolves to free.
  const plan: PlanId = isStaff ? 'premium' : effectivePlan(storedPlan, planExpiresAt)
  const premiumAccess = isStaff || hasPremiumAccess(plan)
  const limits = isStaff ? PLAN_LIMITS.premium : PLAN_LIMITS[plan]

  const periodStart = monthStartUTC()
  // Usage counts PREMIUM-test attempts only — free tests are unlimited and
  // never metered.
  const usedByAction = await countPremiumSubmittedThisMonth(admin, user.id, periodStart)

  // Speaking checks are NOT rows in `attempts` — they live in speaking_attempts,
  // written by grade-speaking. Counted here with the SAME rule the gate uses
  // (completed checks only), so the meter a student sees can never disagree
  // with what actually blocks them.
  const { count: speakingUsed } = await admin
    .from('speaking_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'done')
    .gte('created_at', periodStart)
  usedByAction.speaking_check = speakingUsed ?? 0

  const usage = Object.fromEntries(
    ACTION_TYPES.map((a) => {
      const used = usedByAction[a] ?? 0
      const limit = limits[a]
      return [a, { used, limit, remaining: limit === null ? null : Math.max(0, limit - used) }]
    }),
  )

  return json({
    plan,
    storedPlan,
    planExpiresAt,
    isStaff,
    premiumAccess,
    periodStart,
    periodEnd: monthEndUTC(),
    limits,
    usage,
  })
})

// deno-lint-ignore no-explicit-any
type Client = any

/** Count the user's SUBMITTED PREMIUM-test attempts this month, by action type
 *  (free-test attempts are unlimited and never counted). */
async function countPremiumSubmittedThisMonth(
  admin: Client,
  userId: string,
  since: string,
): Promise<Record<ActionType, number>> {
  const counts = Object.fromEntries(ACTION_TYPES.map((a) => [a, 0])) as Record<ActionType, number>
  const { data } = await admin
    .from('attempts')
    .select('id, tests(skill, scope, access)')
    .eq('user_id', userId)
    .gte('created_at', since)
  for (const row of (data ?? []) as Client[]) {
    const t = Array.isArray(row.tests) ? row.tests[0] : row.tests
    if (!t || t.access !== 'premium') continue
    const skill = t?.skill ?? 'reading'
    const scope = t?.scope === 'part' ? 'part' : 'full'
    counts[actionForTest(skill, scope)] += 1
  }
  return counts
}
