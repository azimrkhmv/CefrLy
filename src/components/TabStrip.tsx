import type { ReactNode } from 'react'

export type Tab<T extends string | number> = {
  key: T
  label: ReactNode
  /** Renders as a faint, non-interactive "soon" marker instead of a real tab.
   *  (Writing / Speaking on the section strips until those skills ship.) */
  soon?: boolean
}

/**
 * The shared section tab strip — a white pill container on a soft card shadow
 * with a brand-filled active pill and dark, legible inactive tabs. One
 * consistent, premium look across My results, Samples and the test catalogs
 * (this is the strip the rest of the app is being brought in line with). It
 * scrolls horizontally on narrow screens; "soon" tabs are inert labels with a
 * pill. Generic over the key type so string- and number-keyed callers share it.
 */
export function TabStrip<T extends string | number>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: Tab<T>[]
  value: T
  onChange: (key: T) => void
  ariaLabel: string
}) {
  return (
    <div className="max-w-full overflow-x-auto">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-2xl border border-line bg-white p-1.5 shadow-card"
      >
        {tabs.map((tab) =>
          tab.soon ? (
            <span
              key={tab.key}
              title="Coming soon"
              aria-disabled="true"
              className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-extrabold text-ink-faint"
            >
              {tab.label}
              <span className="rounded-full bg-page px-1.5 py-0.5 text-[10px] font-bold lowercase text-ink-soft">
                soon
              </span>
            </span>
          ) : (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={value === tab.key}
              onClick={() => onChange(tab.key)}
              className={`rounded-xl px-5 py-2 text-sm font-extrabold transition-colors ${
                value === tab.key ? 'bg-brand text-white' : 'text-ink hover:text-brand'
              }`}
            >
              {tab.label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
