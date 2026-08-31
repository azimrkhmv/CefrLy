// sweep-expired-attempts: hand in the tests nobody came back to.
//
// A simulation's clock keeps running while the student is away — that is the
// point of a mock exam. But when it hits zero with the tab closed, nothing was
// grading the paper: the attempt just sat there, open and dead, until the
// student reopened it and pressed the rescue button.
//
// Now that the answers are mirrored to `session_answers`, the server can finish
// the job. Every few minutes this grades any attempt whose deadline has passed,
// stores it exactly like a normal submit (marked `late`, and `autoSubmitted` so
// the record says who pressed the button), and closes the session. Attempts
// with nothing typed are closed WITHOUT a result — a blank paper is an
// abandoned attempt, not a zero the student has to explain.
//
// Called by pg_cron. There is no user behind the request, so it is deployed
// with --no-verify-jwt and guards itself with a shared secret, exactly like
// sweep-speaking-audio.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'
import { gradePaper } from './grade.ts'

/** Matches submit-test: a couple of minutes of slack for a browser that is
 *  auto-submitting right now. Never grade underneath a live client. */
const GRACE_MS = 120_000

// deno-lint-ignore no-explicit-any
type Any = any

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const secret = Deno.env.get('SWEEP_SECRET')
  if (!secret || req.headers.get('x-sweep-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: sessions, error } = await admin
    .from('test_sessions')
    .select('id, user_id, test_id, expires_at, paused_at, mode')
    .is('submitted_at', null)
    .lt('expires_at', new Date(Date.now() - GRACE_MS).toISOString())
    .limit(200)
  if (error) return json({ error: error.message }, 500)

  let graded = 0
  let closedEmpty = 0

  for (const session of (sessions ?? []) as Any[]) {
    // A paused practice attempt is frozen — its wall-clock deadline moves with
    // it, so it is NOT expired however long ago `expires_at` reads.
    if (session.paused_at) continue

    const { data: saved } = await admin
      .from('session_answers')
      .select('answers')
      .eq('session_id', session.id)
      .maybeSingle()

    const answerMap = (saved?.answers ?? {}) as Record<string, unknown>
    const answered = Object.values(answerMap).filter(
      (v) => typeof v === 'string' && v.trim() !== '',
    ).length

    if (answered === 0) {
      // Nothing to grade. Close it so the student's catalog stops offering a
      // dead "Resume", but write no result.
      await admin
        .from('test_sessions')
        .update({ submitted_at: new Date().toISOString() })
        .eq('id', session.id)
      await admin.from('session_answers').delete().eq('session_id', session.id)
      closedEmpty += 1
      continue
    }

    const { data: test } = await admin
      .from('tests')
      .select('id, title, status, scope, part_number')
      .eq('id', session.test_id)
      .maybeSingle()
    const { data: contentRow } = await admin
      .from('test_content')
      .select('content')
      .eq('test_id', session.test_id)
      .maybeSingle()
    if (!test || !contentRow) continue

    const scope: 'full' | 'part' = test.scope === 'part' ? 'part' : 'full'
    const { rawScore, total, band, sectionScores, items } = gradePaper(
      contentRow.content,
      answerMap,
      scope,
    )

    const result = {
      testId: test.id,
      testTitle: test.title,
      skill: contentRow.content.skill ?? 'reading',
      scope,
      partNumber: test.part_number ?? null,
      rawScore,
      total,
      band,
      submittedAt: new Date().toISOString(),
      late: true,
      /** Nobody pressed Submit — the clock did. Shown to the student as
       *  "submitted automatically when your time ran out". */
      autoSubmitted: true,
      items,
    }

    const { error: insertError } = await admin.from('attempts').insert({
      user_id: session.user_id,
      test_id: test.id,
      session_id: session.id,
      answers: answerMap,
      raw_score: rawScore,
      total,
      band,
      section_scores: sectionScores,
      result,
    })
    if (insertError) continue // leave the session open; try again next run

    await admin
      .from('test_sessions')
      .update({ submitted_at: new Date().toISOString() })
      .eq('id', session.id)
    await admin.from('session_answers').delete().eq('session_id', session.id)
    graded += 1
  }

  return json({ graded, closedEmpty, considered: sessions?.length ?? 0 })
})
