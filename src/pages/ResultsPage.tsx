import { useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAttempt, fetchMyAttempts } from '../lib/api'
import { BAND_INFO, BAND_ORDER, BAND_THRESHOLDS } from '../lib/bands'
import { skillMeta } from '../lib/skills'
import { BandRuler } from '../components/BandRuler'
import { EmptyState } from '../components/EmptyState'
import { useCountUp, useInView } from '../lib/motion'
import type { AttemptResult, ItemResult } from '../types/attempt'
import type { ItemType, Skill } from '../types/test'

// What each fixed part actually tests, per skill — the analysis speaks in
// these terms ("Form completion"), not bare part numbers.
const PART_NAMES: Record<Skill, Record<number, string>> = {
  reading: {
    1: 'Fill the gaps',
    2: 'Matching texts',
    3: 'Matching headings',
    4: 'Reading comprehension',
    5: 'Summary completion',
  },
  listening: {
    1: 'Short replies',
    2: 'Form completion',
    3: 'Matching speakers',
    4: 'Map labelling',
    5: 'Three extracts',
    6: 'Note completion',
  },
}

const TYPE_LABELS: Record<ItemType, string> = {
  mcq: 'Multiple choice',
  match: 'Matching',
  gap: 'Typed answers',
  tfng: 'True / False / Not Given',
}

type ReviewFilter = 'all' | 'mistakes' | 'skipped'

export function ResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const location = useLocation()
  const stateResult = (location.state as AttemptResult | null) ?? null

  const query = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => fetchAttempt(attemptId!),
    enabled: !stateResult && !!attemptId,
  })

  const result = stateResult ?? query.data

  if (!result) {
    if (query.isLoading) return <p className="py-24 text-center text-ink-soft">Loading results…</p>
    return (
      <p className="py-24 text-center text-sm text-rose-700">
        Could not load this attempt.{' '}
        {query.error instanceof Error ? query.error.message : ''}
      </p>
    )
  }

  return <ResultsView result={result} />
}

function ResultsView({ result }: { result: AttemptResult }) {
  const band = BAND_INFO[result.band]
  const shownScore = useCountUp(result.rawScore)
  const skill = skillMeta(result.skill)
  const [filter, setFilter] = useState<ReviewFilter>('all')

  // "Up from X": compare this attempt's band with the best band achieved
  // before it (any earlier attempt).
  const { data: attempts } = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts })
  const earlier = (attempts ?? []).filter(
    (a) => a.id !== result.attemptId && a.createdAt < result.submittedAt,
  )
  const currentRank = BAND_ORDER.indexOf(result.band)
  const previousBestRank =
    earlier.length > 0 ? Math.max(...earlier.map((a) => BAND_ORDER.indexOf(a.band))) : null
  const improvedFrom =
    previousBestRank !== null && currentRank > previousBestRank
      ? BAND_INFO[BAND_ORDER[previousBestRank]].label
      : null

  // ---- The numbers behind the analysis --------------------------------------

  const partNames = PART_NAMES[result.skill === 'listening' ? 'listening' : 'reading']
  const correct = result.items.filter((i) => i.correct).length
  const mistakes = result.total - correct
  const skipped = result.items.filter((i) => i.userAnswer === null).length
  const accuracy = Math.round((correct / result.total) * 100)

  const byPart = new Map<number, ItemResult[]>()
  for (const item of result.items) {
    const list = byPart.get(item.partNumber) ?? []
    list.push(item)
    byPart.set(item.partNumber, list)
  }
  const partStats = [...byPart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([partNumber, items]) => {
      const c = items.filter((i) => i.correct).length
      return { partNumber, name: partNames[partNumber] ?? `Part ${partNumber}`, correct: c, total: items.length, pct: c / items.length }
    })
  const weakestPart = partStats.reduce(
    (worst, p) => (p.pct < (worst?.pct ?? 1) ? p : worst),
    null as (typeof partStats)[number] | null,
  )
  const hasWeakPart = weakestPart !== null && weakestPart.pct < 1

  const byType = new Map<ItemType, { correct: number; total: number }>()
  for (const item of result.items) {
    const t = byType.get(item.type) ?? { correct: 0, total: 0 }
    t.total += 1
    if (item.correct) t.correct += 1
    byType.set(item.type, t)
  }
  const typeStats = [...byType.entries()].map(([type, s]) => ({
    type,
    label: TYPE_LABELS[type],
    ...s,
    pct: s.correct / s.total,
  }))
  const weakestType = typeStats.reduce(
    (worst, t) => (t.pct < (worst?.pct ?? 1) ? t : worst),
    null as (typeof typeStats)[number] | null,
  )

  // ---- "Focus next" — honest, deterministic takeaways ------------------------

  const insights: string[] = []
  if (skipped > 0) {
    insights.push(
      `${skipped} question${skipped === 1 ? ' was' : 's were'} left blank — a guess is never worse than a blank.`,
    )
  }
  if (hasWeakPart && weakestPart) {
    insights.push(
      `Revisit ${weakestPart.name} (Part ${weakestPart.partNumber}) — ${weakestPart.correct} of ${weakestPart.total} correct there.`,
    )
  }
  if (weakestType && weakestType.pct < 0.75 && weakestType.total - weakestType.correct >= 2) {
    const missed = weakestType.total - weakestType.correct
    insights.push(`${weakestType.label} questions cost you ${missed} marks.`)
  }
  if (result.band !== 'C1') {
    const nextBand = BAND_ORDER[currentRank + 1]
    const delta = BAND_THRESHOLDS[nextBand] - result.rawScore
    insights.push(
      `${delta} more mark${delta === 1 ? '' : 's'} would lift you to ${BAND_INFO[nextBand].label}.`,
    )
  } else {
    insights.push('You are in the top band — keep it sharp.')
  }

  // ---- Review filter ----------------------------------------------------------

  const matchesFilter = (item: ItemResult) =>
    filter === 'all' ? true : filter === 'mistakes' ? !item.correct : item.userAnswer === null
  const filteredParts = partStats
    .map((p) => ({ ...p, items: (byPart.get(p.partNumber) ?? []).filter(matchesFilter) }))
    .filter((p) => p.items.length > 0)

  const submittedOn = new Date(result.submittedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const goodBand = result.band === 'B2' || result.band === 'C1'

  return (
    <div className="space-y-8">
      {/* ---- Verdict hero ---- */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-soft blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-8">
          <div className="min-w-0 flex-1 basis-72">
            <p className="reveal reveal-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              Your result · {submittedOn}
            </p>
            <p className="reveal reveal-2 mt-4 text-sm font-semibold text-ink-soft">
              {result.testTitle}
            </p>
            <div className="reveal reveal-2 mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-4xl font-extrabold text-heading sm:text-5xl">
                {band.label}
              </span>
              <p className="tnum text-2xl font-extrabold text-heading">
                {shownScore} / {result.total} correct
              </p>
            </div>
            {improvedFrom && (
              <p className="reveal reveal-4 mt-2 text-sm font-bold text-ok">
                Up from {improvedFrom} — your best band so far.
              </p>
            )}
            <p className="reveal reveal-3 mt-3 text-sm text-ink-soft">
              Indicative {skill.label.toLowerCase()} band only — the full four-skill result comes
              from a complete mock exam.
            </p>
          </div>

          {/* the mascot delivers the verdict */}
          <div className="reveal reveal-3 mx-auto flex shrink-0 flex-col items-center">
            <div className="relative max-w-56 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-bold text-brand-deep">
              {band.blurb}
              <span
                className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-brand-soft"
                aria-hidden
              />
            </div>
            {/* the grey reading-book cat (matches the new mascot art); it still
                bobs on a good band */}
            <img
              src="/cat-read-grey.png"
              alt=""
              aria-hidden
              draggable={false}
              width={138}
              height={150}
              className={`mt-3 block h-[150px] w-auto select-none ${goodBand ? 'cat-bob' : ''}`}
            />
          </div>
        </div>

        <div className="relative mt-8">
          <BandRuler band={result.band} score={result.rawScore} animate />
        </div>
      </section>

      {/* ---- The analysis ---- */}
      <section className="space-y-4">
        <h2 className="text-xl font-extrabold text-heading">How you performed</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Accuracy" value={`${accuracy}%`} />
          <StatTile label="Correct" value={String(correct)} tone="ok" />
          <StatTile label="Mistakes" value={String(mistakes)} tone={mistakes > 0 ? 'bad' : 'ok'} />
          <StatTile label="Left blank" value={String(skipped)} tone={skipped > 0 ? 'warn' : undefined} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
            <h3 className="font-extrabold text-heading">Score by part</h3>
            <ul className="mt-4 space-y-4">
              {partStats.map((p) => (
                <li key={p.partNumber}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-bold text-ink">
                      {p.name}
                      <span className="ml-1.5 font-semibold text-ink-soft">Part {p.partNumber}</span>
                    </span>
                    <span className="tnum shrink-0 font-bold text-ink">
                      {p.correct}/{p.total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-page">
                    <div
                      className={`h-full rounded-full transition-[width] duration-700 ${
                        hasWeakPart && p.partNumber === weakestPart?.partNumber
                          ? 'bg-rose-400'
                          : 'bg-brand'
                      }`}
                      style={{ width: `${Math.round(p.pct * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {typeStats.length > 1 && (
              <>
                <h3 className="mt-6 border-t border-line pt-5 font-extrabold text-heading">
                  Score by question type
                </h3>
                <ul className="mt-3 space-y-2">
                  {typeStats.map((t) => (
                    <li key={t.type} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-ink">{t.label}</span>
                      <span className="flex items-center gap-3">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-page">
                          <span
                            className="block h-full rounded-full bg-brand"
                            style={{ width: `${Math.round(t.pct * 100)}%` }}
                          />
                        </span>
                        <span className="tnum w-10 text-right font-bold text-ink">
                          {t.correct}/{t.total}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card sm:p-6">
            <h3 className="font-extrabold text-amber-800">Focus next</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-amber-800">
              {insights.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden className="mt-0.5 shrink-0 font-bold">
                    →
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Answer review ---- */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-heading">Answer review</h2>
          <div className="inline-flex rounded-xl border border-line bg-white p-1">
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
              All · {result.total}
            </FilterPill>
            <FilterPill active={filter === 'mistakes'} onClick={() => setFilter('mistakes')}>
              Mistakes · {mistakes}
            </FilterPill>
            {skipped > 0 && (
              <FilterPill active={filter === 'skipped'} onClick={() => setFilter('skipped')}>
                Left blank · {skipped}
              </FilterPill>
            )}
          </div>
        </div>

        {filteredParts.length === 0 ? (
          <EmptyState
            pose="celebrate"
            title="A perfect paper!"
            hint="No mistakes to review — every answer was correct."
          />
        ) : (
          filteredParts.map((p) => (
            <div key={p.partNumber} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h3 className="font-extrabold text-heading">
                Part {p.partNumber}
                <span className="ml-2 text-sm font-semibold text-ink-soft">{p.name}</span>
                <span className="tnum ml-2 text-sm font-semibold text-ink-soft">
                  · {p.correct}/{p.total} correct
                </span>
              </h3>
              <div className="mb-4 mt-2.5 h-0.5 w-full rounded-full bg-page" aria-hidden>
                <div
                  className="h-0.5 rounded-full bg-brand"
                  style={{ width: `${p.pct * 100}%` }}
                />
              </div>
              <ol className="space-y-3">
                {p.items.map((item, index) => (
                  <ItemReview key={item.id} item={item} fallbackNumber={index + 1} />
                ))}
              </ol>
            </div>
          ))
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to={skill.to}
          className="inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          Take another test
        </Link>
        <Link
          to="/dashboard"
          className="inline-block rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
        >
          View all my results
        </Link>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'ok' | 'bad' | 'warn'
}) {
  const valueColor =
    tone === 'ok'
      ? 'text-ok'
      : tone === 'bad'
        ? 'text-rose-700'
        : tone === 'warn'
          ? 'text-amber-800'
          : 'text-heading'
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={`tnum mt-1 text-2xl font-extrabold ${valueColor}`}>{value}</p>
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tnum rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors ${
        active ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function ItemReview({ item, fallbackNumber }: { item: ItemResult; fallbackNumber: number }) {
  const numberMatch = item.id.match(/q(\d+)$/)
  const questionNumber = numberMatch ? Number(numberMatch[1]) : fallbackNumber
  const [ref, inView] = useInView<HTMLLIElement>()

  return (
    <li
      ref={ref}
      className={`rounded-xl border border-line bg-white p-4 ${inView ? 'reveal' : 'opacity-0'}`}
    >
      <div className="flex items-start gap-3">
        <span className="q-badge">{questionNumber}</span>
        <div className="min-w-0 flex-1 text-sm">
          <p className={`mb-1 text-xs font-medium ${item.correct ? 'text-ok' : 'text-rose-700'}`}>
            {item.correct ? 'Correct' : 'Incorrect'}
          </p>
          {item.prompt && <p className="mb-2 font-medium text-ink">{item.prompt}</p>}
          <p>
            <span className="text-ink-soft">Your answer: </span>
            {item.userAnswerLabel != null ? (
              <span className={item.correct ? 'font-semibold text-ok' : 'font-semibold text-rose-700'}>
                {item.userAnswerLabel}
              </span>
            ) : (
              <span className="italic text-ink-soft">No answer</span>
            )}
          </p>
          {!item.correct && (
            <p>
              <span className="text-ink-soft">Correct answer: </span>
              <span className="font-semibold text-ink">{item.correctAnswerLabel}</span>
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer font-medium text-brand hover:underline">
              Explanation
            </summary>
            <div className="mt-2 space-y-1 rounded-xl bg-page p-3 text-ink">
              <p>
                <span className="font-semibold">Where: </span>
                {item.explanation.location}
              </p>
              <p className="italic text-ink-soft">“{item.explanation.quote}”</p>
              <p>{item.explanation.reasoning}</p>
            </div>
          </details>
        </div>
      </div>
    </li>
  )
}
