// admin-users: the user directory + role management.
//
// Gate: listUsers/getUser require admin OR super_admin — any admin may read the
// directory and student results. setUserRole stays super_admin-only; handing out
// roles is the owner's alone. setUserRole guardrails are unchanged: super_admin
// can never be granted or removed through this API (protects the owner from
// lockout and admins from privilege escalation), and callers cannot change their
// own role.
//
// Bands are full-mock-only by design (part drills store band NULL — a /6 drill
// score means nothing on the 28/18/10 thresholds), so "last band" and "best"
// summarise ONLY attempts where band IS NOT NULL. Drills still count toward
// attempts_count and last_attempt_at.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'

const PROFILE_FIELDS =
  'id, name, first_name, last_name, role, created_at, onboarded_at, first_exam, ' +
  'self_level, target_band, study_timeframe, weak_areas, daily_minutes, ' +
  'heard_from, heard_from_note, source'

const ATTEMPT_FIELDS =
  'id, user_id, raw_score, total, band, created_at, tests(slug, title, skill, scope, part_number)'

// deno-lint-ignore no-explicit-any
type Row = any

/** Flatten the embedded test (PostgREST returns to-one embeds as an object). */
function shapeAttempt(a: Row) {
  const test = Array.isArray(a.tests) ? a.tests[0] : a.tests
  return {
    id: a.id,
    created_at: a.created_at,
    raw_score: a.raw_score,
    total: a.total,
    band: a.band ?? null,
    test_slug: test?.slug ?? null,
    test_title: test?.title ?? null,
    skill: test?.skill ?? null,
    scope: test?.scope ?? 'full',
    part_number: test?.part_number ?? null,
  }
}

/** Per-user rollup. `attempts` must be newest-first. */
function summarise(attempts: ReturnType<typeof shapeAttempt>[]) {
  const banded = attempts.filter((a) => a.band !== null)
  const last = banded[0] ?? null
  const best = banded.reduce(
    (acc: typeof banded[number] | null, a) =>
      acc === null || a.raw_score > acc.raw_score ? a : acc,
    null,
  )
  return {
    attempts_count: attempts.length,
    mocks_count: banded.length,
    last_attempt_at: attempts[0]?.created_at ?? null,
    last_band: last?.band ?? null,
    last_score: last?.raw_score ?? null,
    last_total: last?.total ?? null,
    last_skill: last?.skill ?? null,
    last_test_title: last?.test_title ?? null,
    last_mock_at: last?.created_at ?? null,
    best_band: best?.band ?? null,
    best_score: best?.raw_score ?? null,
    best_total: best?.total ?? null,
  }
}

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

  // Re-check the caller's role server-side; never trust a client claim.
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const callerRole = caller?.role
  const isAdmin = callerRole === 'admin' || callerRole === 'super_admin'
  if (!isAdmin) return json({ error: 'Forbidden: admin access required' }, 403)

  // deno-lint-ignore no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  switch (body.action) {
    // The directory: one row per account, with its result rollup.
    case 'listUsers': {
      const { data: authUsers, error: listError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
      if (listError) return json({ error: listError.message }, 500)

      const { data: profiles, error: profilesError } = await admin
        .from('profiles')
        .select(PROFILE_FIELDS)
      if (profilesError) return json({ error: profilesError.message }, 500)

      const { data: attempts, error: attemptsError } = await admin
        .from('attempts')
        .select(ATTEMPT_FIELDS)
        .order('created_at', { ascending: false })
      if (attemptsError) return json({ error: attemptsError.message }, 500)

      const byId = new Map<string, Row>((profiles ?? []).map((p: Row) => [p.id, p]))
      const attemptsByUser = new Map<string, ReturnType<typeof shapeAttempt>[]>()
      for (const a of (attempts ?? []) as Row[]) {
        const list = attemptsByUser.get(a.user_id)
        if (list) list.push(shapeAttempt(a))
        else attemptsByUser.set(a.user_id, [shapeAttempt(a)])
      }

      const users = authUsers.users
        .map((u) => {
          const p = byId.get(u.id)
          return {
            id: u.id,
            email: u.email ?? '',
            name: p?.name ?? null,
            first_name: p?.first_name ?? null,
            last_name: p?.last_name ?? null,
            role: p?.role ?? 'student',
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            onboarded_at: p?.onboarded_at ?? null,
            self_level: p?.self_level ?? null,
            target_band: p?.target_band ?? null,
            ...summarise(attemptsByUser.get(u.id) ?? []),
          }
        })
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) // newest signup first
      return json({ users })
    }

    // One account in full: every onboarding answer + the whole attempt history.
    case 'getUser': {
      const userId = body.userId
      if (typeof userId !== 'string' || !userId) return json({ error: 'userId is required' }, 400)

      const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId)
      if (authError) return json({ error: authError.message }, 404)
      if (!authUser?.user) return json({ error: 'User not found' }, 404)

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select(PROFILE_FIELDS)
        .eq('id', userId)
        .maybeSingle()
      if (profileError) return json({ error: profileError.message }, 500)

      const { data: attempts, error: attemptsError } = await admin
        .from('attempts')
        .select(ATTEMPT_FIELDS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (attemptsError) return json({ error: attemptsError.message }, 500)

      const shaped = ((attempts ?? []) as Row[]).map(shapeAttempt)
      const p = profile as Row
      return json({
        user: {
          id: authUser.user.id,
          email: authUser.user.email ?? '',
          name: p?.name ?? null,
          first_name: p?.first_name ?? null,
          last_name: p?.last_name ?? null,
          role: p?.role ?? 'student',
          created_at: authUser.user.created_at,
          last_sign_in_at: authUser.user.last_sign_in_at ?? null,
          onboarded_at: p?.onboarded_at ?? null,
          self_level: p?.self_level ?? null,
          target_band: p?.target_band ?? null,
          ...summarise(shaped),
        },
        onboarding: {
          first_exam: p?.first_exam ?? null,
          self_level: p?.self_level ?? null,
          target_band: p?.target_band ?? null,
          study_timeframe: p?.study_timeframe ?? null,
          weak_areas: p?.weak_areas ?? null,
          daily_minutes: p?.daily_minutes ?? null,
          heard_from: p?.heard_from ?? null,
          heard_from_note: p?.heard_from_note ?? null,
          source: p?.source ?? null,
        },
        attempts: shaped,
      })
    }

    case 'setUserRole': {
      // Reads are open to admins; handing out roles is not.
      if (callerRole !== 'super_admin') {
        return json({ error: 'Forbidden: super admin access required' }, 403)
      }
      const userId = body.userId
      const role = body.role
      if (typeof userId !== 'string' || !userId) return json({ error: 'userId is required' }, 400)
      if (role !== 'student' && role !== 'admin') {
        return json({ error: "role must be 'student' or 'admin' — super_admin is not assignable" }, 400)
      }
      if (userId === user.id) {
        return json({ error: 'You cannot change your own role' }, 400)
      }
      const { data: target, error: targetError } = await admin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      if (targetError) return json({ error: targetError.message }, 500)
      if (!target) return json({ error: 'User not found' }, 404)
      if (target.role === 'super_admin') {
        return json({ error: 'The super admin role cannot be changed through this API' }, 400)
      }
      const { error: updateError } = await admin
        .from('profiles')
        .update({ role })
        .eq('id', userId)
      if (updateError) return json({ error: updateError.message }, 500)
      return json({ ok: true, userId, role })
    }

    default:
      return json({ error: `Unknown action: ${String(body.action)}` }, 400)
  }
})
