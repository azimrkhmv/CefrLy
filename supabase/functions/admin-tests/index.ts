// admin-tests: content management for admins. All actions re-check the
// caller's profiles.role server-side (requireAdmin) — the UI gate is cosmetic.
// Actions: list, get, upsert (validated; writes nothing on failure),
// setStatus (draft|published), delete (soft archive).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'
import { validateReadingTest } from './validate.ts'
import { validateListeningTest } from './validate-listening.ts'

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
        .select('id, slug, skill, title, status, scope, part_number, created_at')
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
        .select('id, slug, skill, title, status, target_levels, duration_sec, scope, part_number, created_at')
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

    case 'upsert': {
      const slug = body.slug
      const status = body.status ?? 'draft'
      const content = body.content
      if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
        return json({ ok: false, errors: ['slug must be lowercase letters, digits and hyphens (e.g. reading-mock-2).'] }, 400)
      }
      if (status !== 'draft' && status !== 'published') {
        return json({ ok: false, errors: ["status must be 'draft' or 'published'."] }, 400)
      }

      const skill = content?.skill === 'listening' ? 'listening' : 'reading'
      // Single-part tests are flagged INSIDE content (scope: 'part' + partNumber)
      // so the marker travels with the test JSON; the tests row mirrors it.
      const scope = content?.scope === 'part' ? 'part' : 'full'
      const maxPart = skill === 'listening' ? 6 : 5
      let partNumber: number | undefined
      if (scope === 'part') {
        const pn = content?.partNumber
        if (typeof pn !== 'number' || !Number.isInteger(pn) || pn < 1 || pn > maxPart) {
          return json(
            { ok: false, errors: [`A part test needs partNumber 1–${maxPart} for ${skill}.`] },
            400,
          )
        }
        partNumber = pn
      }
      const errors =
        skill === 'listening'
          ? validateListeningTest(content, partNumber)
          : validateReadingTest(content, partNumber)
      if (errors.length > 0) return json({ ok: false, errors }, 400)

      const { data: existing, error: findError } = await admin
        .from('tests')
        .select('id, status')
        .eq('slug', slug)
        .maybeSingle()
      if (findError) return json({ ok: false, errors: [findError.message] }, 500)

      const meta = {
        slug,
        title: content.title,
        skill,
        target_levels: content.targetLevels,
        duration_sec: content.durationSec,
        status,
        scope,
        part_number: partNumber ?? null,
      }

      let testId: string
      if (existing) {
        if (existing.status === 'archived') {
          return json({ ok: false, errors: [`'${slug}' is archived. Restore it first or pick another slug.`] }, 409)
        }
        testId = existing.id
        const { error: updateError } = await admin.from('tests').update(meta).eq('id', testId)
        if (updateError) return json({ ok: false, errors: [updateError.message] }, 500)
      } else {
        const { data: inserted, error: insertError } = await admin
          .from('tests')
          .insert(meta)
          .select('id')
          .single()
        if (insertError || !inserted) {
          return json({ ok: false, errors: [insertError?.message ?? 'Could not create test'] }, 500)
        }
        testId = inserted.id
      }

      // keep the stored content self-consistent with the row
      const finalContent = { ...content, id: testId, slug }
      const { error: contentWriteError } = await admin
        .from('test_content')
        .upsert({ test_id: testId, content: finalContent, updated_at: new Date().toISOString() })
      if (contentWriteError) return json({ ok: false, errors: [contentWriteError.message] }, 500)

      return json({ ok: true, slug, id: testId })
    }

    case 'setStatus': {
      const slug = body.slug
      const status = body.status
      if (typeof slug !== 'string' || !slug) return json({ error: 'slug is required' }, 400)
      if (status !== 'draft' && status !== 'published') {
        return json({ error: "status must be 'draft' or 'published'" }, 400)
      }
      const { data: updated, error } = await admin
        .from('tests')
        .update({ status })
        .eq('slug', slug)
        .neq('status', 'archived')
        .select('id')
      if (error) return json({ error: error.message }, 500)
      if (!updated || updated.length === 0) return json({ error: 'Test not found' }, 404)
      return json({ ok: true, slug, status })
    }

    case 'delete': {
      const slug = body.slug
      if (typeof slug !== 'string' || !slug) return json({ error: 'slug is required' }, 400)
      const { data: archived, error } = await admin
        .from('tests')
        .update({ status: 'archived' })
        .eq('slug', slug)
        .select('id')
      if (error) return json({ error: error.message }, 500)
      if (!archived || archived.length === 0) return json({ error: 'Test not found' }, 404)
      return json({ ok: true, slug, status: 'archived' })
    }

    default:
      return json({ error: `Unknown action: ${String(body.action)}` }, 400)
  }
})
