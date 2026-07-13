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
  // `picker`: single-call clients opt in to receive the picker metadata (with a
  // null session) instead of a 409 when no attempt is open — see below.
  let picker = false
  try {
    const body = await req.json()
    testId = body?.testId
    picker = body?.picker === true
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

  // Reuse the newest OPEN session (created by the mode picker's start-session,
  // or resumed on refresh). A paused practice session still counts as open.
  // NO auto-create fallback: sessions start ONLY via start-session (the mode
  // picker). The old fallback silently minted a fresh simulation session on
  // any stray get-test call — it resurrected attempts the student had just
  // cancelled via Exit (leaving = the attempt is cancelled, user decision
  // 2026-07-06). With no open session the client shows the picker.
  const session = await findActiveSession(admin, user.id, testId)
  if (!session) {
    // Single-call clients (picker:true) get the picker METADATA with a null
    // session — NO session is created — so a page load makes ONE round-trip
    // (this endpoint doubles as the old read-only session-status peek). Legacy
    // clients (no flag) still get the 409 they expect, so deploying this is
    // backward compatible with the currently-shipped frontend.
    if (picker) {
      return json({
        skill: test.skill,
        title: test.title,
        durationSec: test.duration_sec,
        scope: test.scope ?? 'full',
        partNumber: test.part_number ?? null,
        serverNow: new Date().toISOString(),
        session: null,
      })
    }
    return json({ error: 'No active test session — choose a mode to start.' }, 409)
  }

  // Only load the (large) content row once we know there IS a paper to render —
  // the picker path above skips this read entirely.
  const { data: contentRow, error: contentError } = await admin
    .from('test_content')
    .select('content')
    .eq('test_id', testId)
    .single()
  if (contentError || !contentRow) return json({ error: 'Test content missing' }, 500)

  return json({
    ...sanitize(contentRow.content, test),
    scope: test.scope ?? 'full',
    partNumber: test.part_number ?? null,
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
