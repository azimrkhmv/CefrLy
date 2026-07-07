import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMyAttempts } from '../lib/api'
import { BAND_INFO } from '../lib/bands'
import { skillMeta } from '../lib/skills'
import { AttemptListSkeleton } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { ArrowRightIcon, BookIcon, HeadphonesIcon } from '../components/icons'
import type { AttemptSummary } from '../types/attempt'
import type { Skill } from '../types/test'

// No "All" tab (user call 2026-07-06) — the four skills are the sections.
type Filter = Skill

// Per-skill icon tile: mirrors the skill colors used on the Home roadmap
// (reading = brand violet, listening = sun). No colored top bar — cards stay
// quiet like the Samples grid; the chip + tile carry the skill.
const SKILL_CARD: Record<
  Skill,
  { tile: string; Icon: (props: { width?: number; height?: number }) => React.ReactElement }
> = {
  reading: { tile: 'bg-brand-soft text-brand', Icon: BookIcon },
  listening: { tile: 'bg-sun-soft text-sun-ink', Icon: HeadphonesIcon },
}

function AttemptCard({ attempt }: { attempt: AttemptSummary }) {
  const meta = skillMeta(attempt.skill)
  const card = SKILL_CARD[attempt.skill]
  return (
    <li>
      <Link
        to={`/results/${attempt.id}`}
        // Same quiet card as the Samples grid: no top bar; the whole card is the
        // link, lifting on hover with the brand-tinted shadow (no jump).
        className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-brand/30 hover:shadow-soft"
      >
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${card.tile}`}>
            <card.Icon width={20} height={20} />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold leading-snug text-heading">{attempt.testTitle}</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {new Date(attempt.createdAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] ${meta.chip}`}
          >
            {meta.label}
          </span>
          {attempt.scope === 'part' && (
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-brand">
              Part {attempt.partNumber}
            </span>
          )}
          {/* part drills carry no CEFR band — score only */}
          {attempt.band && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${BAND_INFO[attempt.band].className}`}
            >
              {BAND_INFO[attempt.band].label}
            </span>
          )}
          <span className="tnum ml-auto text-lg font-extrabold text-heading">
            {attempt.rawScore}/{attempt.total}
          </span>
        </div>
        <div className="mt-auto flex items-center border-t border-line pt-3.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-brand">
            Review
            <ArrowRightIcon
              width={15}
              height={15}
              className="transition-transform duration-200 motion-safe:group-hover:translate-x-1"
            />
          </span>
        </div>
      </Link>
    </li>
  )
}

export function DashboardPage() {
  const {
    data: attempts,
    isLoading,
    error,
  } = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts })
  const [filter, setFilter] = useState<Filter>('reading')

  if (isLoading) return <AttemptListSkeleton />
  if (error) {
    return (
      <p className="py-24 text-center text-sm text-rose-700">
        Could not load your results. {error instanceof Error ? error.message : ''}
      </p>
    )
  }

  const all = attempts ?? []
  const shown = all.filter((a) => a.skill === filter)
  // "Best result" compares full mocks only — a 5/6 part drill isn't comparable
  // to a /35 paper. With no full attempts in view, the tile is hidden.
  const fullShown = shown.filter((a) => a.scope !== 'part' && a.band !== null)
  const best =
    fullShown.length > 0 ? fullShown.reduce((a, b) => (b.rawScore > a.rawScore ? b : a)) : null

  const TABS: { key: Filter; label: string }[] = [
    { key: 'reading', label: 'Reading' },
    { key: 'listening', label: 'Listening' },
  ]
  const activeLabel = `${skillMeta(filter).label.toLowerCase()} `

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

      {all.length === 0 ? (
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
      ) : (
        <>
          {/* skill sections — Writing/Speaking join this strip when they ship */}
          <div className="max-w-full overflow-x-auto">
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
              {(['Writing', 'Speaking'] as const).map((label) => (
                <span
                  key={label}
                  title="Coming soon"
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-ink-faint"
                >
                  {label}
                  <span className="rounded-full bg-page px-1.5 py-0.5 text-[10px] font-bold lowercase">
                    soon
                  </span>
                </span>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <EmptyState
              pose="nap"
              title={`No ${activeLabel}attempts yet`}
              hint="Take a test in this section and it will appear here."
              action={
                <Link
                  to={skillMeta(filter).to}
                  className="inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
                >
                  Go to {skillMeta(filter).label}
                </Link>
              }
            />
          ) : (
            <>
              {/* Compact stats strip: one quiet panel split into cells that hugs
                  its content, instead of two big half-empty boxes. Stacks with a
                  horizontal divider on mobile, sits inline on desktop. */}
              <div className="flex w-fit flex-col divide-y divide-line rounded-2xl border border-line bg-white shadow-card sm:flex-row sm:divide-x sm:divide-y-0">
                <div className="px-6 py-4">
                  <p className="text-sm font-semibold text-ink-soft">
                    {skillMeta(filter).label} tests taken
                  </p>
                  <p className="tnum mt-1 text-2xl font-extrabold text-heading">{shown.length}</p>
                </div>
                {/* full mocks only — part drills have no comparable /35 score */}
                {best && best.band && (
                  <div className="px-6 py-4">
                    <p className="text-sm font-semibold text-ink-soft">Best full mock</p>
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="tnum text-2xl font-extrabold text-heading">
                        {best.rawScore}/{best.total}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${BAND_INFO[best.band].className}`}
                      >
                        {BAND_INFO[best.band].label}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((attempt) => (
                  <AttemptCard key={attempt.id} attempt={attempt} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
