import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAttempt, fetchMyAttempts } from '../lib/api'
import { BAND_INFO, BAND_ORDER } from '../lib/bands'
import { BandRuler } from '../components/BandRuler'
import { useCountUp, useInView } from '../lib/motion'
import type { AttemptResult, ItemResult } from '../types/attempt'
import type { Band } from '../types/test'

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
  // Part drills carry no CEFR band (a /6 score means nothing on the /35
  // thresholds) — they get a score-only header, no band label and no ruler.
  const band = result.band ? BAND_INFO[result.band] : null
  const isPart = result.scope === 'part' || result.band === null
  const accuracy = result.total > 0 ? Math.round((result.rawScore / result.total) * 100) : 0
  const shownScore = useCountUp(result.rawScore)

  // "Up from X": compare this attempt's band with the best band achieved
  // before it (any earlier banded attempt; part drills don't take part).
  const { data: attempts } = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts })
  const earlierBands = (attempts ?? [])
    .filter((a) => a.id !== result.attemptId && a.createdAt < result.submittedAt && a.band !== null)
    .map((a) => BAND_ORDER.indexOf(a.band as Band))
  const currentRank = result.band ? BAND_ORDER.indexOf(result.band) : -1
  const previousBestRank = earlierBands.length > 0 ? Math.max(...earlierBands) : null
  const improvedFrom =
    result.band && previousBestRank !== null && currentRank > previousBestRank
      ? BAND_INFO[BAND_ORDER[previousBestRank]].label
      : null

  const byPart = new Map<number, ItemResult[]>()
  for (const item of result.items) {
    const list = byPart.get(item.partNumber) ?? []
    list.push(item)
    byPart.set(item.partNumber, list)
  }

  const submittedOn = new Date(result.submittedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const goodBand = result.band === 'B2' || result.band === 'C1' || (isPart && accuracy >= 70)

  return (
    <div className="space-y-8">
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
                {band ? band.label : `${accuracy}%`}
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
              {isPart
                ? `Part ${result.partNumber ?? ''} practice — single-part scores don't carry a CEFR band; take a full mock for one.`
                : 'Indicative reading band only — the full four-skill result comes from a complete mock exam.'}
            </p>
            {result.skill === 'listening' && (
              <Link
                to={`/review/${result.attemptId}`}
                className="reveal reveal-4 mt-4 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-deep"
              >
                Review with audio &amp; transcript
              </Link>
            )}
          </div>

          {/* the mascot delivers the verdict */}
          <div className="reveal reveal-3 mx-auto flex shrink-0 flex-col items-center">
            <div className="relative max-w-56 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-bold text-brand-deep">
              {band
                ? band.blurb
                : accuracy >= 70
                  ? 'Sharp work on this part — keep the streak going.'
                  : 'Every drill counts. Check the review below and go again.'}
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

        {/* the CEFR ruler only makes sense on the /35 scale of a full paper */}
        {result.band && (
          <div className="relative mt-8">
            <BandRuler band={result.band} score={result.rawScore} animate />
          </div>
        )}
      </section>

      {/* Listening attempts skip this flat list — the audio review page
          (/review/:attemptId, linked above) covers answers, keys AND the
          transcript in one place. Reading has no audio review, so it keeps
          the per-part answer review with explanations. */}
      {result.skill !== 'listening' && (
      <section className="space-y-6">
        <h2 className="text-xl font-extrabold text-heading">Answer review</h2>
        {[...byPart.entries()]
          .sort(([a], [b]) => a - b)
          .map(([partNumber, items]) => {
            const correctCount = items.filter((i) => i.correct).length
            return (
              <div
                key={partNumber}
                className="rounded-2xl border border-line bg-white p-5 shadow-card"
              >
                <h3 className="font-extrabold text-heading">
                  Part {partNumber}
                  <span className="tnum ml-2 text-sm font-semibold text-ink-soft">
                    {correctCount}/{items.length} correct
                  </span>
                </h3>
                <div className="mb-4 mt-2.5 h-0.5 w-full rounded-full bg-page" aria-hidden>
                  <div
                    className="h-0.5 rounded-full bg-brand"
                    style={{ width: `${(correctCount / items.length) * 100}%` }}
                  />
                </div>
                <ol className="space-y-3">
                  {items.map((item, index) => (
                    <ItemReview key={item.id} item={item} fallbackNumber={index + 1} />
                  ))}
                </ol>
              </div>
            )
          })}
      </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          to="/"
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
