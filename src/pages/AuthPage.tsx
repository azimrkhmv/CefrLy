import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ArrowRightIcon } from '../components/icons'

// Serves both /login and /signup as a standalone full-screen page (no app
// shell). Session persistence is handled by supabase-js + AuthProvider.
export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const isLogin = mode === 'login'

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
            'Account created! Check your email for a confirmation link, then come back and sign in.',
          )
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-base font-semibold text-heading placeholder:font-normal placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft sm:text-sm'

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden flex-col bg-brand-deep p-10 text-white lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">
            C
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold tracking-tight">Cefrly</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
              CEFR Exams
            </span>
          </span>
        </Link>

        <div className="my-auto py-14">
          <h1 className="max-w-md text-3xl font-bold leading-tight">
            See your <span className="text-sun">Reading band</span> in 60 minutes.
          </h1>
          <div className="mt-10 flex items-center gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-7 py-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Before
              </p>
              <p className="font-num text-5xl font-bold">B1</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sun">
                Practice
              </p>
              <ArrowRightIcon className="mx-auto mt-1 text-sun" width={40} height={22} />
            </div>
            <div className="rounded-2xl border border-sun/40 bg-white/10 px-7 py-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sun">
                After
              </p>
              <p className="font-num text-5xl font-bold text-sun">C1</p>
            </div>
          </div>
          <p className="mt-10 flex items-center gap-2 text-sm font-semibold text-white/70">
            <span className="h-2 w-2 rounded-full bg-mint" aria-hidden />
            The real exam format — 35 questions, 5 parts, instant band score
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5 self-start lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-deep text-lg font-bold text-white">
            C
          </span>
          <span className="text-lg font-bold tracking-tight text-heading">Cefrly</span>
        </Link>

        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h2 className="text-center text-3xl font-bold text-heading sm:text-4xl">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="mt-2 text-center text-sm font-semibold text-ink-soft">
            {isLogin
              ? 'Sign in to continue your practice.'
              : 'One free account for all your CEFR practice.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate={false}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-heading">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-heading">Password</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
              />
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-semibold text-rose-700">
                {error}
              </p>
            )}
            {info && (
              <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-700">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
            >
              {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm font-semibold text-ink-soft">
            {isLogin ? (
              <>
                Don&apos;t have an account?{' '}
                <Link to="/signup" state={{ from }} className="font-bold text-brand hover:underline">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link to="/login" state={{ from }} className="font-bold text-brand hover:underline">
                  Log in
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
