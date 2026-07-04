import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMyAttempts, listTests } from '../lib/api'
import { useAuth } from '../lib/auth'
import { BAND_INFO } from '../lib/bands'
import { BandRuler } from '../components/BandRuler'
import { Cat } from '../components/Cat'
import { EmptyState } from '../components/EmptyState'
import { TestCard } from '../components/TestCard'
import { TestGridSkeleton } from '../components/Skeleton'
import { buildAttemptInfo } from './ReadingPage'

export function HomePage() {
  const { session } = useAuth()
  const {
    data: tests,
    isLoading,
    error,
  } = useQuery({ queryKey: ['tests'], queryFn: listTests, enabled: !!session })
  const { data: attempts } = useQuery({
    queryKey: ['my-attempts'],
    queryFn: fetchMyAttempts,
    enabled: !!session,
  })

  const attemptInfo = buildAttemptInfo(attempts)
  const best =
    attempts && attempts.length > 0
      ? attempts.reduce((a, b) => (b.rawScore > a.rawScore ? b : a))
      : null

  return (
    <div className="space-y-10">
      {session ? (
        // Signed in: a working dashboard, not a landing page.
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-heading">Reading practice</h1>
              <p className="mt-1 text-sm text-ink-soft">
                Full mock exams in the official CEFR format — 35 questions, 5 parts, 60 minutes.
              </p>
            </div>
            <Link
              to="/reading"
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              Start test
            </Link>
          </div>

          {attempts && attempts.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
                  <p className="text-sm font-semibold text-ink-soft">Tests taken</p>
                  <p className="tnum mt-1 text-2xl font-extrabold text-heading">
                    {attempts.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
                  <p className="text-sm font-semibold text-ink-soft">Best score</p>
                  <p className="tnum mt-1 text-2xl font-extrabold text-heading">
                    {best!.rawScore}/{best!.total}
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
                  <p className="text-sm font-semibold text-ink-soft">Indicative band</p>
                  <p className="mt-1.5">
                    <span
                      className={`inline-block rounded-full px-3 py-0.5 text-lg font-extrabold ${BAND_INFO[best!.band].className}`}
                    >
                      {BAND_INFO[best!.band].label}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-soft">
                    Your level on the CEFR scale
                  </p>
                  <p className="tnum text-sm font-semibold text-ink-soft">
                    Best {best!.rawScore}/{best!.total}
                  </p>
                </div>
                <div className="mt-6">
                  <BandRuler band={best!.band} score={best!.rawScore} animate />
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        // Signed out: a friendly landing moment with the reading cat.
        <section className="relative pb-2 pt-2 sm:pt-6">
          <div
            className="pointer-events-none absolute -top-16 right-0 h-80 w-80 rounded-full bg-brand-soft blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-wrap items-center gap-8">
            <div className="min-w-0 flex-1 basis-80">
              <p className="reveal reveal-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
                CEFR · Reading paper
              </p>
              <h1 className="reveal reveal-2 mt-3 max-w-2xl text-4xl font-extrabold leading-tight text-heading sm:text-[2.6rem]">
                Know your real English level before{' '}
                <span className="text-accent-deep">exam day.</span>
              </h1>
              <p className="reveal reveal-3 mt-4 max-w-xl text-ink-soft">
                Full CEFR Reading mock exams in the official format — 35 questions, 5 parts, 60
                minutes. Instant band score and an explanation for every answer.
              </p>
              <div className="reveal reveal-4 mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/signup"
                  className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-deep motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0"
                >
                  Create free account
                </Link>
                <Link
                  to="/login"
                  className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-all hover:border-ink-faint motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0"
                >
                  Sign in
                </Link>
              </div>
            </div>
            <div className="reveal reveal-3 mx-auto shrink-0">
              <Cat pose="read" width={210} height={180} />
            </div>
          </div>

          <div className="relative mt-10 max-w-xl">
            <BandRuler demo animate />
            <p className="reveal reveal-5 mt-3 text-sm text-ink-soft">
              Scored on the official CEFR reading scale, out of 35 marks.
            </p>
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-extrabold text-heading">Reading tests</h2>
          <Link to="/reading" className="text-sm font-bold text-brand hover:underline">
            See all
          </Link>
        </div>

        {!session && (
          <EmptyState
            pose="nap"
            title="Sign in to see the tests"
            hint="A free account keeps every attempt so you can watch your level grow."
            action={
              <Link
                to="/login"
                className="inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
              >
                Sign in
              </Link>
            }
          />
        )}
        {session && isLoading && <TestGridSkeleton />}
        {session && error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
            Could not load tests: {(error as Error).message}
          </p>
        )}
        {session && tests && tests.length === 0 && (
          <EmptyState
            pose="nap"
            title="No tests published yet"
            hint="Check back soon — new mock tests are on the way."
          />
        )}

        {session && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tests?.slice(0, 6).map((test, i) => (
              <div key={test.id} className="reveal" style={{ animationDelay: `${i * 0.06}s` }}>
                <TestCard test={test} attemptInfo={attemptInfo.get(test.id)} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
