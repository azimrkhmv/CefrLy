import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAttempt, fetchMyAttempts } from '../lib/api'
import { BAND_INFO, BAND_ORDER } from '../lib/bands'
import { BandRuler } from '../components/BandRuler'
import { useCountUp } from '../lib/motion'
import type { AttemptResult } from '../types/attempt'
import type { Band } from '../types/test'

// Post-submit results. READING attempts get the richer Analysis page instead
// (/analyze/:id — band + answer key + passage highlights + explanations), so
// this page now serves LISTENING: the score header + the audio/transcript
// review link. Any reading attempt that lands here (old link, dashboard) is
// redirected to its analysis.
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

  // Reading (incl. legacy rows with no stored skill) uses the Analysis page as
  // its results view — no separate score-only screen.
  if ((result.skill ?? 'reading') !== 'listening') {
    return <Navigate to={`/analyze/${result.attemptId}`} replace />
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

  // "Up from X": compare this attempt's band with the best earlier listening
  // band (same skill only — reading/listening are separate indicative bands).
  const { data: attempts } = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts })
  const earlierBands = (attempts ?? [])
    .filter(
      (a) =>
        a.id !== result.attemptId &&
        a.skill === 'listening' &&
        a.createdAt < result.submittedAt &&
        a.band !== null,
    )
    .map((a) => BAND_ORDER.indexOf(a.band as Band))
  const currentRank = result.band ? BAND_ORDER.indexOf(result.band) : -1
  const previousBestRank = earlierBands.length > 0 ? Math.max(...earlierBands) : null
  const improvedFrom =
    result.band && previousBestRank !== null && currentRank > previousBestRank
      ? BAND_INFO[BAND_ORDER[previousBestRank]].label
      : null

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
                : 'Indicative listening band only — the full four-skill result comes from a complete mock exam.'}
            </p>
            <Link
              to={`/review/${result.attemptId}`}
              className="reveal reveal-4 mt-4 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-deep"
            >
              Review with audio &amp; transcript
            </Link>
          </div>

          {/* the mascot delivers the verdict */}
          <div className="reveal reveal-3 mx-auto flex shrink-0 flex-col items-center">
            <div className="relative max-w-56 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-bold text-brand-deep">
              {band
                ? band.blurb
                : accuracy >= 70
                  ? 'Sharp work on this part — keep the streak going.'
                  : 'Every drill counts — review it and go again.'}
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
