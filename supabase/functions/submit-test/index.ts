// submit-test: grades an attempt entirely server-side against the real test
// content (which the browser never sees), stores the attempt, and returns the
// result including explanations.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { testId?: unknown; answers?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const testId = body.testId
  const answers = body.answers
  if (typeof testId !== 'string' || testId.length === 0) {
    return json({ error: 'testId is required' }, 400)
  }
  if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
    return json({ error: 'answers must be an object of itemId -> value' }, 400)
  }
  const answerMap = answers as Record<string, unknown>

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
    .select('id, title, published')
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

  const content = contentRow.content
  const itemResults = []
  let rawScore = 0
  let total = 0

  for (const part of content.parts ?? []) {
    for (const item of part.items ?? []) {
      total += 1
      const raw = answerMap[item.id]
      const userAnswer = typeof raw === 'string' && raw.trim() !== '' ? raw : null
      const correct = isCorrect(item, userAnswer)
      if (correct) rawScore += 1
      itemResults.push({
        id: item.id,
        partNumber: part.number,
        type: item.type,
        prompt: item.prompt,
        correct,
        userAnswer,
        userAnswerLabel: answerLabel(part, item, userAnswer),
        correctAnswerLabel: correctAnswerLabel(part, item),
        explanation: item.explanation,
      })
    }
  }

  const band = bandFor(rawScore)
  const result = {
    testId: test.id,
    testTitle: test.title,
    rawScore,
    total,
    band,
    submittedAt: new Date().toISOString(),
    items: itemResults,
  }

  const { data: inserted, error: insertError } = await admin
    .from('attempts')
    .insert({
      user_id: user.id,
      test_id: test.id,
      answers: answerMap,
      raw_score: rawScore,
      total,
      band,
      result,
    })
    .select('id')
    .single()
  if (insertError || !inserted) {
    return json({ error: insertError?.message ?? 'Could not save attempt' }, 500)
  }

  return json({ attemptId: inserted.id, ...result })
})

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

// deno-lint-ignore no-explicit-any
function isCorrect(item: any, userAnswer: string | null): boolean {
  if (userAnswer === null) return false
  switch (item.type) {
    case 'gap':
      return (item.answer as string[]).map(normalize).includes(normalize(userAnswer))
    case 'match':
    case 'mcq':
    case 'tfng':
      return userAnswer === item.answer
    default:
      return false
  }
}

// Reading-only indicative band from raw correct count out of 35.
function bandFor(score: number): string {
  if (score >= 28) return 'C1'
  if (score >= 18) return 'B2'
  if (score >= 10) return 'B1'
  return 'below_B1'
}

// deno-lint-ignore no-explicit-any
function optionLabel(pool: any[] | undefined, key: string): string {
  const found = pool?.find((option) => option.key === key)
  return found ? `${found.key}. ${found.label}` : key
}

// deno-lint-ignore no-explicit-any
function answerLabel(part: any, item: any, value: string | null): string | null {
  if (value === null) return null
  switch (item.type) {
    case 'gap':
      return value
    case 'match':
      return optionLabel(part.optionPool, value)
    case 'mcq':
      return optionLabel(item.options, value)
    case 'tfng':
      return value === 'true' ? 'True' : value === 'false' ? 'False' : item.thirdOptionLabel
    default:
      return value
  }
}

// deno-lint-ignore no-explicit-any
function correctAnswerLabel(part: any, item: any): string {
  switch (item.type) {
    case 'gap':
      return (item.answer as string[]).join(' / ')
    case 'match':
      return optionLabel(part.optionPool, item.answer)
    case 'mcq':
      return optionLabel(item.options, item.answer)
    case 'tfng':
      return item.answer === 'true' ? 'True' : item.answer === 'false' ? 'False' : item.thirdOptionLabel
    default:
      return String(item.answer)
  }
}
