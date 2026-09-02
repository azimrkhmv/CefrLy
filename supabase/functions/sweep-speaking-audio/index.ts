// sweep-speaking-audio: delete recordings nobody is coming back for.
//
// Clips normally live for seconds — grade-speaking deletes them the moment it
// has scored them. They outlive that only when an attempt is abandoned (the
// student closed the tab) or a grade failed and the student never retried.
// Until now the cleanup only ran at the END of somebody else's successful
// grade, so with no traffic the audio simply stayed. That breaks the promise we
// make to students: we do not keep your voice.
//
// Called hourly by pg_cron. There is no user behind the request, so it is
// deployed with --no-verify-jwt and guards itself with a shared secret instead.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'

const BUCKET = 'speaking-temp'
/** Clips older than this are nobody's any more. TEMPORARILY 3h (2026-09-02):
 *  a Gemini slowdown is failing checks and students need the retry window to
 *  outlive the incident. Put back to 1h when grading is stable. */
const ORPHAN_MS = 3 * 60 * 60 * 1000
/** An attempt still "grading" after this long is never finishing — the function
 *  died mid-call, leaving the student watching a spinner forever. */
const STUCK_MS = 15 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // No JWT here (cron has no user), so the shared secret IS the authorisation.
  const secret = Deno.env.get('SWEEP_SECRET')
  if (!secret || req.headers.get('x-sweep-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const cutoff = new Date(Date.now() - ORPHAN_MS)
  const stale: string[] = []

  // The bucket is laid out as <userId>/<attemptId>/<n>.webm, so walk two levels.
  const { data: users } = await admin.storage.from(BUCKET).list('', { limit: 1000 })
  for (const user of (users ?? []) as { name: string }[]) {
    const { data: attempts } = await admin.storage
      .from(BUCKET)
      .list(user.name, { limit: 1000 })
    for (const attempt of (attempts ?? []) as { name: string }[]) {
      const { data: files } = await admin.storage
        .from(BUCKET)
        .list(`${user.name}/${attempt.name}`, { limit: 1000 })
      for (const f of (files ?? []) as { name: string; created_at?: string }[]) {
        const at = Date.parse(f.created_at ?? '')
        if (Number.isFinite(at) && at < cutoff.getTime()) {
          stale.push(`${user.name}/${attempt.name}/${f.name}`)
        }
      }
    }
  }

  // remove() takes a bounded list; chunk so a big backlog still clears.
  let deleted = 0
  for (let i = 0; i < stale.length; i += 100) {
    const chunk = stale.slice(i, i + 100)
    const { error } = await admin.storage.from(BUCKET).remove(chunk)
    if (!error) deleted += chunk.length
  }

  // A crashed grade leaves the row spinning. Fail it so the student sees what
  // happened (and can retry, if the clips are still inside the hour).
  //
  // AGE OF THE RUN, NOT OF THE ATTEMPT. Keyed on created_at this killed live
  // retries: a student retrying an attempt recorded an hour ago was already
  // past STUCK_MS the instant the run began, so the next sweep marked their
  // healthy in-flight check as failed and they never got a score.
  // grading_started_at is stamped at the top of every run for exactly this.
  const runCutoff = new Date(Date.now() - STUCK_MS).toISOString()
  const { data: unstuck } = await admin
    .from('speaking_attempts')
    .update({
      status: 'failed',
      error_message: 'The check stopped unexpectedly. Please try again.',
    })
    .eq('status', 'grading')
    .or(
      `grading_started_at.lt.${runCutoff},` +
        `and(grading_started_at.is.null,created_at.lt.${runCutoff})`,
    )
    .select('id')

  return json({ deleted, unstuck: unstuck?.length ?? 0 })
})
