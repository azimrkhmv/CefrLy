import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { consumeSessionExpired } from '../lib/sessionExpiry'
import { AuthShell } from '../components/auth/AuthShell'
import { EyeIcon, EyeOffIcon, GoogleIcon } from '../components/auth/icons'
import { authInputClass, PasswordStrength } from '../components/auth/formBits'

// The design includes a "Forgot password?" link beside a "Remember me" checkbox.
// Neither ships yet, on purpose:
//  · Remember me — Supabase already persists the session in localStorage, so the
//    control would either do nothing or quietly make sessions worse (owner call).
//  · Forgot password — the reset email needs SMTP, which this project has not
//    configured (see CLAUDE.md). The screen IS built, at /forgot-password; only
//    the link is withheld so no student hits a silent dead end. Flip this to true
//    the day SMTP works and the designed row appears.
const SHOW_FORGOT_PASSWORD = false

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [expired, setExpired] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        navigate(from, { replace: true })
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (data.session) {
          navigate(from, { replace: true })
        } else {
          setInfo(
            'Account created. Check your email for a confirmation link, then come back and sign in.',
          )
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // Google OAuth via Supabase. On success the browser redirects to Google (so we
  // don't clear `busy` — the page navigates away); only reset it on error.
  // NOTE: requires the Google provider to be enabled in the Supabase dashboard.
  async function handleGoogle() {
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${from}` },
      })
      if (oauthError) throw oauthError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in.')
      setBusy(false)
    }
  }

  return (
    <AuthShell
      topRight={
        isLogin ? (
          <>
            New here?{' '}
            <Link
              to="/signup"
              state={{ from }}
              className="font-extrabold text-brand no-underline hover:underline"
            >
              Sign up
            </Link>
          </>
        ) : (
          <>
            Have an account?{' '}
            <Link
              to="/login"
              state={{ from }}
              className="font-extrabold text-brand no-underline hover:underline"
            >
              Log in
            </Link>
          </>
        )
      }
      line={(cat) => (isLogin ? cat.hello : cat.helloSignup)}
      sub="Your progress is safe with us."
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* The desktop brand panel carries this eyebrow beside the headline. */}
        <p className="mt-[34px] text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-soft lg:hidden">
          CEFR · Reading paper
        </p>
        <h1 className="mt-2 text-[28px] font-black leading-[1.15] text-heading lg:mt-0 lg:text-[32px]">
          {isLogin ? 'Welcome back' : 'Create an account'}
        </h1>
        <p className="mb-6 mt-2 text-[15px] font-semibold leading-[1.4] text-ink-soft">
          {isLogin
            ? 'Sign in to continue your practice.'
            : 'One free account for all your CEFR practice.'}
        </p>

        <label htmlFor="cef-email" className="mb-2 text-sm font-extrabold text-ink">
          Email
        </label>
        <input
          id="cef-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
          autoComplete="email"
          inputMode="email"
          placeholder="name@email.com"
        />

        <div className="h-3.5" />

        <label htmlFor="cef-pass" className="mb-2 text-sm font-extrabold text-ink">
          Password
        </label>
        <div className="relative w-full">
          <input
            id="cef-pass"
            type={showPw ? 'text' : 'password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${authInputClass} pr-12`}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder="••••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center border-0 bg-transparent p-0 text-ink-soft transition-colors hover:text-ink"
          >
            {showPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {!isLogin && <PasswordStrength password={password} />}

        {isLogin && SHOW_FORGOT_PASSWORD && (
          <div className="mt-3.5 flex justify-end">
            <Link
              to="/forgot-password"
              className="py-1 text-sm font-extrabold text-brand no-underline hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        )}

        {expired && !error && (
          <p
            role="status"
            className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800"
          >
            Your session expired, so we signed you out. Please sign in again — your progress is
            saved.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"
          >
            {error}
          </p>
        )}
        {info && (
          <p
            role="status"
            className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
          >
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-[18px] w-full rounded-xl border-0 bg-brand px-4 py-[15px] text-base font-extrabold text-white shadow-[0_8px_20px_color-mix(in_srgb,var(--color-brand)_22%,transparent)] transition-[background,transform] duration-150 hover:bg-brand-deep active:translate-y-px disabled:opacity-60"
        >
          {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
        </button>

        {/* Google sign-in / registration (needs the Google provider enabled in Supabase) */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-line bg-white px-4 py-3 text-[15px] font-bold text-ink transition-colors hover:border-ink-faint hover:bg-page disabled:opacity-60"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {!isLogin && (
          // The design links "Terms" and "Privacy Policy". Neither page exists in
          // this app yet, so the words are plain text rather than dead links —
          // swap them for <Link>s the moment those routes ship.
          <p className="mt-[18px] text-center text-xs font-semibold leading-[1.5] text-ink-soft">
            By continuing you agree to our{' '}
            <span className="font-bold text-ink">Terms</span> and{' '}
            <span className="font-bold text-ink">Privacy Policy</span>.
          </p>
        )}
      </form>
    </AuthShell>
  )
}
