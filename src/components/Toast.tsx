import { useEffect } from 'react'
import { CheckIcon } from './icons'

/** A small auto-dismissing success notice, bottom-right. Mounted only while
 *  `message` is set; the parent clears it via onDone (or the timer fires). */
export function Toast({
  title,
  message,
  onDone,
  duration = 2600,
}: {
  title: string
  message?: string
  onDone: () => void
  duration?: number
}) {
  useEffect(() => {
    const t = setTimeout(onDone, duration)
    return () => clearTimeout(t)
  }, [onDone, duration])

  return (
    <div
      role="status"
      aria-live="polite"
      className="reveal fixed bottom-5 right-5 z-[90] flex max-w-xs items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-card"
    >
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
        <CheckIcon width={14} height={14} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-heading">{title}</p>
        {message && <p className="mt-0.5 text-xs text-ink-soft">{message}</p>}
      </div>
    </div>
  )
}
