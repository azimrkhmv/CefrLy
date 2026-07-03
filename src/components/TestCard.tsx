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
    <div className="flex flex-col rounded-xl border border-line bg-white p-6 transition-colors hover:border-brand/30">
      <div className="flex items-start gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          <BookIcon width={20} height={20} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug text-heading">{test.title}</h3>
          <span className="mt-2 inline-block rounded-md bg-sun-soft px-2.5 py-1 text-xs font-semibold text-sun-ink">
            Full Mock Test
          </span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-[15px] text-ink-soft">{attemptsLabel}</p>
        <Link
          to={`/test/${test.id}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-brand/70 px-5 py-2 text-[15px] font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
        >
          <PlayIcon width={13} height={13} />
          Start
        </Link>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-2.5 text-sm text-ink-soft">Question levels:</p>
        <div className="flex flex-wrap gap-2">
          {test.target_levels.map((level) => (
            <span
              key={level}
              className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-ink"
            >
              {level}
            </span>
          ))}
          <span className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-ink">
            {Math.round(test.duration_sec / 60)} min
          </span>
        </div>
      </div>
    </div>
  )
}
