// listening-audio: the ONLY way a student gets a listening recording.
//
// The `audio` bucket is private (migration 0035), so the browser cannot build a
// URL itself. This function checks who is asking and why, then returns a
// short-lived signed URL.
//
//   { sessionId, assetPath, action: 'status' }
//       Practice session → a URL, no counting (practice has no play limit).
//       Simulation       → plays used + the play limit, and, if a play is
//                          running, a URL plus how far into it we are, so a
//                          refresh RESUMES the tape instead of restarting it.
//   { sessionId, assetPath, action: 'start' }
//       Simulation only. Starts play N+1, or 403 { code: 'plays_used' } when
//       every allowed play is spent. This is the enforcement point.
//   { attemptId, assetPath }
//       Post-submit review: the attempt's owner may replay freely.
//
// A play is a TIME WINDOW, not a click: it began at started_at and the tape
// keeps running whether or not the tab is open. Re-asking for the running play
// returns the offset `now - started_at`; if that is past the end of the file,
// the play is simply over. So refreshing can neither burn a play nor buy one.
//
// Known limit: a signed URL, once issued, can be fetched again until it expires
// (URL_TTL_SEC). Someone copying it out of devtools can re-hear the file inside
// that window. That is far narrower than the permanent public URL this
// replaced, and closing it fully needs audio streamed through this function.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'

/** Long enough for the longest recording (a single-mode section runs ~35 min)
 *  plus a paused, buffering tab. */
const URL_TTL_SEC = 2 * 60 * 60

// deno-lint-ignore no-explicit-any
type Json = any

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { sessionId?: unknown; attemptId?: unknown; assetPath?: unknown; action?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { sessionId, attemptId, assetPath } = body
  const action = body.action ?? 'status'
  if (typeof assetPath !== 'string' || !assetPath) return json({ error: 'assetPath is required' }, 400)
  if (action !== 'status' && action !== 'start') {
    return json({ error: 'action must be "status" or "start"' }, 400)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const sign = async (): Promise<string | null> => {
    const { data, error } = await admin.storage.from('audio').createSignedUrl(assetPath, URL_TTL_SEC)
    return error || !data ? null : data.signedUrl
  }

  /** The recording's settings, or null when the test does not use this file —
   *  which stops the function signing arbitrary objects in the bucket. */
  const findAudio = async (testId: string): Promise<{ playLimit: number } | null> => {
    const { data } = await admin.from('test_content').select('content').eq('test_id', testId).maybeSingle()
    const content = data?.content as Json
    if (!content || content.skill !== 'listening') return null
    const assets: Json[] = [content.singleAudio, ...(content.parts ?? []).map((p: Json) => p?.audio)]
    const hit = assets.find((a) => a && a.assetPath === assetPath)
    return hit ? { playLimit: Math.max(1, Number(hit.playLimit) || 1) } : null
  }

  // --- Post-submit review ----------------------------------------------------
  if (typeof attemptId === 'string' && attemptId) {
    const { data: attempt } = await admin
      .from('attempts')
      .select('user_id, test_id')
      .eq('id', attemptId)
      .maybeSingle()
    if (!attempt || attempt.user_id !== user.id || !attempt.test_id) {
      return json({ error: 'Attempt not found' }, 404)
    }
    if (!(await findAudio(attempt.test_id))) return json({ error: 'Recording not found' }, 404)
    const url = await sign()
    if (!url) return json({ error: 'Could not load the recording' }, 500)
    return json({ mode: 'review', url })
  }

  // --- A live session --------------------------------------------------------
  if (typeof sessionId !== 'string' || !sessionId) {
    return json({ error: 'sessionId or attemptId is required' }, 400)
  }
  const { data: session } = await admin
    .from('test_sessions')
    .select('id, test_id, mode, submitted_at, expires_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!session || session.submitted_at) return json({ error: 'Session not found or already submitted' }, 409)
  if (new Date(session.expires_at).getTime() < Date.now()) return json({ error: 'Session has expired' }, 409)

  const audio = await findAudio(session.test_id)
  if (!audio) return json({ error: 'Recording not found' }, 404)

  if (session.mode === 'practice') {
    const url = await sign()
    if (!url) return json({ error: 'Could not load the recording' }, 500)
    return json({ mode: 'practice', url })
  }

  // Simulation: count.
  const { data: plays, error: playsError } = await admin
    .from('listening_plays')
    .select('play_no, started_at')
    .eq('session_id', session.id)
    .eq('asset_path', assetPath)
    .order('play_no', { ascending: false })
  if (playsError) return json({ error: playsError.message }, 500)
  const used = plays?.length ?? 0
  const latest = plays?.[0]

  if (action === 'status') {
    if (!latest) return json({ mode: 'simulation', playLimit: audio.playLimit, playsUsed: 0, active: null })
    const url = await sign()
    if (!url) return json({ error: 'Could not load the recording' }, 500)
    return json({
      mode: 'simulation',
      playLimit: audio.playLimit,
      playsUsed: used,
      // The client compares this with the file's duration: past the end means
      // the latest play is over, not that it may start again.
      active: { url, offsetSec: (Date.now() - new Date(latest.started_at).getTime()) / 1000 },
    })
  }

  // start
  if (used >= audio.playLimit) {
    return json(
      { error: 'Every play of this recording has been used.', code: 'plays_used', playLimit: audio.playLimit, playsUsed: used },
      403,
    )
  }
  const { error: insertError } = await admin.from('listening_plays').insert({
    session_id: session.id,
    user_id: user.id,
    asset_path: assetPath,
    play_no: used + 1,
  })
  // A unique violation means another tab took this play first.
  if (insertError) {
    return json({ error: 'This play has already started in another tab.', code: 'plays_used' }, 409)
  }
  const url = await sign()
  if (!url) return json({ error: 'Could not load the recording' }, 500)
  return json({ mode: 'simulation', playLimit: audio.playLimit, playsUsed: used + 1, active: { url, offsetSec: 0 } })
})
