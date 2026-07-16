import { useEffect, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from './icons'

export type DropdownOption<T extends string> = { value: T; label: string }

/**
 * A custom select — replaces the native <select> so the open menu follows the
 * design system (a native <select>'s option list is OS-rendered and can't be
 * styled). Trigger + popover styled with @theme tokens; closes on outside
 * click, Escape, or selection.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  align = 'right',
}: {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-xl border bg-white py-2 pl-3.5 pr-2.5 text-sm font-bold text-ink transition-colors ${
          open ? 'border-brand ring-2 ring-brand/20' : 'border-line hover:border-ink-faint'
        }`}
      >
        {current?.label ?? ariaLabel}
        <ChevronDownIcon
          width={14}
          height={14}
          className={`text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-30 mt-2 min-w-[11rem] rounded-xl border border-line bg-white p-1.5 shadow-card ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((opt) => {
            const selected = opt.value === value
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors ${
                    selected ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-page'
                  }`}
                >
                  {opt.label}
                  {selected && <CheckIcon width={14} height={14} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
