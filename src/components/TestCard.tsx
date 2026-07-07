import { Link } from 'react-router-dom'
import type { TestCatalogEntry } from '../types/attempt'
import { skillMeta } from '../lib/skills'

export interface TestAttemptInfo {
  count: number
  best: number | null
}

export function TestCard({
  test,
  attemptInfo,
}: {
  test: TestCatalogEntry
  attemptInfo?: TestAttemptInfo
}) {
  const isPart = test.scope === 'part'
  const attemptsLabel =
    attemptInfo && attemptInfo.count > 0
      ? `Best score ${attemptInfo.best}${isPart ? '' : '/35'} · ${attemptInfo.count} attempt${attemptInfo.count > 1 ? 's' : ''}`
      : 'No attempts yet'
  const meta = skillMeta(test.skill)

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-brand/30 hover:shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${meta.chip}`}>
          {meta.label}
        </span>
        <span className="inline-block rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
          {isPart ? `Part ${test.part_number} practice` : 'Full mock test'}
        </span>
      </div>
      <h3 className="mt-3 text-base font-extrabold leading-snug text-heading">{test.title}</h3>
      <p className="mt-1.5 text-sm font-semibold text-ink-soft">
        {test.target_levels.join(' · ')} — {Math.round(test.duration_sec / 60)} minutes
      </p>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="tnum text-sm text-ink-soft">{attemptsLabel}</p>
        <Link
          to={`/test/${test.id}`}
          className="shrink-0 rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          Start
        </Link>
      </div>
    </div>
  )
}
