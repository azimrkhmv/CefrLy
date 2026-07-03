// milliymock-handoff: signs a MilliyMock user into Cefrly without re-registering.
//
// MilliyMock mints a short-lived HS256 JWT (email + name + mm_user_id + jti)
// with the shared MILLIYMOCK_HANDOFF_SECRET and redirects the browser to
// /handoff?token=... . This function verifies the token, enforces single use
// (jti ledger) and the 60s lifetime, finds-or-creates the Supabase user
// (profile source = 'milliymock'), and returns a one-time login token hash the
// frontend exchanges for a real session via auth.verifyOtp. No email is sent.
//
// Deployed with verify_jwt = false: callers are not Supabase users yet; the
// hand-off JWT itself is the authentication.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { jwtVerify } from 'npm:jose@5'
import { corsHeaders, json } from './cors.ts'

// MilliyMock mints 60-second tokens; reject anything minted with a longer life.
const MAX_TOKEN_LIFETIME_SEC = 90

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const secretValue = Deno.env.get('MILLIYMOCK_HANDOFF_SECRET')
  if (!secretValue) {
    return json({ error: 'Hand-off is not configured (missing MILLIYMOCK_HANDOFF_SECRET)' }, 503)
  }

  let token: unknown
  try {
    ;({ token } = await req.json())
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (typeof token !== 'string' || token.length === 0) {
    return json({ error: 'token is required' }, 400)
  }

  let payload
  try {
    ;({ payload } = await jwtVerify(token, new TextEncoder().encode(secretValue), {
      algorithms: ['HS256'],
    }))
  } catch {
    return json({ error: 'Invalid or expired hand-off token' }, 401)
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const name = typeof payload.name === 'string' ? payload.name : null
  const mmUserId = payload.mm_user_id != null ? String(payload.mm_user_id) : null
  const jti = typeof payload.jti === 'string' ? payload.jti : null
  if (!email || !jti) return json({ error: 'Token must include email and jti' }, 401)
  if (
    typeof payload.exp === 'number' &&
    typeof payload.iat === 'number' &&
    payload.exp - payload.iat > MAX_TOKEN_LIFETIME_SEC
  ) {
    return json({ error: 'Hand-off token lifetime too long' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Single use: the jti primary key can be inserted exactly once.
  const { error: jtiError } = await admin.from('handoff_tokens').insert({ jti })
  if (jtiError) return json({ error: 'This hand-off link was already used' }, 401)
  // Opportunistic cleanup of long-expired entries.
  await admin
    .from('handoff_tokens')
    .delete()
    .lt('used_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  // Find or create the Supabase user for this email.
  const { data: existingId, error: lookupError } = await admin.rpc('get_user_id_by_email', {
    p_email: email,
  })
  if (lookupError) return json({ error: lookupError.message }, 500)

  let userId = existingId as string | null
  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name, milliymock_user_id: mmUserId },
    })
    if (createError || !created.user) {
      return json({ error: createError?.message ?? 'Could not create user' }, 500)
    }
    userId = created.user.id
    // The signup trigger already created the profile row; tag its origin.
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({ id: userId, name, source: 'milliymock' })
    if (profileError) console.error('profile upsert failed:', profileError.message)
  }

  // Mint a one-time login for this user (generateLink sends no email).
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    return json({ error: linkError?.message ?? 'Could not create login token' }, 500)
  }

  return json({ tokenHash })
})
