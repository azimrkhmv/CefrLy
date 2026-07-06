// review-attempt: the post-submit study view. Returns the FULL test content —
// including answer keys and transcripts — together with the student's graded
// answers, but ONLY for a submitted attempt owned by the caller. Before
// submission the browser must still never see any of this (get-test keeps
// stripping); after submission it is exactly what the results/review UI shows.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { attemptId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const attemptId = body.attemptId
  if (typeof attemptId !== 'string' || attemptId.length === 0) {
    return json({ error: 'attemptId is required' }, 400)
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

  const { data: attempt, error: attemptError } = await admin
    .from('attempts')
    .select('id, user_id, test_id, result')
    .eq('id', attemptId)
    .maybeSingle()
  if (attemptError) return json({ error: attemptError.message }, 500)
  // Ownership check — a review reveals keys and transcripts, so it is strictly
  // the attempt owner's to see.
  if (!attempt || attempt.user_id !== user.id) return json({ error: 'Attempt not found' }, 404)
  if (!attempt.test_id) return json({ error: 'The test for this attempt no longer exists' }, 410)

  const { data: contentRow, error: contentError } = await admin
    .from('test_content')
    .select('content')
    .eq('test_id', attempt.test_id)
    .maybeSingle()
  if (contentError) return json({ error: contentError.message }, 500)
  if (!contentRow) return json({ error: 'The test for this attempt no longer exists' }, 410)

  // deno-lint-ignore no-explicit-any
  const content = contentRow.content as any
  // deno-lint-ignore no-explicit-any
  const result = attempt.result as any

  return json({
    attemptId: attempt.id,
    testId: attempt.test_id,
    testTitle: result?.testTitle ?? content.title,
    skill: content.skill,
    submittedAt: result?.submittedAt ?? null,
    rawScore: result?.rawScore ?? 0,
    total: result?.total ?? 35,
    // Part-drill attempts legitimately have band null — preserve it (a
    // 'below_B1' default would silently mislabel them).
    band: result?.band ?? null,
    audioMode: content.audioMode ?? null,
    singleAudio: content.singleAudio ?? null,
    parts: content.parts,
    items: result?.items ?? [],
  })
})
