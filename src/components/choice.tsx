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

