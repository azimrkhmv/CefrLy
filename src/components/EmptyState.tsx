import type { ReactNode } from 'react'
import { Cat, type CatPose } from './Cat'

// The reference-style empty state: dashed border, mascot, title, hint, action.
export function EmptyState({
  pose = 'nap',
  title,
  hint,
  action,
}: {
  pose?: CatPose
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <Cat pose={pose} width={150} height={pose === 'peek' ? 70 : 130} className="mx-auto" />
      <p className="mt-4 text-lg font-bold text-heading">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
