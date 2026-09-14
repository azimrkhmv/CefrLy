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
//
// THREE TABLES, NOT ONE. Reading and Listening are rows in `attempts`; Speaking
// and Writing each have their own table because their papers are not rows in
// `tests` at all (they come from fixtures). A student's record is the union of
// all three, so every one of them has to be fetched and joined here — miss one
// and that whole skill is invisible in the directory, which is exactly what
// happened to Writing between 2026-09-10 and this change.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'
import { isPlanId } from './plans.ts'

const PROFILE_FIELDS =
  'id, name, first_name, last_name, role, plan, plan_expires_at, created_at, onboarded_at, ' +
  'first_exam, self_level, target_band, study_timeframe, weak_areas, daily_minutes, ' +
  'heard_from, heard_from_note, source, father_name, phone, telegram_user_id'

const ATTEMPT_FIELDS =
  'id, user_id, raw_score, total, band, created_at, tests(slug, title, skill, scope, part_number)'

// Speaking is scored out of 75 by the official rating table, not out of 35 like
// Reading/Listening, and it is NOT a row in `attempts` — hence its own fields
// and its own summary rather than reusing the ones above.
const SPEAKING_FIELDS = 'id, user_id, rating, band, scope, status, created_at'
const SPEAKING_DETAIL_FIELDS =
  'id, test_id, test_title, scope, part_type, status, error_message, raw_score, rating, band, result, created_at, graded_at'

// Writing is the same shape as Speaking: its own table, a /75 rating, a band
// only on full papers. NEITHER LIST SELECTS `result` OR `answers` — a marked
// paper carries every correction and the student's whole script, and shipping
// all of that just to draw a row is the bug fetchMyAttempts, fetchSpeakingAttempts
// and fetchWritingAttempts each had to be fixed for. `getWritingAttempt` fetches
// the one row an admin actually opens.
const WRITING_FIELDS = 'id, user_id, rating, band, scope, status, created_at'
const WRITING_DETAIL_FIELDS =
  'id, test_id, test_title, scope, task_type, status, error_message, raw_score, rating, band, created_at, graded_at'

// deno-lint-ignore no-explicit-any
type Row = any

function shapeSpeaking(r: Row) {
  return {
    id: r.id,
    test_id: r.test_id,
    test_title: r.test_title,
    scope: r.scope ?? 'full',
    part_type: r.part_type ?? null,
    status: r.status,
    error_message: r.error_message ?? null,
    raw_score: r.raw_score ?? null,
    rating: r.rating ?? null,
    band: r.band ?? null,
    result: r.result ?? null,
    created_at: r.created_at,
    graded_at: r.graded_at ?? null,
  }
}

function shapeWriting(r: Row) {
  return {
    id: r.id,
    test_id: r.test_id,
    test_title: r.test_title,
    scope: r.scope ?? 'full',
    task_type: r.task_type ?? null,
    status: r.status,
    error_message: r.error_message ?? null,
    raw_score: r.raw_score ?? null,
    rating: r.rating ?? null,
    band: r.band ?? null,
    created_at: r.created_at,
    graded_at: r.graded_at ?? null,
  }
}

/** Last and best band for a /75 skill. Only full papers carry a band — a drill's
 *  score is an estimate from one task or part and would flatter the record.
 *  `rows` must be newest-first. */
function rollupRated(rows: Row[]) {
  const graded = rows.filter((r) => r.status === 'done')
  const banded = graded.filter((r) => r.band !== null && r.scope === 'full')
  const best = banded.reduce(
    (acc: Row | null, r) => (acc === null || (r.rating ?? 0) > (acc.rating ?? 0) ? r : acc),
    null,
  )
  return {
    count: graded.length,
    lastBand: banded[0]?.band ?? null,
    lastRating: banded[0]?.rating ?? null,
    bestRating: best?.rating ?? null,
    lastAt: graded[0]?.created_at ?? null,
  }
}

// Speaking and Writing roll up identically; only the key names differ, and they
// are spelled out rather than built from a prefix so the response shape stays
// greppable from the admin console.
function summariseSpeaking(rows: Row[]) {
  const r = rollupRated(rows)
  return {
    speaking_count: r.count,
    speaking_last_band: r.lastBand,
    speaking_last_rating: r.lastRating,
    speaking_best_rating: r.bestRating,
    speaking_last_at: r.lastAt,
  }
}

function summariseWriting(rows: Row[]) {
  const r = rollupRated(rows)
  return {
    writing_count: r.count,
    writing_last_band: r.lastBand,
    writing_last_rating: r.lastRating,
    writing_best_rating: r.bestRating,
    writing_last_at: r.lastAt,
  }
}

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

      // Speaking lives in its own table (it is not an `attempts` row), so its
      // summary has to be fetched and joined separately.
      const { data: speaking } = await admin
        .from('speaking_attempts')
        .select(SPEAKING_FIELDS)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
      const speakingByUser = new Map<string, Row[]>()
      for (const s of (speaking ?? []) as Row[]) {
        const list = speakingByUser.get(s.user_id)
        if (list) list.push(s)
        else speakingByUser.set(s.user_id, [s])
      }

      // Writing, same story as speaking: its own table, so its own fetch.
      const { data: writing } = await admin
        .from('writing_attempts')
        .select(WRITING_FIELDS)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
      const writingByUser = new Map<string, Row[]>()
      for (const w of (writing ?? []) as Row[]) {
        const list = writingByUser.get(w.user_id)
        if (list) list.push(w)
        else writingByUser.set(w.user_id, [w])
      }

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
            father_name: p?.father_name ?? null,
            phone: p?.phone ?? null,
            role: p?.role ?? 'student',
            plan: p?.plan ?? 'free',
            plan_expires_at: p?.plan_expires_at ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            onboarded_at: p?.onboarded_at ?? null,
            self_level: p?.self_level ?? null,
            target_band: p?.target_band ?? null,
            ...summarise(attemptsByUser.get(u.id) ?? []),
            ...summariseSpeaking(speakingByUser.get(u.id) ?? []),
            ...summariseWriting(writingByUser.get(u.id) ?? []),
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

      const { data: speakingRows } = await admin
        .from('speaking_attempts')
        .select(SPEAKING_DETAIL_FIELDS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      const speakingAttempts = ((speakingRows ?? []) as Row[]).map(shapeSpeaking)

      const { data: writingRows } = await admin
        .from('writing_attempts')
        .select(WRITING_DETAIL_FIELDS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      const writingAttempts = ((writingRows ?? []) as Row[]).map(shapeWriting)

      const { data: rechecks } = await admin
        .from('speaking_recheck_requests')
        .select('id, attempt_id, reason, status, admin_note, created_at, reviewed_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      const shaped = ((attempts ?? []) as Row[]).map(shapeAttempt)
      const p = profile as Row
      return json({
        user: {
          id: authUser.user.id,
          email: authUser.user.email ?? '',
          name: p?.name ?? null,
          first_name: p?.first_name ?? null,
          last_name: p?.last_name ?? null,
          father_name: p?.father_name ?? null,
          phone: p?.phone ?? null,
          telegram_linked: p?.telegram_user_id != null,
          role: p?.role ?? 'student',
          plan: p?.plan ?? 'free',
          plan_expires_at: p?.plan_expires_at ?? null,
          created_at: authUser.user.created_at,
          last_sign_in_at: authUser.user.last_sign_in_at ?? null,
          onboarded_at: p?.onboarded_at ?? null,
          self_level: p?.self_level ?? null,
          target_band: p?.target_band ?? null,
          ...summarise(shaped),
          ...summariseSpeaking(
            ((speakingRows ?? []) as Row[]).filter((r) => r.status === 'done'),
          ),
          ...summariseWriting(
            ((writingRows ?? []) as Row[]).filter((r) => r.status === 'done'),
          ),
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
        speakingAttempts,
        writingAttempts,
        rechecks: rechecks ?? [],
      })
    }

    // Answer a student's "this score is wrong". Any admin may reply — this is
    // support, not a privilege escalation, so it is not super_admin-only.
    case 'resolveRecheck': {
      const recheckId = body.recheckId
      const status = body.status
      const note = body.adminNote
      if (typeof recheckId !== 'string' || !recheckId) {
        return json({ error: 'recheckId is required' }, 400)
      }
      if (status !== 'reviewed' && status !== 'rejected' && status !== 'open') {
        return json({ error: 'status must be open, reviewed or rejected' }, 400)
      }
      const { error } = await admin
        .from('speaking_recheck_requests')
        .update({
          status,
          admin_note: typeof note === 'string' ? note.slice(0, 2000) : null,
          reviewed_at: status === 'open' ? null : new Date().toISOString(),
        })
        .eq('id', recheckId)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    // One marked paper in full. Split out of getUser so the history list stays
    // cheap: `result` holds every correction and `answers` the student's whole
    // script, and an admin opens one of them, not all of them.
    case 'getWritingAttempt': {
      const attemptId = body.attemptId
      if (typeof attemptId !== 'string' || !attemptId) {
        return json({ error: 'attemptId is required' }, 400)
      }
      const { data: row, error } = await admin
        .from('writing_attempts')
        .select('*')
        .eq('id', attemptId)
        .maybeSingle()
      if (error) return json({ error: error.message }, 500)
      if (!row) return json({ error: 'Attempt not found' }, 404)
      return json({ attempt: row })
    }

    // The speaking anomaly queue (migration 0025). The nightly sweep at 02:15
    // UTC writes alert rows and nothing has ever read them back — this is that
    // missing screen's API.
    //
    // `unswept` is the view's own rows minus everything the sweep has already
    // recorded. Without it the queue is up to 24h behind the grade it exists to
    // catch, which for a student disputing a mark today is useless. Dedupe runs
    // against EVERY alert row, open or resolved: an anomaly is a permanent fact
    // about a stored grade, so a resolved one would otherwise reappear here
    // forever as if nobody had looked at it.
    case 'listGradeAlerts': {
      const includeResolved = body.includeResolved === true
      let query = admin
        .from('speaking_grade_alerts')
        .select('id, attempt_id, kind, detail, detected_at, resolved_at, note')
        .order('detected_at', { ascending: false })
        .limit(200)
      if (!includeResolved) query = query.is('resolved_at', null)
      const { data: alertRows, error: alertError } = await query
      if (alertError) return json({ error: alertError.message }, 500)
      const alerts = (alertRows ?? []) as Row[]

      const { data: liveRows, error: liveError } = await admin
        .from('speaking_grade_anomalies')
        .select('attempt_id, user_id, created_at, kind, detail')
        .order('created_at', { ascending: false })
        .limit(200)
      if (liveError) return json({ error: liveError.message }, 500)

      const { data: everySwept } = await admin
        .from('speaking_grade_alerts')
        .select('attempt_id, kind')
      const swept = new Set(
        ((everySwept ?? []) as Row[]).map((a) => `${a.attempt_id}:${a.kind}`),
      )
      const unswept = ((liveRows ?? []) as Row[]).filter(
        (v) => !swept.has(`${v.attempt_id}:${v.kind}`),
      )

      // Name the student and the paper, or the queue is a list of uuids nobody
      // can act on. Two queries for the whole page, never one per row.
      const attemptIds = [...new Set([...alerts, ...unswept].map((r) => r.attempt_id))]
      const owners = new Map<string, Row>()
      if (attemptIds.length) {
        const { data: ownerRows } = await admin
          .from('speaking_attempts')
          .select('id, user_id, test_title, scope, status, rating, band, created_at')
          .in('id', attemptIds)
        const userIds = [...new Set(((ownerRows ?? []) as Row[]).map((r) => r.user_id))]
        const { data: people } = userIds.length
          ? await admin.from('profiles').select('id, name, first_name, last_name').in('id', userIds)
          : { data: [] as Row[] }
        const byUser = new Map(((people ?? []) as Row[]).map((pr) => [pr.id, pr]))
        for (const r of (ownerRows ?? []) as Row[]) {
          owners.set(r.id, { ...r, profile: byUser.get(r.user_id) ?? null })
        }
      }
      const nameOf = (pr: Row | null) => {
        if (!pr) return null
        const joined = [pr.first_name, pr.last_name].filter(Boolean).join(' ').trim()
        return pr.name ?? (joined || null)
      }
      const decorate = (r: Row) => {
        const owner = owners.get(r.attempt_id) ?? null
        return {
          ...r,
          user_id: owner?.user_id ?? r.user_id ?? null,
          user_name: nameOf(owner?.profile ?? null),
          test_title: owner?.test_title ?? null,
          attempt_scope: owner?.scope ?? null,
          attempt_status: owner?.status ?? null,
          rating: owner?.rating ?? null,
          band: owner?.band ?? null,
        }
      }

      return json({ alerts: alerts.map(decorate), unswept: unswept.map(decorate) })
    }

    // Mark one alert seen. This NEVER changes a mark — 0025 built a detector,
    // not a gate — it only records that a human has looked.
    case 'resolveGradeAlert': {
      const alertId = body.alertId
      if (typeof alertId !== 'string' || !alertId) {
        return json({ error: 'alertId is required' }, 400)
      }
      const reopen = body.resolved === false
      const note = typeof body.note === 'string' && body.note.trim()
        ? body.note.trim().slice(0, 2000)
        : null
      const { error } = await admin
        .from('speaking_grade_alerts')
        .update({ resolved_at: reopen ? null : new Date().toISOString(), note })
        .eq('id', alertId)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, alertId, resolved: !reopen })
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

    // Manual plan grant (no checkout wired yet): a super_admin sets a student's
    // plan + optional expiry from /admin/users. Guarded like setUserRole
    // (super_admin only). Every change is written to plan_changes for history.
    case 'setUserPlan': {
      if (callerRole !== 'super_admin') {
        return json({ error: 'Forbidden: super admin access required' }, 403)
      }
      const userId = body.userId
      const plan = body.plan
      if (typeof userId !== 'string' || !userId) return json({ error: 'userId is required' }, 400)
      if (!isPlanId(plan)) {
        return json({ error: "plan must be 'free', 'pro' or 'premium'" }, 400)
      }
      // expiresAt: an ISO date string, or null for no expiry. Free plans never
      // carry an expiry. Reject anything unparseable.
      let expiresAt: string | null = null
      if (plan !== 'free' && body.expiresAt != null) {
        const t = new Date(body.expiresAt as string)
        if (Number.isNaN(t.getTime())) return json({ error: 'expiresAt is not a valid date' }, 400)
        expiresAt = t.toISOString()
      }
      const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

      const { data: target, error: targetError } = await admin
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .maybeSingle()
      if (targetError) return json({ error: targetError.message }, 500)
      if (!target) return json({ error: 'User not found' }, 404)

      const now = new Date().toISOString()
      const { error: updateError } = await admin
        .from('profiles')
        .update({
          plan,
          plan_expires_at: expiresAt,
          plan_source: 'admin',
          plan_updated_at: now,
          plan_updated_by: user.id,
        })
        .eq('id', userId)
      if (updateError) return json({ error: updateError.message }, 500)

      // Best-effort audit row (don't fail the grant if the insert hiccups).
      await admin.from('plan_changes').insert({
        user_id: userId,
        from_plan: target.plan ?? 'free',
        to_plan: plan,
        expires_at: expiresAt,
        changed_by: user.id,
        note,
      })

      return json({ ok: true, userId, plan, plan_expires_at: expiresAt })
    }

    default:
      return json({ error: `Unknown action: ${String(body.action)}` }, 400)
  }
})
