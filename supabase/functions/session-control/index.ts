// session-control: pause / resume a PRACTICE session's timer (server-side, so
// the deadline the browser sees stays authoritative), plus cancel.
//   pause  → freeze: record paused_at. Remaining time = expires_at - paused_at
//            stays constant while frozen.
//   resume → shift expires_at forward by however long it was paused, then clear
//            paused_at, so the student gets back exactly the time they had.
//   cancel → abandon the attempt: close the session (submitted_at) WITHOUT
//            grading or writing an attempts row. Any mode, any skill — leaving
//            the exam cancels the attempt entirely (no resume).
// Simulation sessions cannot be paused. All actions are idempotent.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { sessionId?: unknown; action?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { sessionId, action } = body
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return json({ error: 'sessionId is required' }, 400)
  }
  if (action !== 'pause' && action !== 'resume' && action !== 'cancel') {
    return json({ error: 'action must be "pause", "resume" or "cancel"' }, 400)
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

  // Ownership + still-open check baked into the lookup.
  const { data: session, error: sessionError } = await admin
    .from('test_sessions')
    .select('id, started_at, expires_at, mode, duration_sec, paused_at, submitted_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (sessionError) return json({ error: sessionError.message }, 500)

  // Cancel: any mode, idempotent — a missing or already-closed session means
  // there is nothing left to abandon, so that's a success too.
  if (action === 'cancel') {
    if (!session || session.submitted_at) return json({ ok: true })
    const { error } = await admin
      .from('test_sessions')
      .update({ submitted_at: new Date().toISOString() })
      .eq('id', session.id)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  }

  if (!session || session.submitted_at) {
    return json({ error: 'Session not found or already submitted' }, 409)
  }
  if (session.mode !== 'practice') {
    return json({ error: 'Only practice tests can be paused' }, 403)
  }

  const now = Date.now()

  if (action === 'pause') {
    if (session.paused_at) return json({ session: serializeSession(session) }) // already paused
    const { data: updated, error } = await admin
      .from('test_sessions')
      .update({ paused_at: new Date(now).toISOString() })
      .eq('id', session.id)
      .select('id, started_at, expires_at, mode, duration_sec, paused_at')
      .single()
    if (error || !updated) return json({ error: error?.message ?? 'Could not pause' }, 500)
    return json({ session: serializeSession(updated) })
  }

  // resume
  if (!session.paused_at) return json({ session: serializeSession(session) }) // already running
  const pausedSpanMs = now - new Date(session.paused_at).getTime()
  const newExpiry = new Date(new Date(session.expires_at).getTime() + pausedSpanMs).toISOString()
  const { data: updated, error } = await admin
    .from('test_sessions')
    .update({ expires_at: newExpiry, paused_at: null })
    .eq('id', session.id)
    .select('id, started_at, expires_at, mode, duration_sec, paused_at')
    .single()
  if (error || !updated) return json({ error: error?.message ?? 'Could not resume' }, 500)
  return json({ session: serializeSession(updated) })
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
