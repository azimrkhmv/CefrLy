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
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'

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
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} ${mono ? 'font-mono' : ''} ${disabled ? 'bg-slate-100 text-slate-500' : ''}`}
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
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
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
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
      <span className="mb-1 block text-sm font-medium">{label}</span>
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
    <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Explanation{' '}
        <span className={complete ? 'text-emerald-600' : 'text-amber-600'}>
          {complete ? '✓' : '(required)'}
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
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="q-badge">{number}</span>
        <span className="font-mono text-xs text-slate-400">id: {itemId}</span>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
