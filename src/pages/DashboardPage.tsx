import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMyAttempts } from '../lib/api'
import { BAND_INFO } from '../lib/bands'
import { skillMeta } from '../lib/skills'
import { AttemptListSkeleton } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import type { Skill } from '../types/test'

type Filter = 'all' | Skill

export function DashboardPage() {
  const {
    data: attempts,
    isLoading,
    error,
  } = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts })
  const [filter, setFilter] = useState<Filter>('all')

  if (isLoading) return <AttemptListSkeleton />
  if (error) {
    return (
      <p className="py-24 text-center text-sm text-rose-700">
        Could not load your results. {error instanceof Error ? error.message : ''}
      </p>
    )
  }

  const all = attempts ?? []
  const best = all.length > 0 ? all.reduce((a, b) => (b.rawScore > a.rawScore ? b : a)) : null
  // Only offer a skill filter once the student has attempts in more than one skill.
  const skillsPresent = Array.from(new Set(all.map((a) => a.skill))) as Skill[]
  const showFilter = skillsPresent.length > 1
  const shown = filter === 'all' ? all : all.filter((a) => a.skill === filter)

  const TABS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    ...skillsPresent
      .sort()
      .map((s) => ({ key: s as Filter, label: skillMeta(s).label })),
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-heading">My results</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Every attempt is saved here so you can watch your progress.
          </p>
        </div>
        <Link
          to="/reading"
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          Take a test
        </Link>
      </div>

      {all.length === 0 && (
        <EmptyState
          pose="nap"
          title="No attempts yet"
          hint="Take your first test and your results will appear here."
          action={
            <Link
              to="/reading"
              className="inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              Take a test
            </Link>
          }
        />
      )}

      {all.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <p className="text-sm font-semibold text-ink-soft">Tests taken</p>
              <p className="tnum mt-1 text-2xl font-extrabold text-heading">{all.length}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <p className="text-sm font-semibold text-ink-soft">Best result</p>
              <p className="mt-1 flex items-baseline gap-2.5">
                <span className="tnum text-2xl font-extrabold text-heading">
                  {best!.rawScore}/{best!.total}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${BAND_INFO[best!.band].className}`}
                >
                  {BAND_INFO[best!.band].label}
                </span>
              </p>
            </div>
          </div>

          {showFilter && (
            <div className="inline-flex whitespace-nowrap rounded-xl border border-line bg-white p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                    filter === tab.key ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <ul className="space-y-3">
            {shown.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-extrabold text-heading">{attempt.testTitle}</p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] ${skillMeta(attempt.skill).chip}`}
                    >
                      {skillMeta(attempt.skill).label}
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft">
                    {new Date(attempt.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tnum text-lg font-extrabold text-heading">
                    {attempt.rawScore}/{attempt.total}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-sm font-bold ${BAND_INFO[attempt.band].className}`}
                  >
                    {BAND_INFO[attempt.band].label}
                  </span>
                  <Link
                    to={`/results/${attempt.id}`}
                    className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
