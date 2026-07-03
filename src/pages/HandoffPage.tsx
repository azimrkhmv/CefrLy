import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { milliymockHandoff } from '../lib/api'
import { supabase } from '../lib/supabase'

// Landing page for MilliyMock users: /handoff?token=<short-lived JWT>.
// Exchanges the token for a one-time login and signs the user in — no
// registration, no password.
export function HandoffPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  // the token is single-use, so make sure we only ever send it once
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const token = searchParams.get('token')
    if (!token) {
      setError('This hand-off link is missing its token.')
      return
    }

    ;(async () => {
      try {
        const { tokenHash } = await milliymockHandoff(token)
        const { error: otpError } = await supabase.auth.verifyOtp({
          type: 'email',
          token_hash: tokenHash,
        })
        if (otpError) throw new Error(otpError.message)
        navigate('/', { replace: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.')
      }
    })()
  }, [searchParams, navigate])

  if (error) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-xl font-bold">Could not sign you in</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <p className="mt-4 text-sm text-slate-500">
          Go back to MilliyMock and try the link again, or{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            sign in with email
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <p className="py-24 text-center text-slate-500">Signing you in from MilliyMock…</p>
  )
}
