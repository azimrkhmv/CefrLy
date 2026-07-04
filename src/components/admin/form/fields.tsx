import type { ReactNode } from 'react'
import type { Explanation } from '../../../types/test'

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h2 className="text-lg font-extrabold text-heading">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

const inputClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft'

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  disabled,
  mono,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  disabled?: boolean
  mono?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} ${mono ? 'tnum' : ''} ${disabled ? 'bg-page text-ink-soft' : ''}`}
      />
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">— choose —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** location + quote + reasoning, collapsed behind a details element. */
export function ExplanationEditor({
  value,
  onChange,
}: {
  value: Explanation
  onChange: (value: Explanation) => void
}) {
  const complete = value.location.trim() && value.quote.trim() && value.reasoning.trim()
  return (
    <details className="rounded-xl bg-page p-3">
      <summary className="cursor-pointer text-sm font-bold">
        Explanation{' '}
        <span className={complete ? 'text-ok' : 'text-amber-700'}>
          {complete ? 'complete' : '(required)'}
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        <TextField
          label="Where in the text"
          value={value.location}
          onChange={(location) => onChange({ ...value, location })}
          placeholder="e.g. Paragraph 2"
        />
        <TextAreaField
          label="Quote"
          rows={2}
          value={value.quote}
          onChange={(quote) => onChange({ ...value, quote })}
          placeholder="the sentence from the text that proves the answer"
        />
        <TextAreaField
          label="Reasoning"
          rows={2}
          value={value.reasoning}
          onChange={(reasoning) => onChange({ ...value, reasoning })}
          placeholder="why this is the correct answer"
        />
      </div>
    </details>
  )
}

export function QuestionCard({
  number,
  itemId,
  children,
  right,
}: {
  number: number
  itemId: string
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="q-badge">{number}</span>
        <span className="tnum text-xs text-ink-faint">id: {itemId}</span>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
