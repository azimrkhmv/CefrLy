import type { ReactNode } from 'react'
import { CloseIcon } from '../icons'

// The one exam top bar for Speaking — the same shape every other paper uses:
// Exit on the left, the paper's identity beside it, actions on the right.
// Every screen of an attempt (mic check, questions, results) renders it, so the
// header never moves or changes character mid-attempt.
//
// Speaking carries no timer and no pause: an answer runs as long as the student
// needs, so there is nothing to count down or freeze.
export function SpeakingTopBar({
  title,
  subtitle,
  onExit,
  exitLabel = 'Exit',
  exitTitle,
  children,
}: {
  title: string
  subtitle?: string
  onExit: () => void
  exitLabel?: string
  /** Native tooltip — used to warn that leaving cancels the attempt. */
  exitTitle?: string
  /** Right-hand actions (Submit, progress, "Back to Speaking"…). */
  children?: ReactNode
}) {
  return (
    <header className="shrink-0 border-b border-line bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={onExit}
            title={exitTitle}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <CloseIcon width={18} height={18} />
            <span className="hidden sm:inline">{exitLabel}</span>
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-heading">{title}</h1>
            {subtitle && <p className="hidden truncate text-xs text-ink-soft sm:block">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="flex shrink-0 items-center gap-2 sm:gap-3">{children}</div>}
      </div>
    </header>
  )
}
