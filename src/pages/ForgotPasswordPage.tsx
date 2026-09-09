import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthShell } from '../components/auth/AuthShell'
import { ChevronLeftIcon } from '../components/auth/icons'
import { authInputClass } from '../components/auth/formBits'

/** "Reset your password" from design 1c.
 *
 *  ⚠️ BUILT BUT NOT YET LINKED. Supabase sends the reset email through SMTP,
 *  which this project has not configured (see CLAUDE.md — the dev-only
 *  auto_confirm_on_signup trigger exists precisely because there is no mail
 *  server). Until SMTP is set up the request below succeeds and no email ever
 *  arrives, so AuthPage keeps SHOW_FORGOT_PASSWORD = false and nothing links
 *  here. The route stays registered so the screen can be opened and tested
 *  directly; flip that flag once mail actually sends. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      topRight={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-extrabold text-brand no-underline hover:underline"
        >
          <ChevronLeftIcon />
          Sign in
        </Link>
      }
      line={(cat) => cat.bye}
      sub="The link expires in 1 hour."
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <p className="mt-[34px] text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-soft lg:hidden">
          Account
        </p>
        <h1 className="mt-2 text-[28px] font-black leading-[1.15] text-heading lg:mt-0 lg:text-[32px]">
          Reset your password
        </h1>
        <p className="mb-6 mt-2 text-[15px] font-semibold leading-[1.4] text-ink-soft">
          Enter your email and we’ll send you a reset link.
        </p>

        <label htmlFor="cef-reset-email" className="mb-2 text-sm font-extrabold text-ink">
          Email
        </label>
        <input
          id="cef-reset-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
          autoComplete="email"
          inputMode="email"
          placeholder="name@email.com"
        />

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"
          >
            {error}
          </p>
        )}
        {sent && (
          // Supabase deliberately reports success whether or not the address has
          // an account, so we must not claim an email was definitely sent to it.
          <p
            role="status"
            className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
          >
            If an account exists for {email}, a reset link is on its way.
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-[22px] w-full rounded-xl border-0 bg-brand px-4 py-[15px] text-base font-extrabold text-white shadow-[0_8px_20px_color-mix(in_srgb,var(--color-brand)_22%,transparent)] transition-[background,transform] duration-150 hover:bg-brand-deep active:translate-y-px disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send reset link'}
        </button>

        <p className="mt-[18px] text-center text-[13px] font-semibold leading-[1.5] text-ink-soft">
          The link expires in 1 hour. Check your spam folder if it doesn’t arrive.
        </p>
      </form>
    </AuthShell>
  )
}
