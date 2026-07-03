// admin-tests: content management for admins. All actions re-check the
// caller's profiles.role server-side (requireAdmin) — the UI gate is cosmetic.
// Task 3: read actions (list, get). Write actions arrive in task 4.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

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

  // requireAdmin: content actions are allowed for admin and super_admin.
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return json({ error: 'Forbidden: admin access required' }, 403)
  }

  // deno-lint-ignore no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  switch (body.action) {
    case 'list': {
      const { data, error } = await admin
        .from('tests')
        .select('id, slug, skill, title, status, created_at')
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
      if (error) return json({ error: error.message }, 500)
      return json({ tests: data })
    }

    case 'get': {
      const slug = body.slug
      if (typeof slug !== 'string' || slug.length === 0) {
        return json({ error: 'slug is required' }, 400)
      }
      const { data: test, error } = await admin
        .from('tests')
        .select('id, slug, skill, title, status, target_levels, duration_sec, created_at')
        .eq('slug', slug)
        .maybeSingle()
      if (error) return json({ error: error.message }, 500)
      if (!test) return json({ error: 'Test not found' }, 404)
      const { data: contentRow, error: contentError } = await admin
        .from('test_content')
        .select('content')
        .eq('test_id', test.id)
        .single()
      if (contentError || !contentRow) return json({ error: 'Test content missing' }, 500)
      return json({ test, content: contentRow.content })
    }

    default:
      return json({ error: `Unknown action: ${String(body.action)}` }, 400)
  }
})
