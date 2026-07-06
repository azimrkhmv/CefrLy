import { useMemo } from 'react'

// Shared selection controls for the onboarding wizard and /settings —
// selected state per the design system: brand-soft wash + brand border + bold.

export function OptionCard({
  selected,
  onClick,
  title,
  sub,
}: {
  selected: boolean
  onClick: () => void
  title: string
  sub?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors ${
        selected ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:border-ink-faint'
      }`}
    >
      <span
        className={`block text-sm ${selected ? 'font-extrabold text-brand-deep' : 'font-bold text-ink'}`}
      >
        {title}
      </span>
      {sub && <span className="mt-0.5 block text-sm text-ink-soft">{sub}</span>}
    </button>
  )
}

export function Chip({
  selected,
  onClick,
  label,
}: {
  selected: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border px-4 py-3 text-sm transition-colors ${
        selected
          ? 'border-brand bg-brand-soft font-extrabold text-brand-deep'
          : 'border-line bg-white font-bold text-ink hover:border-ink-faint'
      }`}
    >
      {label}
    </button>
  )
}

function monthLabel(value: string): string {
  const [y, m] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  )
}

/** The next 12 months as a tappable grid + a "haven't decided" card.
 *  `value`: YYYY-MM-01, null = undecided, undefined = not answered yet.
 *  A saved month outside the rolling window is prepended so the current
 *  selection always stays visible. */
export function MonthGrid({
  value,
  onChange,
}: {
  value: string | null | undefined
  onChange: (value: string | null) => void
}) {
  const months = useMemo(() => {
    const now = new Date()
    const list = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    })
    if (value && !list.includes(value)) list.unshift(value)
    return list
  }, [value])

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {months.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={value === m}
            className={`tnum rounded-xl border px-2 py-2.5 text-sm transition-colors ${
              value === m
                ? 'border-brand bg-brand-soft font-extrabold text-brand-deep'
                : 'border-line bg-white font-bold text-ink hover:border-ink-faint'
            }`}
          >
            {monthLabel(m)}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <OptionCard
          selected={value === null}
          onClick={() => onChange(null)}
          title="Haven’t decided yet"
          sub="We’ll pace things gently until you pick a date."
        />
      </div>
    </div>
  )
}
