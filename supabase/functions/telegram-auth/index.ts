// telegram-auth: the website side of Telegram sign-up and password reset.
//
// Actions (all anonymous — the caller has no account yet):
//  · start  {purpose, phone?}         → a one-time token + the bot deep link
//                                       (signup: phone required; 409
//                                       code 'phone_exists' if it has an account)
//  · status {token}                   → has the bot sent a code yet? (masked phone)
//  · signup {token, code, password}   (names are asked later, in /welcome)
//  · reset  {token, code, password}
// signup/reset return the account's login email; the browser then signs in with
// signInWithPassword. Phone accounts log in with a synthetic address derived
// from the number (loginEmailForPhone) because Supabase's phone provider is off
// and would need an SMS vendor. No email is ever sent to it.
//
// Deployed with verify_jwt = false. The token (browser) + code (Telegram) pair
// is the authentication; codes are hashed, short-lived and attempt-limited.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'

const BOT_USERNAME = Deno.env.get('TELEGRAM_BOT_USERNAME') ?? 'CefrLy_bot'
const REQUEST_TTL_MS = 30 * 60 * 1000
const MAX_ATTEMPTS = 5
const MAX_STARTS_PER_IP_HOUR = 20

/** Keep in lockstep with src/lib/phoneAuth.ts. */
function loginEmailForPhone(phone: string): string {
  return `${phone}@phone.cefrly.app`
}

async function sha256(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().replace(/\s+/g, ' ')
  return v.length >= 1 && v.length <= 60 ? v : null
}

function maskPhone(phone: string): string {
  // 998901234567 → +998 90 *** ** 67
  return `+998 ${phone.slice(3, 5)} *** ** ${phone.slice(10)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  switch (body.action) {
    case 'start':
      return start(admin, req, body)
    case 'status':
      return status(admin, body)
    case 'signup':
    case 'reset':
      return verify(admin, body)
    default:
      return json({ error: 'Unknown action' }, 400)
  }
})

// deno-lint-ignore no-explicit-any
type Admin = any

async function start(admin: Admin, req: Request, body: Record<string, unknown>) {
  const purpose = body.purpose
  if (purpose !== 'signup' && purpose !== 'reset') return json({ error: 'Invalid purpose' }, 400)

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
  if (ip) {
    const { count } = await admin
      .from('telegram_auth_requests')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gt('created_at', new Date(Date.now() - 3600_000).toISOString())
    if ((count ?? 0) >= MAX_STARTS_PER_IP_HOUR) {
      return json({ error: 'Too many attempts. Please try again in an hour.' }, 429)
    }
  }

  // Housekeeping: requests older than a day are dead weight.
  await admin
    .from('telegram_auth_requests')
    .delete()
    .lt('created_at', new Date(Date.now() - 86400_000).toISOString())

  // Sign-up checks the typed number up front, so a student with an account is
  // told before they ever open the bot. Rate-limited above like every start.
  let expectedPhone: string | null = null
  if (purpose === 'signup') {
    const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : ''
    if (!/^998\d{9}$/.test(phone)) {
      return json({ error: 'Enter a valid Uzbekistan phone number (+998 and 9 digits).' }, 400)
    }
    const { data: taken } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle()
    if (taken) {
      return json(
        { error: 'This number already has an account. Log in, or use a different number.', code: 'phone_exists' },
        409,
      )
    }
    expectedPhone = phone
  }

  const token = randomToken()
  const expiresAt = new Date(Date.now() + REQUEST_TTL_MS).toISOString()
  const { error } = await admin
    .from('telegram_auth_requests')
    .insert({ token_hash: await sha256(token), purpose, expires_at: expiresAt, ip, expected_phone: expectedPhone })
  if (error) {
    console.error('start insert failed', error)
    return json({ error: 'Could not start. Please try again.' }, 500)
  }

  return json({ token, botUrl: `https://t.me/${BOT_USERNAME}?start=${token}`, expiresAt })
}

async function loadRequest(admin: Admin, token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 64) return null
  const { data } = await admin
    .from('telegram_auth_requests')
    .select('*')
    .eq('token_hash', await sha256(token))
    .maybeSingle()
  return data
}

async function status(admin: Admin, body: Record<string, unknown>) {
  const request = await loadRequest(admin, body.token)
  if (!request) return json({ error: 'Request not found' }, 404)
  return json({
    botOpened: request.telegram_user_id != null,
    codeSent: request.code_sent_at != null,
    phone: request.phone ? maskPhone(request.phone) : null,
    expired: new Date(request.expires_at) < new Date() || request.consumed_at != null,
  })
}

async function verify(admin: Admin, body: Record<string, unknown>) {
  const action = body.action as 'signup' | 'reset'

  // Validate the form BEFORE touching the code, so a typo in a name never
  // burns one of the student's code attempts.
  const password = body.password
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    return json({ error: 'Password must be 6 to 72 characters.' }, 400)
  }
  // NAMES ARE OPTIONAL HERE since 2026-09-21: the sign-up form no longer asks
  // for them — the first /welcome step does, and every account goes through it.
  // A form still open from before the change sends all three; keep them if so.
  let names: { first: string; last: string; father: string } | null = null
  if (action === 'signup') {
    const first = cleanName(body.firstName)
    const last = cleanName(body.lastName)
    const father = cleanName(body.fatherName)
    if (first && last && father) names = { first, last, father }
  }
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!/^\d{6}$/.test(code)) return json({ error: 'Enter the 6-digit code from the bot.' }, 400)

  const request = await loadRequest(admin, body.token)
  if (!request || request.purpose !== action) return json({ error: 'Request not found', code: 'expired' }, 404)
  if (request.consumed_at || new Date(request.expires_at) < new Date()) {
    return json({ error: 'This request has expired. Press Start over.', code: 'expired' }, 410)
  }
  if (!request.code_hash || !request.phone) {
    return json({ error: 'Open the bot and press 📱 Send my number to get your code first.' }, 400)
  }
  if (request.attempts >= MAX_ATTEMPTS) {
    return json({ error: 'Too many wrong codes. Press 📱 in the bot to get a new one.' }, 429)
  }
  if (new Date(request.code_expires_at) < new Date()) {
    return json({ error: 'This code has expired. Press 📱 in the bot to get a new one.' }, 400)
  }
  if ((await sha256(`${request.id}:${code}`)) !== request.code_hash) {
    const attempts = request.attempts + 1
    await admin.from('telegram_auth_requests').update({ attempts }).eq('id', request.id)
    const left = MAX_ATTEMPTS - attempts
    return json(
      {
        error:
          left > 0
            ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.`
            : 'Too many wrong codes. Press 📱 in the bot to get a new one.',
      },
      400,
    )
  }

  // Code is right. Consume first so the same code can never be replayed, even
  // if the account step below fails and the student retries.
  const { data: claimed } = await admin
    .from('telegram_auth_requests')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', request.id)
    .is('consumed_at', null)
    .select('id')
  if (!claimed?.length) return json({ error: 'This request was already used.', code: 'expired' }, 410)

  const phone: string = request.phone
  const { data: existing } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle()

  if (action === 'signup') {
    if (existing) {
      return json({ error: 'This number already has an account. Log in instead.', code: 'exists' }, 409)
    }
    const email = loginEmailForPhone(phone)
    const fullName = names ? `${names.first} ${names.last}` : null
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone,
      phone_confirm: true,
      user_metadata: names
        ? {
            name: fullName,
            full_name: fullName,
            first_name: names.first,
            last_name: names.last,
            father_name: names.father,
            signup: 'telegram',
          }
        : { signup: 'telegram' },
    })
    if (createError || !created?.user) {
      console.error('createUser failed', createError)
      const taken = /already|exists|registered/i.test(createError?.message ?? '')
      return json(
        taken
          ? { error: 'This number already has an account. Log in instead.', code: 'exists' }
          : { error: 'Could not create your account. Please start over.' },
        taken ? 409 : 500,
      )
    }
    // handle_new_user already inserted the profile row; fill in the rest.
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        ...(names
          ? { name: fullName, first_name: names.first, last_name: names.last, father_name: names.father }
          : {}),
        phone,
        telegram_user_id: request.telegram_user_id,
      })
      .eq('id', created.user.id)
    if (profileError) {
      console.error('profile update failed', profileError)
      await admin.auth.admin.deleteUser(created.user.id)
      return json({ error: 'Could not create your account. Please start over.' }, 500)
    }
    return json({ email })
  }

  // reset
  if (!existing) return json({ error: 'No account uses this number. Sign up instead.' }, 404)
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
    password,
  })
  if (updateError || !updated?.user?.email) {
    console.error('password reset failed', updateError)
    return json({ error: 'Could not reset your password. Please start over.' }, 500)
  }
  return json({ email: updated.user.email })
}
