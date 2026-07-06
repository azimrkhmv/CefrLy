// session-status: a READ-ONLY peek — NO session is created.
// Returns the test's public metadata (skill / title / duration) and the user's
// currently-open session if one exists. The reading exam calls this first to
// decide whether to show the "Choose a mode" picker (no open session) or to
// resume an attempt already in progress. Listening skips the picker entirely.
//
// Creating the session is deliberately NOT done here (that's start-session /
// get-test) so opening this endpoint can never start a clock.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let testId: unknown
  try {
    ;({ testId } = await req.json())
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (typeof testId !== 'string' || testId.length === 0) {
    return json({ error: 'testId is required' }, 400)
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
    .select('id, title, skill, duration_sec, status, scope, part_number')
    .eq('id', testId)
    .maybeSingle()
  if (testError) return json({ error: testError.message }, 500)
  if (!test || test.status !== 'published') return json({ error: 'Test not found' }, 404)

  const session = await findActiveSession(admin, user.id, testId)

  return json({
    skill: test.skill,
    title: test.title,
    durationSec: test.duration_sec,
    // 'part' = a single-part drill: the client skips the mode picker and
    // auto-starts practice with the test's own duration.
    scope: test.scope ?? 'full',
    partNumber: test.part_number ?? null,
    serverNow: new Date().toISOString(),
    session: session ? serializeSession(session) : null,
  })
})

// The newest open (unsubmitted, not-yet-expired) session, or null. A PAUSED
// practice session never counts as expired while it is frozen.
// deno-lint-ignore no-explicit-any
export async function findActiveSession(admin: any, userId: string, testId: string) {
  const { data } = await admin
    .from('test_sessions')
    .select('id, started_at, expires_at, submitted_at, mode, duration_sec, paused_at')
    .eq('user_id', userId)
    .eq('test_id', testId)
    .is('submitted_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const now = Date.now()
  const effectiveDeadline = data.paused_at
    ? new Date(data.expires_at).getTime() + (now - new Date(data.paused_at).getTime())
    : new Date(data.expires_at).getTime()
  return now > effectiveDeadline ? null : data
}

// deno-lint-ignore no-explicit-any
export function serializeSession(s: any) {
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
