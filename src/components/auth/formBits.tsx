/** The design's text-field treatment, shared by every auth form so sign in,
 *  sign up and reset stay identical. Focus lifts the border to accent and adds
 *  the soft accent ring from the design. */
export const authInputClass =
  'w-full box-border rounded-xl border-2 border-line bg-page px-4 py-3.5 text-[15px] font-bold text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-semibold placeholder:text-ink-faint focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_13%,transparent)]'

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
export function PasswordStrength({ password }: { password: string }) {
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
      <p className="mt-2 text-xs font-semibold leading-[1.4] text-ink-soft">
        At least 6 characters. Add a number to make it strong.
      </p>
    </>
  )
}
