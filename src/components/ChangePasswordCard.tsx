import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatPhone, isPhoneLoginEmail } from '../lib/phoneAuth'

const inputClass =
  'w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand'

/** Settings → "Login & password". Shows what the student logs in with and lets
 *  them replace their password — e.g. the random one @CefrLy_bot hands out.
 *  The current password is checked first (by signing in with it), so a laptop
 *  left logged in is not enough to take the account over. */
export function ChangePasswordCard() {
  const { session } = useAuth()
  const email = session?.user.email
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (!email) return null
  const login = isPhoneLoginEmail(email) ? formatPhone(email.split('@')[0]) : email

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (next.length < 6) return setError('Your new password needs at least 6 characters.')
    if (next !== confirm) return setError('The two new passwords don’t match.')
    if (next === current) return setError('Choose a password different from your current one.')
    setBusy(true)
    try {
      const check = await supabase.auth.signInWithPassword({ email: email!, password: current })
      if (check.error) throw new Error('Your current password is wrong.')
      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) throw updateError
      setCurrent('')
      setNext('')
      setConfirm('')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-line/50 sm:p-7">
      <h2 className="font-extrabold text-heading">Login &amp; password</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        You log in with <span className="tnum font-bold text-ink">{login}</span>.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="set-pw-current" className="mb-1.5 block text-sm font-bold text-ink">
            Current password
          </label>
          <input
            id="set-pw-current"
            type={show ? 'text' : 'password'}
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="set-pw-new" className="mb-1.5 block text-sm font-bold text-ink">
              New password
            </label>
            <input
              id="set-pw-new"
              type={show ? 'text' : 'password'}
              required
              minLength={6}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="set-pw-confirm" className="mb-1.5 block text-sm font-bold text-ink">
              Confirm new password
            </label>
            <input
              id="set-pw-confirm"
              type={show ? 'text' : 'password'}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">{error}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show passwords
          </label>
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm font-bold text-ok">Password changed ✓</span>}
            <button
              type="submit"
              disabled={busy || !current || !next || !confirm}
              className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
