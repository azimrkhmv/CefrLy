import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { completeTelegramReset, startTelegramAuth, type TelegramStart } from '../lib/phoneAuth'
import { AuthShell } from '../components/auth/AuthShell'
import { ChevronLeftIcon } from '../components/auth/icons'
import { authPrimaryButtonClass, PasswordField } from '../components/auth/formBits'
import { TelegramCodeStep, TelegramIcon } from '../components/auth/TelegramCodeStep'

/** "Reset your password" through @CefrLy_bot: the student shares their number
 *  in the bot, gets a code, and sets a new password here. Only accounts that
 *  signed up with Telegram (phone) can use it; the bot tells anyone else. */
export function ForgotPasswordPage() {
  const { session } = useAuth()
  const [start, setStart] = useState<TelegramStart | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)

  // A successful reset signs the student in; send them home.
  if (session) return <Navigate to="/" replace />

  async function begin() {
    setError(null)
    setBusy(true)
    try {
      setStart(await startTelegramAuth('reset'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function verify(code: string) {
    if (password.length < 6) throw new Error('Your new password needs at least 6 characters.')
    if (password !== confirm) throw new Error('The two passwords don’t match.')
    await completeTelegramReset({ token: start!.token, code, password })
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
      sub="Your code comes from our Telegram bot."
    >
      {start ? (
        <TelegramCodeStep
          start={start}
          title="Reset your password"
          intro="First get your code from our Telegram bot. Then come back here to set a new password."
          confirmLabel="Save new password"
          onVerify={verify}
          onRestart={() => setStart(null)}
        >
          <div className="flex flex-col">
            <PasswordField
              id="cef-new-pass"
              label="New password"
              value={password}
              onChange={setPassword}
              show={showPw}
              onToggleShow={() => setShowPw((v) => !v)}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
            <div className="h-3.5" />
            <PasswordField
              id="cef-new-confirm"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              show={showPw}
              autoComplete="new-password"
              placeholder="Type it again"
            />
          </div>
        </TelegramCodeStep>
      ) : (
        <div className="flex flex-col">
          <p className="mt-[34px] text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-soft lg:hidden">
            Account
          </p>
          <h1 className="mt-2 text-[28px] font-black leading-[1.15] text-heading lg:mt-0 lg:text-[32px]">
            Reset your password
          </h1>
          <p className="mb-6 mt-2 text-[15px] font-semibold leading-[1.4] text-ink-soft">
            We’ll confirm it’s you through our Telegram bot, using the phone number on your account.
          </p>

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={begin}
            disabled={busy}
            className={authPrimaryButtonClass}
          >
            <TelegramIcon />
            {busy ? 'Please wait…' : 'Get a code in Telegram'}
          </button>

        </div>
      )}
    </AuthShell>
  )
}
