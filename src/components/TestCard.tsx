import { Link } from 'react-router-dom'
import type { TestCatalogEntry } from '../types/attempt'
import { BookIcon, PlayIcon } from './icons'

// Card colors cycle so a grid of tests gets the friendly multi-color look.
const ICON_COLORS = ['#14b8a6', '#f97316', '#8b5cf6', '#ec4899', '#3b82f6', '#f43f5e']

export interface TestAttemptInfo {
  count: number
  best: number | null
}

export function TestCard({
  test,
  index,
  attemptInfo,
}: {
  test: TestCatalogEntry
  index: number
  attemptInfo?: TestAttemptInfo
}) {
  const color = ICON_COLORS[index % ICON_COLORS.length]
  const attemptsLabel =
    attemptInfo && attemptInfo.count > 0
      ? `Best score: ${attemptInfo.best}/35 · ${attemptInfo.count} attempt${attemptInfo.count > 1 ? 's' : ''}`
      : 'No attempts yet'

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-pop">
      <div className="flex items-start gap-3.5">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          <BookIcon width={22} height={22} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[17px] font-bold leading-snug text-heading">{test.title}</h3>
          <span className="mt-1.5 inline-block rounded-full bg-sun-soft px-2.5 py-0.5 text-xs font-bold text-sun-ink">
            Full Mock Test
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">{attemptsLabel}</p>
        <Link
          to={`/test/${test.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-brand px-4 py-1.5 text-sm font-bold text-brand transition-colors hover:bg-brand hover:text-white"
        >
          <PlayIcon width={14} height={14} />
          Start
        </Link>
      </div>

      <div className="mt-4 border-t border-line pt-3.5">
        <p className="mb-2 text-sm text-ink-soft">Question levels:</p>
        <div className="flex flex-wrap gap-2">
          {test.target_levels.map((level) => (
            <span
              key={level}
              className="rounded-lg border border-line px-3.5 py-1 text-sm font-semibold text-heading"
            >
              {level}
            </span>
          ))}
          <span className="rounded-lg border border-line px-3.5 py-1 text-sm font-semibold text-heading">
            {Math.round(test.duration_sec / 60)} min
          </span>
        </div>
      </div>
    </div>
  )
}
