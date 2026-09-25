// telegram-bot: the webhook behind @CefrLy_bot, Cefrly's official bot.
//
// Everyone who presses Start gets the same welcome: the welcome video + round
// video message (FIRST start only, and only once the file ids are configured),
// then a greeting and the main menu:
//   📱 Send my number        (request_contact)
//   📖 Guide   ❓ FAQ
//   🌐 Open Cefrly   👥 Community
//
// Sign-up / password reset: the website opens t.me/CefrLy_bot?start=<token>.
// That /start quietly ties the website's request to this Telegram account, so
// the student only has to press 📱. A shared contact is checked (own number,
// +998, registered or not) and answered with a 6-digit code. A contact shared
// WITHOUT a website request says whether the number has an account. If it
// does, the bot shows the login (the phone) and a "🔑 Get a new password"
// button: passwords are stored hashed and can never be read back, so the only
// honest way to "give the password" is to set a new random one and send it.
//
// Deployed with verify_jwt = false: Telegram is the caller. It authenticates
// with the secret_token set on setWebhook (X-Telegram-Bot-Api-Secret-Token).
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and — when the owner
// supplies the videos — TELEGRAM_WELCOME_VIDEO / TELEGRAM_WELCOME_VIDEO_NOTE
// (Telegram file_ids, so they send instantly without re-uploading).
import { createClient } from 'npm:@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const WELCOME_VIDEO = Deno.env.get('TELEGRAM_WELCOME_VIDEO') ?? ''
const WELCOME_VIDEO_NOTE = Deno.env.get('TELEGRAM_WELCOME_VIDEO_NOTE') ?? ''
const SITE_URL = 'https://cefrly.vercel.app'
const COMMUNITY_URL = 'https://t.me/cefrly'
// The super_admin's own account. A student who is stuck, disputes a mark or
// wants to pay is sent HERE, not to the public channel — same split as the web
// app's ADMIN_URL (src/components/Layout.tsx).
const ADMIN_URL = 'https://t.me/cefr_qabul'

const CODE_TTL_MS = 5 * 60 * 1000
const RESEND_GAP_MS = 30 * 1000
const MAX_CODES_PER_REQUEST = 5

const BTN_PHONE = '📱 Send my number'
const BTN_GUIDE = '📖 Guide'
const BTN_FAQ = '❓ FAQ'
const BTN_SITE = '🌐 Open Cefrly'
const BTN_COMMUNITY = '👥 Community'

const MENU = {
  keyboard: [
    [{ text: BTN_PHONE, request_contact: true }],
    [{ text: BTN_GUIDE }, { text: BTN_FAQ }],
    [{ text: BTN_SITE }, { text: BTN_COMMUNITY }],
  ],
  resize_keyboard: true,
  is_persistent: true,
}

const linkButton = (text: string, url: string) => ({ inline_keyboard: [[{ text, url }]] })

const NEW_PASSWORD_DATA = 'newpw'
const VERIFIED_PHONE_TTL_MS = 15 * 60 * 1000
const PASSWORD_GAP_MS = 60 * 1000

/** "998905083995" → "+998 90 508 39 95" */
function formatPhone(phone: string): string {
  const d = phone.slice(3)
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`
}

/** Readable random password, e.g. "kTmz-4829" (no 0/O/1/l look-alikes). */
function randomPassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const part = (alphabet: string, from: number) =>
    [...bytes.slice(from, from + 4)].map((b) => alphabet[b % alphabet.length]).join('')
  return `${part(letters, 0)}-${part(digits, 4)}`
}

const existingAccountMarkup = {
  inline_keyboard: [
    [{ text: '🔑 Get a new password', callback_data: NEW_PASSWORD_DATA }],
    [{ text: '🌐 Log in', url: `${SITE_URL}/login` }],
  ],
}

function existingAccountText(phone: string): string {
  return `This number already has a Cefrly account.\n\nYour login: <b>${formatPhone(phone)}</b>\n\nForgot your password? Tap <b>🔑 Get a new password</b> and I'll send you a new one.`
}

const GUIDE_TEXT = `<b>📖 How Cefrly works</b>

<b>1. Create your account.</b> On the website enter your name and a password, then confirm your phone here with ${BTN_PHONE}. Your phone number is your login.

<b>2. Pick a paper.</b> Reading and Listening mock tests, plus Writing and Speaking marked with the official criteria.

<b>3. Choose a mode.</b> <i>Practice</i> lets you pause and pick your time. <i>Simulation</i> runs like the real exam.

<b>4. Review every answer.</b> When you finish, you go straight to the review: your answer, the correct one, and where it is in the text or recording.

<b>5. Track your progress.</b> Your band and score trend live in <b>My results</b>.`

const FAQ_TEXT = `<b>❓ Frequently asked questions</b>

<b>How is my band estimated?</b>
Reading and Listening have 35 questions, 1 mark each: 28+ is C1, 18–27 is B2, 10–17 is B1. Writing and Speaking are marked out of 75 with the official criteria.

<b>Practice or Simulation?</b>
Practice lets you pause and choose your time. Simulation is timed like the real exam and can't be paused.

<b>I closed the tab during a test. Is it lost?</b>
No. Open the test again and press Resume, your answers are saved. Only the Exit button cancels an attempt.

<b>I forgot my password.</b>
Press ${BTN_PHONE} here and tap <b>🔑 Get a new password</b>. Or press <b>Forgot password?</b> on the login page to choose your own.

<b>Is Cefrly free?</b>
Free tests are open to everyone. Premium tests need a Pro or Premium plan, see Pricing on the website.

Still stuck? Message us directly: ${ADMIN_URL}`

type TgUser = { id: number; first_name?: string; username?: string }
type TgCallback = {
  id: string
  from: TgUser
  data?: string
  message?: { message_id: number; chat: { id: number; type: string } }
}
type TgMessage = {
  chat: { id: number; type: string }
  from?: TgUser
  text?: string
  contact?: { phone_number: string; user_id?: number }
}
// deno-lint-ignore no-explicit-any
type Admin = any

async function sha256(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return n.toString().padStart(6, '0')
}

async function tg(method: string, payload: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) console.error(`telegram ${method} failed`, res.status, await res.text())
  return res.ok
}

function send(chatId: number, text: string, replyMarkup: unknown = MENU) {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  if (!BOT_TOKEN || !WEBHOOK_SECRET) return new Response('not configured', { status: 503 })
  if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 })
  }

  let update: { message?: TgMessage; callback_query?: TgCallback }
  try {
    update = await req.json()
  } catch {
    return new Response('ok')
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  if (update.callback_query) {
    try {
      await handleCallback(admin, update.callback_query)
    } catch (err) {
      console.error('telegram-bot callback error', err)
    }
    return new Response('ok')
  }

  const msg = update.message
  // Private chats only; always answer Telegram 200 so it does not retry.
  if (!msg || !msg.from || msg.chat.type !== 'private') return new Response('ok')

  try {
    const text = msg.text?.trim() ?? ''
    if (text.startsWith('/start')) await handleStart(admin, msg)
    else if (msg.contact) await handleContact(admin, msg)
    else if (text === BTN_GUIDE || text === '/guide') await send(msg.chat.id, GUIDE_TEXT)
    else if (text === BTN_FAQ || text === '/faq') await send(msg.chat.id, FAQ_TEXT)
    else if (text === BTN_SITE) {
      await send(msg.chat.id, 'Practise CEFR mock exams on the website:', linkButton('🌐 Open Cefrly', SITE_URL))
    } else if (text === BTN_COMMUNITY) {
      await send(
        msg.chat.id,
        'Join the Cefrly community for news, tips and help:',
        linkButton('👥 Join the community', COMMUNITY_URL),
      )
    } else {
      await send(msg.chat.id, 'Please use the menu below.')
    }
  } catch (err) {
    console.error('telegram-bot error', err)
  }
  return new Response('ok')
})

/** Remembers the chat and sends the welcome videos the first time only. */
async function welcome(admin: Admin, msg: TgMessage) {
  const from = msg.from!
  const { data: known } = await admin
    .from('telegram_bot_users')
    .select('welcomed_at')
    .eq('telegram_user_id', from.id)
    .maybeSingle()

  await admin.from('telegram_bot_users').upsert({
    telegram_user_id: from.id,
    chat_id: msg.chat.id,
    first_name: from.first_name ?? null,
    username: from.username ?? null,
    last_seen_at: new Date().toISOString(),
  })

  // Only mark someone welcomed once they have actually SEEN the videos, so
  // videos added later still reach people on their next /start.
  if (known?.welcomed_at || (!WELCOME_VIDEO && !WELCOME_VIDEO_NOTE)) return
  let sent = false
  if (WELCOME_VIDEO) sent = (await tg('sendVideo', { chat_id: msg.chat.id, video: WELCOME_VIDEO })) || sent
  if (WELCOME_VIDEO_NOTE) {
    sent = (await tg('sendVideoNote', { chat_id: msg.chat.id, video_note: WELCOME_VIDEO_NOTE })) || sent
  }
  if (sent) {
    await admin
      .from('telegram_bot_users')
      .update({ welcomed_at: new Date().toISOString() })
      .eq('telegram_user_id', from.id)
  }
}

async function handleStart(admin: Admin, msg: TgMessage) {
  await welcome(admin, msg)

  const token = msg.text!.split(/\s+/)[1]
  const name = msg.from!.first_name ? `, ${msg.from!.first_name}` : ''

  if (!token) {
    await send(
      msg.chat.id,
      `Welcome to <b>Cefrly bot</b>${name}! 👋\n\nPractise real-format CEFR mock exams: Reading, Listening, Writing and Speaking, with your band and a full review after every test.\n\nSigning up on the website? Press ${BTN_PHONE} when it asks for your code.`,
    )
    return
  }

  const { data: request } = await admin
    .from('telegram_auth_requests')
    .select('id, telegram_user_id, expires_at, consumed_at, purpose')
    .eq('token_hash', await sha256(token))
    .maybeSingle()

  if (!request || request.consumed_at || new Date(request.expires_at) < new Date()) {
    await send(
      msg.chat.id,
      'This link has expired. Go back to the website, press <b>Start over</b> and open the bot again.',
    )
    return
  }
  if (request.telegram_user_id && request.telegram_user_id !== msg.from!.id) {
    await send(msg.chat.id, 'This link was already opened from another Telegram account.')
    return
  }

  await admin
    .from('telegram_auth_requests')
    .update({ telegram_user_id: msg.from!.id, chat_id: msg.chat.id })
    .eq('id', request.id)

  const what = request.purpose === 'reset' ? 'reset your password' : 'finish signing up'
  await send(
    msg.chat.id,
    `Welcome to <b>Cefrly bot</b>${name}! 👋\n\nTo ${what}, press ${BTN_PHONE} below. I'll reply with a 6-digit code.`,
  )
}

async function handleContact(admin: Admin, msg: TgMessage) {
  const contact = msg.contact!
  // A forwarded or picked contact carries someone else's user_id (or none).
  if (contact.user_id !== msg.from!.id) {
    await send(msg.chat.id, `Please share <b>your own</b> number with the ${BTN_PHONE} button.`)
    return
  }

  const phone = contact.phone_number.replace(/\D/g, '')
  if (!/^998\d{9}$/.test(phone)) {
    await send(msg.chat.id, 'Sorry, only Uzbekistan numbers (+998) can use Cefrly for now.')
    return
  }

  // Telegram vouched for this number (own contact) — remember it briefly so the
  // "Get a new password" button can act on it.
  await admin.from('telegram_bot_users').upsert({
    telegram_user_id: msg.from!.id,
    chat_id: msg.chat.id,
    verified_phone: phone,
    verified_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  })

  const { data: existing } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle()

  const { data: request } = await admin
    .from('telegram_auth_requests')
    .select('id, purpose, code_sent_at, codes_sent, expected_phone')
    .eq('telegram_user_id', msg.from!.id)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // No website request open: just tell them where they stand.
  if (!request) {
    if (existing) {
      await send(msg.chat.id, existingAccountText(phone), existingAccountMarkup)
    } else {
      await send(
        msg.chat.id,
        "This number doesn't have a Cefrly account yet. Sign up on the website — it takes a minute, and you'll come back here for your code.",
        linkButton('🌐 Sign up', `${SITE_URL}/signup`),
      )
    }
    return
  }

  // The login is the number shared here, so it must be the one typed on the site.
  if (request.purpose === 'signup' && request.expected_phone && request.expected_phone !== phone) {
    await send(
      msg.chat.id,
      `This Telegram account's number is <b>${formatPhone(phone)}</b>, but you entered <b>${formatPhone(request.expected_phone)}</b> on the website.\n\nOpen the bot from the Telegram account with that number, or go back, press <b>Start over</b> and enter this number instead.`,
    )
    return
  }

  if (request.purpose === 'signup' && existing) {
    await send(msg.chat.id, existingAccountText(phone), existingAccountMarkup)
    return
  }
  if (request.purpose === 'reset' && !existing) {
    await send(
      msg.chat.id,
      "No Cefrly account uses this number. Sign up instead.",
      linkButton('🌐 Sign up', `${SITE_URL}/signup`),
    )
    return
  }

  if (request.code_sent_at && Date.now() - new Date(request.code_sent_at).getTime() < RESEND_GAP_MS) {
    await send(msg.chat.id, 'I just sent you a code. Wait a few seconds before asking for a new one.')
    return
  }
  if (request.codes_sent >= MAX_CODES_PER_REQUEST) {
    await send(msg.chat.id, 'Too many codes for this request. Press <b>Start over</b> on the website.')
    return
  }

  const code = randomCode()
  const now = new Date()
  await admin
    .from('telegram_auth_requests')
    .update({
      phone,
      code_hash: await sha256(`${request.id}:${code}`),
      code_expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      code_sent_at: now.toISOString(),
      codes_sent: request.codes_sent + 1,
      attempts: 0,
    })
    .eq('id', request.id)

  await send(
    msg.chat.id,
    `Your Cefrly code: <code>${code}</code>\n\nEnter it on the website. It expires in 5 minutes. Never share it with anyone.`,
  )
}

/** "🔑 Get a new password": resets the password of the account whose number
 *  THIS Telegram user verified in the last few minutes, and sends it. */
async function handleCallback(admin: Admin, cb: TgCallback) {
  const answer = (text?: string) =>
    tg('answerCallbackQuery', { callback_query_id: cb.id, ...(text ? { text, show_alert: true } : {}) })

  const chatId = cb.message?.chat.id
  if (cb.data !== NEW_PASSWORD_DATA || !chatId || cb.message?.chat.type !== 'private') {
    await answer()
    return
  }

  const { data: botUser } = await admin
    .from('telegram_bot_users')
    .select('verified_phone, verified_at, last_password_at')
    .eq('telegram_user_id', cb.from.id)
    .maybeSingle()

  const verifiedFresh =
    botUser?.verified_phone &&
    botUser.verified_at &&
    Date.now() - new Date(botUser.verified_at).getTime() < VERIFIED_PHONE_TTL_MS
  if (!verifiedFresh) {
    await answer(`For your safety, press ${BTN_PHONE} again first, then tap the button.`)
    return
  }
  if (botUser.last_password_at && Date.now() - new Date(botUser.last_password_at).getTime() < PASSWORD_GAP_MS) {
    await answer('You just got a new password. Please wait a minute before asking again.')
    return
  }

  const phone: string = botUser.verified_phone
  const { data: profile } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle()
  if (!profile) {
    await answer("This number doesn't have a Cefrly account.")
    return
  }

  const password = randomPassword()
  const { error } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (error) {
    console.error('bot password reset failed', error)
    await answer('Something went wrong. Please try again in a minute.')
    return
  }

  // One password per verification: tapping again needs 📱 again.
  await admin
    .from('telegram_bot_users')
    .update({ last_password_at: new Date().toISOString(), verified_at: null })
    .eq('telegram_user_id', cb.from.id)

  await answer()
  // Drop the button from the old message so it can't be tapped twice by accident.
  await tg('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: cb.message!.message_id,
    reply_markup: linkButton('🌐 Log in', `${SITE_URL}/login`),
  })
  await send(
    chatId,
    `🔑 Your new password: <code>${password}</code>\n\nLogin: <b>${formatPhone(phone)}</b>\n\nYour old password no longer works. After you log in, change this one in <b>Settings → Login &amp; password</b>, then delete this message.`,
    linkButton('🌐 Log in', `${SITE_URL}/login`),
  )
}
