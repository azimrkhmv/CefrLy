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
//
// Durations are decided SERVER-SIDE — the browser cannot request an arbitrary
// length. Answer keys are never touched here.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'

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
    .select('id, skill, duration_sec, status')
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

  // The duration is decided here, never trusted from the client.
  let durationSec = test.duration_sec as number
  if (test.skill === 'listening') {
    // Audio-paced: no student-facing clock in either mode. Long hygiene window
    // only — the UI shows no timer, so a short expiry would be a surprise 409
    // at submit time.
    durationSec = LISTENING_WINDOW_SEC
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
