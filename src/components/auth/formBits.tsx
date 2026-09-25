import { EyeIcon, EyeOffIcon } from './icons'
import { formatLocalPhone } from '../../lib/phoneAuth'

/** The design's text-field treatment, shared by every auth form so sign in,
 *  sign up and reset stay identical. Focus lifts the border to accent and adds
 *  the soft accent ring from the design. */
export const authInputClass =
  'w-full box-border rounded-xl border-[1.5px] border-line bg-page px-4 py-4 text-[15px] font-bold text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-semibold placeholder:text-ink-faint focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_13%,transparent)]'

/** The primary button on every auth screen: brand gradient with an
 *  accent-lifted left edge, per the owner's design. No margin — callers add it. */
export const authPrimaryButtonClass =
  'inline-flex w-full items-center justify-center gap-3 rounded-xl border-0 bg-linear-to-r from-[color-mix(in_srgb,var(--color-brand)_78%,var(--color-accent))] to-brand px-4 py-[17px] text-base font-extrabold text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--color-brand)_26%,transparent)] transition-[filter,transform] duration-150 hover:brightness-110 active:translate-y-px disabled:opacity-60'

/** Rough, deliberately forgiving password strength. Three bands, because more
 *  precision than that is theatre — the only hard rule is Supabase's 6-char
 *  minimum, which the input already enforces. */
function scorePassword(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10 || /\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password))) score++
  return Math.min(score, 3) as 0 | 1 | 2 | 3
}

const BANDS = {
  1: { label: 'Weak', width: '33%', bar: 'bg-sun', text: 'text-sun-ink' },
  2: { label: 'Good', width: '70%', bar: 'bg-ok', text: 'text-ok' },
  3: { label: 'Strong', width: '100%', bar: 'bg-ok', text: 'text-ok' },
} as const

/** Meter + hint under the sign-up password field (design 1c "Sign up"). */
export function PasswordStrength({ password, hint = true }: { password: string; hint?: boolean }) {
  const score = scorePassword(password)
  // Narrow here rather than inline: `score > 0` inside JSX does not narrow the
  // 0 | 1 | 2 | 3 union down to a valid BANDS key.
  const band = score === 0 ? null : BANDS[score]

  return (
    <>
      {band && (
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <span
              className={`block h-full rounded-full transition-[width,background-color] duration-200 ${band.bar}`}
              style={{ width: band.width }}
            />
          </span>
          <span className={`text-xs font-extrabold ${band.text}`} aria-live="polite">
            {band.label}
          </span>
        </div>
      )}
      {hint && (
        <p className="mt-2 text-xs font-semibold leading-[1.4] text-ink-soft">
          At least 6 characters. Add a number to make it strong.
        </p>
      )}
    </>
  )
}

/** Label + password input with the show/hide eye, shared by every auth form. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  placeholder = '••••••••••',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  show: boolean
  onToggleShow?: () => void
  autoComplete: string
  placeholder?: string
}) {
  return (
    <>
      <label htmlFor={id} className="mb-2 text-sm font-extrabold text-ink">
        {label}
      </label>
      <div className="relative w-full">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          minLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${authInputClass} ${onToggleShow ? 'pr-12' : ''}`}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        {onToggleShow && (
          <button
            type="button"
            onClick={onToggleShow}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center border-0 bg-transparent p-0 text-ink-soft transition-colors hover:text-ink"
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
    </>
  )
}

/** "+998" fixed prefix + 9 local digits, formatted as typed. */
export function PhoneField({ value, onChange }: { value: string; onChange: (digits: string) => void }) {
  return (
    <>
      <label htmlFor="cef-phone" className="mb-2 text-sm font-extrabold text-ink">
        Phone number
      </label>
      <div className="relative w-full">
        <span className="tnum pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-extrabold text-ink">
          +998
        </span>
        <input
          id="cef-phone"
          type="tel"
          required
          value={formatLocalPhone(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
          className={`${authInputClass} tnum pl-[62px]`}
          autoComplete="tel-national"
          inputMode="numeric"
          placeholder="90 123 45 67"
        />
      </div>
    </>
  )
}
