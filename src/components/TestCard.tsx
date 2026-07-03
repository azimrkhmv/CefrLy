import { Link } from 'react-router-dom'
import type { TestCatalogEntry } from '../types/attempt'
import { BookIcon, PlayIcon } from './icons'

// Circle colors cycle so the grid gets the friendly multi-color look
// (pixel-measured from the reference design).
const ICON_COLORS = ['#12ad9d', '#f06310', '#a048f2', '#e73e8f', '#3174f1', '#e13383']

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
    <div className="flex flex-col rounded-xl border border-line bg-white p-6">
      <div className="flex items-start gap-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          <BookIcon width={22} height={22} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-[1.4] text-heading">{test.title}</h3>
          <span className="mt-2.5 inline-block rounded-md bg-sun-soft px-3 py-1 text-[13px] font-medium text-sun-ink">
            Full Mock Test
          </span>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        <p className="text-[15px] text-ink-soft">{attemptsLabel}</p>
        <Link
          to={`/test/${test.id}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-brand px-6 py-2 text-[15px] font-medium text-brand transition-colors hover:bg-brand hover:text-white"
        >
          <PlayIcon width={13} height={13} />
          Start
        </Link>
      </div>

      <div className="mt-6 border-t border-[#ececec] pt-5">
        <p className="mb-3 text-sm text-ink-soft">
          Question levels · {Math.round(test.duration_sec / 60)} minutes
        </p>
        <div className="flex flex-wrap gap-2.5">
          {test.target_levels.map((level) => (
            <span
              key={level}
              className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-ink"
            >
              {level}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
