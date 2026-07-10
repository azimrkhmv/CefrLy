import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMyAttempts } from '../lib/api'
import { BAND_INFO } from '../lib/bands'
import { skillMeta } from '../lib/skills'
import { BandRuler } from '../components/BandRuler'
import { Sparkline } from '../components/Sparkline'
import { TabStrip, type Tab } from '../components/TabStrip'
import { AttemptListSkeleton } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { ArrowRightIcon, BookIcon, HeadphonesIcon, PlusIcon } from '../components/icons'
import type { AttemptSummary } from '../types/attempt'
import type { Band, Skill } from '../types/test'

// No "All" tab (user call 2026-07-06) — the four skills are the sections.
type Filter = Skill

/** A full-mock attempt — the only kind that carries a CEFR band and sits on the
 *  /35 progress scale. Part drills (scope 'part', band null) never reach it. */
type BandedAttempt = AttemptSummary & { band: Band }

// Per-skill icon tile: mirrors the skill colors used on the Home roadmap
// (reading = brand violet, listening = sun).
const SKILL_CARD: Record<
  Skill,
  { tile: string; Icon: (props: { width?: number; height?: number }) => React.ReactElement }
> = {
  reading: { tile: 'bg-brand-soft text-brand', Icon: BookIcon },
  listening: { tile: 'bg-sun-soft text-sun-ink', Icon: HeadphonesIcon },
}

const shortMonth = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short' })

// A small filled triangle for the score-change chip (▲ up / ▼ down).
function Triangle({ up }: { up: boolean }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden className={up ? '' : 'rotate-180'}>
      <path d="M4 1 7 6.8H1L4 1Z" fill="currentColor" />
    </svg>
  )
}

// Change vs the previous full mock of the same skill. `null` = the first mock
// ("First attempt"); `undefined` = a part drill, where a /35 delta is meaningless
// (drills score out of their own part count) so no chip is shown.
function DeltaChip({ delta }: { delta: number | null | undefined }) {
  if (delta === undefined) return null
  if (delta === null)
    return <span className="text-xs font-bold text-ink-faint">First attempt</span>
  if (delta === 0)
    return (
      <span className="tnum rounded-full bg-page px-2.5 py-1 text-xs font-bold text-ink-soft">±0</span>
    )
  const up = delta > 0
  return (
    <span
      className={`tnum inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
        up ? 'bg-brand-soft text-brand' : 'bg-page text-ink-soft'
      }`}
    >
      <Triangle up={up} />
      {Math.abs(delta)}
    </span>
  )
}

// The lavender progress panel: best score + indicative band, the CEFR ruler, and
// (from the 2nd mock on) a score-trend sparkline. Full mocks only — a part drill
// has no band and its small score can't sit on the /35 axis.
function ProgressPanel({ skill, mocks }: { skill: Filter; mocks: BandedAttempt[] }) {
  const best = mocks.reduce((a, b) => (b.rawScore > a.rawScore ? b : a))
  const chron = [...mocks].reverse() // oldest → newest, for the trend
  const scores = chron.map((a) => a.rawScore)
  const hasTrend = scores.length >= 2
  const trend = hasTrend ? scores[scores.length - 1] - scores[0] : 0
  const from = shortMonth(chron[0].createdAt)
  const to = shortMonth(chron[chron.length - 1].createdAt)
  const range = from === to ? from : `${from} → ${to}`
  const label = skillMeta(skill).label

  return (
    <section className="rounded-2xl bg-brand-soft p-6 sm:p-7">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand/80">
            {label} · Your progress
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <span className="tnum text-[42px] font-extrabold leading-none text-brand">
              {best.rawScore}
              <span className="text-xl font-extrabold text-brand/50">/{best.total}</span>
            </span>
            <span className="rounded-full bg-brand px-3 py-1 text-[13px] font-extrabold text-white">
              {BAND_INFO[best.band].label}
            </span>
            <span className="text-[13px] font-bold text-brand/70">best score</span>
          </div>
          <div className="mt-6 max-w-md">
            <BandRuler band={best.band} score={best.rawScore} animate />
          </div>
        </div>

        {hasTrend && (
          <div className="rounded-2xl bg-white p-4 shadow-soft">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-extrabold text-heading">Score trend</span>
              <span className="tnum text-xs font-extrabold text-brand">
                {trend >= 0 ? '+' : ''}
                {trend} pts
              </span>
            </div>
            <div className="mt-3">
              <Sparkline scores={scores} />
            </div>
            <p className="mt-2 text-[11px] font-bold text-ink-soft">
              {mocks.length} attempts · {range}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function AttemptCard({
  attempt,
  isBest,
  delta,
}: {
  attempt: AttemptSummary
  isBest: boolean
  delta: number | null | undefined
}) {
  const card = SKILL_CARD[attempt.skill]
  return (
    <li>
      <Link
        // Reading opens its Analysis page; listening keeps the score/results page.
        to={attempt.skill === 'listening' ? `/results/${attempt.id}` : `/analyze/${attempt.id}`}
        className={`group flex h-full flex-col rounded-2xl border bg-white p-5 shadow-card transition-[border-color,box-shadow] duration-200 ${
          isBest
            ? 'border-brand/40 shadow-soft'
            : 'border-line hover:border-brand/30 hover:shadow-soft'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
              isBest ? 'bg-brand text-white' : card.tile
            }`}
          >
            <card.Icon width={20} height={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-extrabold leading-snug text-heading">
                {attempt.testTitle}
              </p>
              {isBest && (
                <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white">
                  Best
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs font-semibold text-ink-soft">
              {new Date(attempt.createdAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <ArrowRightIcon
            width={17}
            height={17}
            className="shrink-0 text-ink-faint transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-brand"
          />
        </div>

        <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3.5">
          <div className="flex items-center gap-2.5">
            <span className="tnum text-[22px] font-extrabold text-heading">
              {attempt.rawScore}
              <span className="text-[13px] font-bold text-ink-soft">/{attempt.total}</span>
            </span>
            {attempt.band ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${BAND_INFO[attempt.band].className}`}
              >
                {BAND_INFO[attempt.band].label}
              </span>
            ) : attempt.scope === 'part' ? (
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
                Part {attempt.partNumber}
              </span>
            ) : null}
          </div>
          <DeltaChip delta={delta} />
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
  // Newest first (the design's order), regardless of what the API returns.
  const shown = all
    .filter((a) => a.skill === filter)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

  // Full mocks carry the band and sit on the /35 scale; part drills don't.
  const mocks = shown.filter((a): a is BandedAttempt => a.scope !== 'part' && a.band !== null)
  const best = mocks.length > 0 ? mocks.reduce((a, b) => (b.rawScore > a.rawScore ? b : a)) : null

  // Score change vs the previous mock (chronological): map by attempt id so the
  // newest-first cards can look it up. First mock → null ("First attempt").
  const deltaById = new Map<string, number | null>()
  const chronMocks = [...mocks].reverse()
  chronMocks.forEach((a, i) => {
    deltaById.set(a.id, i === 0 ? null : a.rawScore - chronMocks[i - 1].rawScore)
  })

  // Keyed by plain strings so the not-yet-built Writing/Speaking markers can
  // live in the same strip; only the two real skills are ever selected.
  const TABS: Tab<string>[] = [
    { key: 'reading', label: 'Reading' },
    { key: 'listening', label: 'Listening' },
    { key: 'writing', label: 'Writing', soon: true },
    { key: 'speaking', label: 'Speaking', soon: true },
  ]
  const activeLabel = `${skillMeta(filter).label.toLowerCase()} `

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-heading">My results</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Every attempt is saved here so you can watch your progress.
          </p>
        </div>
        <Link
          to={skillMeta(filter).to}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgb(63_38_130/0.22)] transition-colors hover:bg-brand-deep"
        >
          <PlusIcon width={16} height={16} />
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
          {/* section strip — Writing/Speaking join it (interactive) when they ship */}
          <TabStrip
            ariaLabel="Results section"
            tabs={TABS}
            value={filter}
            onChange={(key) => setFilter(key as Filter)}
          />

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
              {mocks.length > 0 && <ProgressPanel skill={filter} mocks={mocks} />}

              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-heading">All attempts</h2>
                <span className="text-[13px] font-semibold text-ink-soft">
                  {shown.length} {shown.length === 1 ? 'attempt' : 'attempts'} · newest first
                </span>
              </div>

              <ul className="grid gap-4 sm:grid-cols-2">
                {shown.map((attempt) => (
                  <AttemptCard
                    key={attempt.id}
                    attempt={attempt}
                    isBest={best?.id === attempt.id}
                    delta={attempt.scope === 'part' ? undefined : deltaById.get(attempt.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
