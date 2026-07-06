// get-test: returns a SANITIZED test to the browser plus the user's test
// session (server-side start/expiry time).
// Every `answer` and `explanation` field is stripped before the payload leaves
// the server — and for LISTENING every per-part `transcript` too. Kept: options,
// optionPool, prompts, passages, thirdOptionLabel, and the listening media the
// browser needs (audio, image), audioMode / singleAudio, stem.html (with
// {{itemId}} markers) and groups[].context.
// An unexpired, unsubmitted session is REUSED, so refreshing the page resumes
// the same countdown instead of restarting it.
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
    .select('id, title, skill, duration_sec, status')
    .eq('id', testId)
    .maybeSingle()
  if (testError) return json({ error: testError.message }, 500)
  if (!test || test.status !== 'published') return json({ error: 'Test not found' }, 404)

  const { data: contentRow, error: contentError } = await admin
    .from('test_content')
    .select('content')
    .eq('test_id', testId)
    .single()
  if (contentError || !contentRow) return json({ error: 'Test content missing' }, 500)

  // Reuse the newest OPEN session (created by the mode picker's start-session,
  // or resumed on refresh). A paused practice session still counts as open.
  // If none exists, fall back to a default simulation session — this keeps
  // direct navigation working. Listening is audio-paced: no timer is ever
  // shown, so its sessions get a LONG housekeeping window instead of the
  // test's nominal duration (a short hidden expiry would surprise-reject the
  // student at submit time).
  const LISTENING_WINDOW_SEC = 6 * 3600
  let session = await findActiveSession(admin, user.id, testId)
  if (!session) {
    const windowSec =
      test.skill === 'listening' ? LISTENING_WINDOW_SEC : (test.duration_sec as number)
    const expiresAt = new Date(Date.now() + windowSec * 1000).toISOString()
    const { data: created, error: createError } = await admin
      .from('test_sessions')
      .insert({
        user_id: user.id,
        test_id: testId,
        mode: 'simulation',
        duration_sec: windowSec,
        expires_at: expiresAt,
      })
      .select('id, started_at, expires_at, mode, duration_sec, paused_at')
      .single()
    if (createError || !created) {
      return json({ error: createError?.message ?? 'Could not start test session' }, 500)
    }
    session = created
  }

  return json({
    ...sanitize(contentRow.content, test),
    session: serializeSession(session),
  })
})

// The newest open (unsubmitted, not-yet-expired) session, or null. A PAUSED
// practice session never counts as expired while it is frozen.
// deno-lint-ignore no-explicit-any
async function findActiveSession(admin: any, userId: string, testId: string) {
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

// deno-lint-ignore no-explicit-any
function stripItem(item: any) {
  const { answer: _answer, explanation: _explanation, ...safe } = item
  return safe
}

// deno-lint-ignore no-explicit-any
function stripPart(part: any) {
  // Drop the server-only transcript; sanitize items (and grouped items).
  const { transcript: _transcript, items, groups, ...rest } = part
  const out = { ...rest }
  if (Array.isArray(items)) out.items = items.map(stripItem)
  if (Array.isArray(groups)) {
    // deno-lint-ignore no-explicit-any
    out.groups = groups.map((g: any) => ({ ...g, items: (g.items ?? []).map(stripItem) }))
  }
  return out
}

// deno-lint-ignore no-explicit-any
function sanitize(content: any, test: { id: string; title: string; duration_sec: number }) {
  // deno-lint-ignore no-explicit-any
  const base: any = {
    id: test.id,
    title: test.title,
    skill: content.skill,
    targetLevels: content.targetLevels,
    durationSec: test.duration_sec ?? content.durationSec,
    parts: (content.parts ?? []).map(stripPart),
  }
  if (content.skill === 'listening') {
    base.audioMode = content.audioMode
    if (content.singleAudio) base.singleAudio = content.singleAudio
  }
  return base
}
