// get-test: returns a SANITIZED test to the browser.
// Every `answer` and `explanation` field is stripped before the payload leaves
// the server. Options, optionPool, prompts, passages and thirdOptionLabel are kept.
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
    .select('id, title, duration_sec, published')
    .eq('id', testId)
    .maybeSingle()
  if (testError) return json({ error: testError.message }, 500)
  if (!test || !test.published) return json({ error: 'Test not found' }, 404)

  const { data: contentRow, error: contentError } = await admin
    .from('test_content')
    .select('content')
    .eq('test_id', testId)
    .single()
  if (contentError || !contentRow) return json({ error: 'Test content missing' }, 500)

  return json(sanitize(contentRow.content, test))
})

// deno-lint-ignore no-explicit-any
function sanitize(content: any, test: { id: string; title: string; duration_sec: number }) {
  return {
    id: test.id,
    title: test.title,
    skill: content.skill,
    targetLevels: content.targetLevels,
    durationSec: test.duration_sec ?? content.durationSec,
    // deno-lint-ignore no-explicit-any
    parts: (content.parts ?? []).map((part: any) => ({
      ...part,
      // deno-lint-ignore no-explicit-any
      items: (part.items ?? []).map((item: any) => {
        const { answer: _answer, explanation: _explanation, ...safe } = item
        return safe
      }),
    })),
  }
}
