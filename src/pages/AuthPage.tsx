import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { consumeSessionExpired } from '../lib/sessionExpiry'
import {
  completeTelegramSignup,
  formatLocalPhone,
  fullPhone,
  loginEmailForPhone,
  PhoneExistsError,
  startTelegramAuth,
  type TelegramStart,
} from '../lib/phoneAuth'
import { AuthShell } from '../components/auth/AuthShell'
import { TelegramCodeStep } from '../components/auth/TelegramCodeStep'
import {
  authInputClass,
  PasswordField,
  PasswordStrength,
  PhoneField,
} from '../components/auth/formBits'

// Sign up = name, surname, father's name, password → Telegram code (the phone
// number comes from the student's own Telegram account, never typed here).
// Log in = phone + password. (The email login for pre-Telegram accounts was
// removed on the owner's call, 2026-09-14.)
// "Remember me" is still not shipped: Supabase already persists the session.

const primaryButton =
  'mt-[18px] w-full rounded-xl border-0 bg-brand px-4 py-[15px] text-base font-extrabold text-white shadow-[0_8px_20px_color-mix(in_srgb,var(--color-brand)_22%,transparent)] transition-[background,transform] duration-150 hover:bg-brand-deep active:translate-y-px disabled:opacity-60'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const location = useLocation()
  const { session } = useAuth()
  const [expired, setExpired] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const isLogin = mode === 'login'

  // We were signed out because the server refused the stored token (see
  // SessionExpiredError) — say so, otherwise arriving here looks like a bug.
  // Read in an effect, not a state initializer: consuming the flag is a side
  // effect, and StrictMode double-invokes initializers. Only ever set true, so
  // the re-run that finds the flag already cleared leaves the notice standing.
  useEffect(() => {
    if (consumeSessionExpired()) setExpired(true)
  }, [])

  if (session) return <Navigate to={from} replace />

  return (
    <AuthShell
      line={(cat) => (isLogin ? cat.hello : cat.helloSignup)}
      // The design gives each screen its own steady second line under the
      // cat's, rather than one shared reassurance string.
      sub={isLogin ? 'The official reading format, timed and scored.' : 'One free account, all four papers.'}
    >
      {isLogin ? <LoginForm from={from} expired={expired} /> : <SignupFlow from={from} />}
    </AuthShell>
  )
}

function Heading({ title, intro }: { title: string; intro?: string }) {
  return (
    <>
      {/* The desktop brand panel carries this eyebrow beside the headline. */}
      <p className="mt-[34px] text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-soft lg:hidden">
        CEFR · Reading paper
      </p>
      <h1 className="mt-2 text-[28px] font-black leading-[1.15] text-heading lg:mt-0 lg:text-[32px]">
        {title}
      </h1>
      {intro ? (
        <p className="mb-6 mt-2 text-[15px] font-semibold leading-[1.4] text-ink-soft">{intro}</p>
      ) : (
        <div className="h-5" />
      )}
    </>
  )
}

function ErrorNote({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"
    >
      {children}
    </p>
  )
}

function SwitchLine({ isLogin, from }: { isLogin: boolean; from: string }) {
  return (
    <div className="mt-6 border-t border-line pt-5 text-center">
      <p className="text-[15px] font-bold text-ink-soft">
        {isLogin ? 'New to Cefrly?' : 'Already have an account?'}
      </p>
      <Link
        to={isLogin ? '/signup' : '/login'}
        state={{ from }}
        className="mt-3 block w-full rounded-xl border-2 border-brand bg-white px-4 py-[13px] text-base font-extrabold text-brand no-underline transition-colors hover:bg-brand-soft"
      >
        {isLogin ? 'Create an account' : 'Log in'}
      </Link>
    </div>
  )
}

// ---- Log in ------------------------------------------------------------------

function LoginForm({ from, expired }: { from: string; expired: boolean }) {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const full = fullPhone(phone)
    if (!full) {
      setError('Enter the 9 digits of your phone number after +998.')
      return
    }
    setBusy(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmailForPhone(full),
        password,
      })
      if (signInError) {
        throw new Error(
          /invalid login credentials/i.test(signInError.message)
            ? 'Wrong phone number or password.'
            : signInError.message,
        )
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <Heading title="Welcome back" intro="Sign in to continue your practice." />

      <PhoneField value={phone} onChange={setPhone} />

      <div className="h-3.5" />
      <PasswordField
        id="cef-pass"
        label="Password"
        value={password}
        onChange={setPassword}
        show={showPw}
        onToggleShow={() => setShowPw((v) => !v)}
        autoComplete="current-password"
      />

      <div className="mt-3.5 flex justify-end">
        <Link to="/forgot-password" className="py-1 text-sm font-extrabold text-brand no-underline hover:underline">
          Forgot password?
        </Link>
      </div>

      {expired && !error && (
        <p
          role="status"
          className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800"
        >
          Your session expired, so we signed you out. Please sign in again — your progress is saved.
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}

      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? 'Please wait…' : 'Sign in'}
      </button>

      <SwitchLine isLogin from={from} />
    </form>
  )
}

// ---- Sign up: form → Telegram code ---------------------------------------------

function SignupFlow({ from }: { from: string }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [fatherName, setFatherName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneTaken, setPhoneTaken] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [start, setStart] = useState<TelegramStart | null>(null)

  async function handleContinue(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPhoneTaken(false)
    if (!firstName.trim() || !lastName.trim() || !fatherName.trim()) {
      setError("Please fill in your first name, surname and father's name.")
      return
    }
    const full = fullPhone(phone)
    if (!full) {
      setError('Enter the 9 digits of your phone number after +998.')
      return
    }
    if (password.length < 6) {
      setError('Your password needs at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setBusy(true)
    try {
      setStart(await startTelegramAuth('signup', full))
    } catch (err) {
      if (err instanceof PhoneExistsError) {
        setPhoneTaken(true)
        return
      }
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (start) {
    return (
      <TelegramCodeStep
        start={start}
        title="Enter the code"
        intro={`Open our Telegram bot from the account with +998 ${formatLocalPhone(phone)} and press 📱 Send my number to get your code.`}
        confirmLabel="Confirm"
        onVerify={(code) =>
          // On success the session appears and AuthPage redirects on its own.
          completeTelegramSignup({
            token: start.token,
            code,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            fatherName: fatherName.trim(),
            password,
          })
        }
        onRestart={() => setStart(null)}
      />
    )
  }

  const nameInput = (id: string, label: string, value: string, set: (v: string) => void, placeholder: string, autoComplete: string) => (
    <div className="flex min-w-0 flex-1 flex-col">
      <label htmlFor={id} className="mb-2 text-sm font-extrabold text-ink">
        {label}
      </label>
      <input
        id={id}
        required
        maxLength={60}
        value={value}
        onChange={(e) => set(e.target.value)}
        className={authInputClass}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <form onSubmit={handleContinue} className="flex flex-col">
      <Heading title="Create an account" />

      <div className="flex flex-col gap-3.5 sm:flex-row">
        {nameInput('cef-first', 'First name', firstName, setFirstName, 'Aziz', 'given-name')}
        {nameInput('cef-last', 'Surname', lastName, setLastName, 'Karimov', 'family-name')}
      </div>
      <div className="h-3.5" />
      {nameInput('cef-father', "Father's name", fatherName, setFatherName, 'Karimovich', 'additional-name')}

      <div className="h-3.5" />
      <PhoneField
        value={phone}
        onChange={(v) => {
          setPhone(v)
          setPhoneTaken(false)
        }}
      />
      {phoneTaken && (
        <div
          role="alert"
          className="mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800"
        >
          This number already has a Cefrly account. Use a different number, or{' '}
          <Link to="/login" state={{ from }} className="font-extrabold text-brand underline">
            log in with it
          </Link>
          .
        </div>
      )}

      <div className="h-3.5" />
      <PasswordField
        id="cef-pass"
        label="Password"
        value={password}
        onChange={setPassword}
        show={showPw}
        onToggleShow={() => setShowPw((v) => !v)}
        autoComplete="new-password"
        placeholder="At least 6 characters"
      />
      <PasswordStrength password={password} />

      <div className="h-3.5" />
      <PasswordField
        id="cef-confirm"
        label="Confirm password"
        value={confirm}
        onChange={setConfirm}
        show={showPw}
        autoComplete="new-password"
        placeholder="Type your password again"
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? 'Please wait…' : 'Continue'}
      </button>

      {/* New tab: following a link in place would throw away the half-filled form. */}
      <p className="mt-[18px] text-center text-xs font-semibold leading-[1.5] text-ink-soft">
        By continuing you agree to our{' '}
        <Link to="/terms" target="_blank" className="font-bold text-brand hover:underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" target="_blank" className="font-bold text-brand hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <SwitchLine isLogin={false} from={from} />
    </form>
  )
}
