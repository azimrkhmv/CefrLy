// admin-users: user management, gated by requireSuperAdmin. Guardrails:
// super_admin can never be granted or removed through this API (protects the
// owner from lockout and admins from privilege escalation), and callers cannot
// change their own role.
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

  // requireSuperAdmin: only the owner role may manage users.
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') {
    return json({ error: 'Forbidden: super admin access required' }, 403)
  }

  // deno-lint-ignore no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  switch (body.action) {
    case 'listUsers': {
      const { data: authUsers, error: listError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
      if (listError) return json({ error: listError.message }, 500)
      const { data: profiles, error: profilesError } = await admin
        .from('profiles')
        .select('id, name, role, created_at')
      if (profilesError) return json({ error: profilesError.message }, 500)
      const byId = new Map(profiles.map((p) => [p.id, p]))
      const users = authUsers.users
        .map((u) => {
          const p = byId.get(u.id)
          return {
            id: u.id,
            email: u.email ?? '',
            name: p?.name ?? null,
            role: p?.role ?? 'student',
            created_at: u.created_at,
          }
        })
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      return json({ users })
    }

    case 'setUserRole': {
      const userId = body.userId
      const role = body.role
      if (typeof userId !== 'string' || !userId) return json({ error: 'userId is required' }, 400)
      if (role !== 'student' && role !== 'admin') {
        return json({ error: "role must be 'student' or 'admin' — super_admin is not assignable" }, 400)
      }
      if (userId === user.id) {
        return json({ error: 'You cannot change your own role' }, 400)
      }
      const { data: target, error: targetError } = await admin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      if (targetError) return json({ error: targetError.message }, 500)
      if (!target) return json({ error: 'User not found' }, 404)
      if (target.role === 'super_admin') {
        return json({ error: 'The super admin role cannot be changed through this API' }, 400)
      }
      const { error: updateError } = await admin
        .from('profiles')
        .update({ role })
        .eq('id', userId)
      if (updateError) return json({ error: updateError.message }, 500)
      return json({ ok: true, userId, role })
    }

    default:
      return json({ error: `Unknown action: ${String(body.action)}` }, 400)
  }
})
