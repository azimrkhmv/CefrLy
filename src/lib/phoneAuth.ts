import { supabase } from './supabase'

// Telegram sign-up / password reset (see supabase/functions/telegram-auth).
// Phone accounts sign in with a synthetic login email derived from the number,
// because Supabase's phone provider is off. Nothing is ever mailed to it.

/** Keep in lockstep with loginEmailForPhone in the telegram-auth function. */
export function loginEmailForPhone(phone: string): string {
  return `${phone}@phone.cefrly.app`
}

export function isPhoneLoginEmail(email: string | undefined): boolean {
  return !!email && email.endsWith('@phone.cefrly.app')
}

/** The 9 local digits a student types after the fixed +998 → "998XXXXXXXXX". */
export function fullPhone(localDigits: string): string | null {
  const d = localDigits.replace(/\D/g, '')
  return d.length === 9 ? `998${d}` : null
}

/** "901234567" → "90 123 45 67" (formats as the student types). */
export function formatLocalPhone(localDigits: string): string {
  const d = localDigits.replace(/\D/g, '').slice(0, 9)
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
}

/** "998901234567" → "+998 90 123 45 67" */
export function formatPhone(phone: string): string {
  return `+998 ${formatLocalPhone(phone.slice(3))}`
}

export type TelegramPurpose = 'signup' | 'reset'

export type TelegramStart = { token: string; botUrl: string; expiresAt: string }
export type TelegramStatus = { botOpened: boolean; codeSent: boolean; phone: string | null; expired: boolean }

/** Thrown when the request itself is dead (expired / used) — the UI offers Start over. */
export class TelegramExpiredError extends Error {}

/** Sign-up start refused: the typed number already has an account. */
export class PhoneExistsError extends Error {}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('telegram-auth', { body })
  if (error) {
    let message = 'Something went wrong. Please try again.'
    let code: string | undefined
    const ctx = (error as { context?: Response }).context
    if (ctx) {
      try {
        const parsed = (await ctx.json()) as { error?: string; code?: string }
        if (parsed.error) message = parsed.error
        code = parsed.code
      } catch {
        // keep the generic message
      }
    }
    if (code === 'expired') throw new TelegramExpiredError(message)
    if (code === 'phone_exists') throw new PhoneExistsError(message)
    throw new Error(message)
  }
  return data as T
}

/** `phone` ("998XXXXXXXXX") is required for sign-up: the server refuses a
 *  number that already has an account before the student opens the bot. */
export const startTelegramAuth = (purpose: TelegramPurpose, phone?: string) =>
  call<TelegramStart>({ action: 'start', purpose, ...(phone ? { phone } : {}) })

export const fetchTelegramStatus = (token: string) =>
  call<TelegramStatus>({ action: 'status', token })

export async function completeTelegramSignup(input: {
  token: string
  code: string
  password: string
}) {
  const { email } = await call<{ email: string }>({ action: 'signup', ...input })
  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password })
  if (error) throw error
}

export async function completeTelegramReset(input: { token: string; code: string; password: string }) {
  const { email } = await call<{ email: string }>({ action: 'reset', ...input })
  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password })
  if (error) throw error
}
