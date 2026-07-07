// admin-samples: content management for the Writing/Speaking sample library.
// Same shape as admin-tests: every action re-checks the caller's
// profiles.role server-side (the UI gate is cosmetic). Actions: list, get,
// upsert (validated; writes nothing on failure), setStatus (draft|published),
// delete (soft archive). Students never call this — published samples are
// read straight from the `samples` table under RLS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'
import { validateSample } from './validate.ts'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
        .from('samples')
        .select('id, slug, category, badge, title, status, sort_order, created_at')
        .neq('status', 'archived')
        .order('category')
        .order('sort_order')
        .order('created_at')
      if (error) return json({ error: error.message }, 500)
      return json({ samples: data })
    }

    case 'get': {
      const slug = body.slug
      if (typeof slug !== 'string' || slug.length === 0) {
        return json({ error: 'slug is required' }, 400)
      }
      const { data: sample, error } = await admin
        .from('samples')
        .select('id, slug, category, badge, title, content, status, sort_order, created_at')
        .eq('slug', slug)
        .maybeSingle()
      if (error) return json({ error: error.message }, 500)
      if (!sample) return json({ error: 'Sample not found' }, 404)
      return json({ sample })
    }

    case 'upsert': {
      const slug = body.slug
      const status = body.status ?? 'draft'
      const { category, badge, title, content } = body
      const sortOrder = body.sortOrder ?? 0
      if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
        return json(
          { ok: false, errors: ['slug must be lowercase letters, digits and hyphens (e.g. w1-apology).'] },
          400,
        )
      }
      if (status !== 'draft' && status !== 'published') {
        return json({ ok: false, errors: ["status must be 'draft' or 'published'."] }, 400)
      }
      if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder)) {
        return json({ ok: false, errors: ['sortOrder must be an integer.'] }, 400)
      }

      const errors = validateSample(category, badge, title, content)
      if (errors.length > 0) return json({ ok: false, errors }, 400)

      const { data: existing, error: findError } = await admin
        .from('samples')
        .select('id, status')
        .eq('slug', slug)
        .maybeSingle()
      if (findError) return json({ ok: false, errors: [findError.message] }, 500)

      const row = {
        slug,
        category,
        badge,
        title,
        content,
        status,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      }

      let sampleId: string
      if (existing) {
        if (existing.status === 'archived') {
          return json(
            { ok: false, errors: [`'${slug}' is archived. Restore it first or pick another slug.`] },
            409,
          )
        }
        sampleId = existing.id
        const { error: updateError } = await admin.from('samples').update(row).eq('id', sampleId)
        if (updateError) return json({ ok: false, errors: [updateError.message] }, 500)
      } else {
        const { data: inserted, error: insertError } = await admin
          .from('samples')
          .insert(row)
          .select('id')
          .single()
        if (insertError || !inserted) {
          return json({ ok: false, errors: [insertError?.message ?? 'Could not create sample'] }, 500)
        }
        sampleId = inserted.id
      }

      return json({ ok: true, slug, id: sampleId })
    }

    case 'setStatus': {
      const slug = body.slug
      const status = body.status
      if (typeof slug !== 'string' || !slug) return json({ error: 'slug is required' }, 400)
      if (status !== 'draft' && status !== 'published') {
        return json({ error: "status must be 'draft' or 'published'" }, 400)
      }
      const { data: updated, error } = await admin
        .from('samples')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('slug', slug)
        .neq('status', 'archived')
        .select('id')
      if (error) return json({ error: error.message }, 500)
      if (!updated || updated.length === 0) return json({ error: 'Sample not found' }, 404)
      return json({ ok: true, slug, status })
    }

    case 'delete': {
      const slug = body.slug
      if (typeof slug !== 'string' || !slug) return json({ error: 'slug is required' }, 400)
      const { data: archived, error } = await admin
        .from('samples')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('slug', slug)
        .select('id')
      if (error) return json({ error: error.message }, 500)
      if (!archived || archived.length === 0) return json({ error: 'Sample not found' }, 404)
      return json({ ok: true, slug, status: 'archived' })
    }

    default:
      return json({ error: `Unknown action: ${String(body.action)}` }, 400)
  }
})
