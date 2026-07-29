// start-session: an explicit "Start Now" in the chosen mode. Any session still
// open for this test is closed first, so the new mode really takes effect
// (resuming an in-progress attempt bypasses this — the Resume button goes
// straight to get-test, which reuses the open session).
//
// READING (clock-based):
//   simulation → the test's real duration, no pause.
//   practice   → a student-chosen 20–90 min (10-min steps), pausable.
// LISTENING (audio-based): NO student-facing clock in either mode — the
//   recordings set the pace (simulation locks them to two plays; practice
//   frees them). The session still gets a LONG housekeeping expiry so open
//   rows can't live forever, but no timer is shown and any client-sent
//   duration is ignored.
// PART tests (scope='part'): always the author-set duration — no picker.
//
// Durations are decided SERVER-SIDE — the browser cannot request an arbitrary
// length. Answer keys are never touched here.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'
import {
  actionForTest,
  effectivePlan,
  hasPremiumAccess,
  monthStartUTC,
  PLAN_LIMITS,
  type ActionType,
  type PlanId,
  type TestAccess,
} from './plans.ts'

const PRACTICE_MIN_SEC = 20 * 60 // 1200
const PRACTICE_MAX_SEC = 90 * 60 // 5400
const PRACTICE_STEP_SEC = 10 * 60 // 600
const LISTENING_WINDOW_SEC = 6 * 3600 // hidden housekeeping bound, never displayed

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { testId?: unknown; mode?: unknown; durationSec?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { testId, mode } = body
  if (typeof testId !== 'string' || testId.length === 0) {
    return json({ error: 'testId is required' }, 400)
  }
  if (mode !== 'simulation' && mode !== 'practice') {
    return json({ error: 'mode must be "simulation" or "practice"' }, 400)
  }

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

  const { data: test, error: testError } = await admin
    .from('tests')
    .select('id, skill, duration_sec, status, scope, access')
    .eq('id', testId)
    .maybeSingle()
  if (testError) return json({ error: testError.message }, 500)
  if (!test || test.status !== 'published') return json({ error: 'Test not found' }, 404)

  // Choosing a mode is a deliberate "start this attempt" — close any session
  // still open for this test so the NEW mode/duration takes effect. (Resuming an
  // in-progress attempt goes through get-test and never calls this; a plain
  // refresh resumes too. Only an explicit fresh pick reaches here.)
  await admin
    .from('test_sessions')
    .update({ submitted_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('test_id', testId)
    .is('submitted_at', null)

  // --- Access gate ----------------------------------------------------------
  // FREE tests are open to everyone (no gate, no counting). PREMIUM tests need a
  // paid plan: the free plan is blocked outright; Pro is capped monthly (pricing
  // page); Premium and staff are unlimited. Runs AFTER closing this test's own
  // open session, so re-picking the same test never counts against itself.
  const scope = test.scope === 'part' ? 'part' : 'full'
  const action = actionForTest(test.skill as string, scope)
  const access: TestAccess = test.access === 'free' ? 'free' : 'premium'
  const gate = await enforceAccess(admin, user.id, testId, action, access)
  if (gate) return gate

  // The duration is decided here, never trusted from the client.
  let durationSec = test.duration_sec as number
  if (test.skill === 'listening') {
    // Audio-paced: no student-facing clock in either mode. Long hygiene window
    // only — the UI shows no timer, so a short expiry would be a surprise 409
    // at submit time.
    durationSec = LISTENING_WINDOW_SEC
  } else if (test.scope === 'part') {
    // Single-part reading drills always run with the author-set duration —
    // there is no mode picker, so the 20–90 min practice rule never applies.
    durationSec = test.duration_sec as number
  } else if (mode === 'practice') {
    const requested = body.durationSec
    if (typeof requested !== 'number' || !Number.isFinite(requested)) {
      return json({ error: 'durationSec (seconds) is required for practice' }, 400)
    }
    if (
      requested < PRACTICE_MIN_SEC ||
      requested > PRACTICE_MAX_SEC ||
      (requested - PRACTICE_MIN_SEC) % PRACTICE_STEP_SEC !== 0
    ) {
      return json({ error: 'Practice time must be 20–90 minutes in 10-minute steps' }, 400)
    }
    durationSec = requested
  }

  const expiresAt = new Date(Date.now() + durationSec * 1000).toISOString()
  const { data: created, error: createError } = await admin
    .from('test_sessions')
    .insert({
      user_id: user.id,
      test_id: testId,
      mode,
      duration_sec: durationSec,
      expires_at: expiresAt,
    })
    .select('id, started_at, expires_at, mode, duration_sec, paused_at')
    .single()
  if (createError || !created) {
    return json({ error: createError?.message ?? 'Could not start test session' }, 500)
  }
  return json({ session: serializeSession(created) })
})

// deno-lint-ignore no-explicit-any
type Client = any

// Returns a 403 Response when the caller may not start this test, or null to
// allow it. FREE tests always pass. PREMIUM tests: free plan is blocked
// (code:'premium_only'); Pro is capped monthly per the pricing page
// (code:'plan_limit'); Premium and staff pass. "Used" for the Pro cap counts
// only PREMIUM-test attempts this calendar month PLUS still-open premium
// sessions on OTHER tests (free tests never count toward anything).
async function enforceAccess(
  admin: Client,
  userId: string,
  testId: string,
  action: ActionType,
  access: TestAccess,
): Promise<Response | null> {
  if (access === 'free') return null // open to everyone, no plan, no counting

  const { data: profile } = await admin
    .from('profiles')
    .select('role, plan, plan_expires_at')
    .eq('id', userId)
    .maybeSingle()

  const role = profile?.role ?? 'student'
  if (role === 'admin' || role === 'super_admin') return null // staff: unlimited

  const storedPlan = (profile?.plan ?? 'free') as PlanId
  const plan = effectivePlan(storedPlan, (profile?.plan_expires_at as string | null) ?? null)

  // Free plan can't open premium tests at all — it's an upgrade wall, not a cap.
  if (!hasPremiumAccess(plan)) {
    return json(
      {
        error: 'This is a Premium test. Upgrade to Pro or Premium to unlock it.',
        code: 'premium_only',
        action,
        plan,
      },
      403,
    )
  }

  const limit = PLAN_LIMITS[plan][action]
  if (limit === null) return null // Premium plan: unlimited

  // Pro: monthly cap on PREMIUM tests of this action type.
  const since = monthStartUTC()
  const nowIso = new Date().toISOString()

  const { data: attempts } = await admin
    .from('attempts')
    .select('id, tests(skill, scope, access)')
    .eq('user_id', userId)
    .gte('created_at', since)
  let used = 0
  for (const row of (attempts ?? []) as Client[]) {
    if (premiumActionOf(row.tests) === action) used += 1
  }

  const { data: openSessions } = await admin
    .from('test_sessions')
    .select('test_id, expires_at, tests(skill, scope, access)')
    .eq('user_id', userId)
    .is('submitted_at', null)
    .neq('test_id', testId)
    .gt('expires_at', nowIso)
  for (const row of (openSessions ?? []) as Client[]) {
    if (premiumActionOf(row.tests) === action) used += 1
  }

  if (used < limit) return null

  return json(
    {
      error: 'You’ve used this month’s premium limit on your plan. Go Premium for unlimited.',
      code: 'plan_limit',
      action,
      plan,
      limit,
      used,
    },
    403,
  )
}

/** Action type of an embedded PREMIUM test row, or null if it's free/missing. */
function premiumActionOf(tests: unknown): ActionType | null {
  const t = Array.isArray(tests)
    ? tests[0]
    : (tests as { skill?: string; scope?: string; access?: string } | null)
  if (!t || t.access !== 'premium') return null
  const skill = t.skill ?? 'reading'
  const scope = t.scope === 'part' ? 'part' : 'full'
  return actionForTest(skill, scope)
}

// deno-lint-ignore no-explicit-any
function serializeSession(s: any) {
  return {
    id: s.id,
    startedAt: s.started_at,
    expiresAt: s.expires_at,
    mode: s.mode ?? 'simulation',
    durationSec: s.duration_sec ?? null,
    pausedAt: s.paused_at ?? null,
    serverNow: new Date().toISOString(),
  }
}
