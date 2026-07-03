import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

// Serves both /login and /signup. Session persistence is handled by the
// supabase-js client (localStorage) + AuthProvider; this page only signs in/up.
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

  return (
    <div className="mx-auto w-full max-w-sm px-1 py-6 sm:py-12">
      <h1 className="mb-1 text-2xl font-bold">{isLogin ? 'Sign in' : 'Create your account'}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {isLogin
          ? 'Welcome back — sign in to take a test.'
          : 'One free account for all your CEFR practice.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Sign up'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        {isLogin ? (
          <>
            Don&apos;t have an account?{' '}
            <Link to="/signup" state={{ from }} className="font-medium text-indigo-600 hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link to="/login" state={{ from }} className="font-medium text-indigo-600 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
