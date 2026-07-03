import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMyAttempts, listTests } from '../lib/api'
import { useAuth } from '../lib/auth'
import { TestCard } from '../components/TestCard'
import { ArrowRightIcon, PlayIcon } from '../components/icons'
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

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-brand px-6 py-10 text-white sm:px-10 sm:py-12">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          Know your real English level — <span className="text-sun">before</span> exam day.
        </h1>
        <p className="mt-3 max-w-xl text-white/75">
          Full CEFR Reading mock exams: 35 questions, 5 parts, 60 minutes. Instant band score
          and an explanation for every answer.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <div className="rounded-xl border border-white/15 bg-white/10 px-6 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Today
            </p>
            <p className="font-num text-3xl font-semibold">B1</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sun">
              60 minutes
            </p>
            <ArrowRightIcon className="mx-auto mt-1 text-sun" width={32} height={18} />
          </div>
          <div className="rounded-xl border border-sun/30 bg-white/10 px-6 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sun">
              Your goal
            </p>
            <p className="font-num text-3xl font-semibold text-sun">C1</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {session ? (
            <Link
              to="/reading"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
            >
              <PlayIcon width={13} height={13} />
              Start Reading test
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
              >
                Create free account
              </Link>
              <Link
                to="/login"
                className="rounded-lg border border-white/25 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        <p className="mt-8 flex items-center gap-2 text-sm text-white/65">
          <span className="h-2 w-2 rounded-full bg-mint" aria-hidden />
          Built on the official CEFR reading format
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-heading">Reading tests</h2>
          <Link
            to="/reading"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
          >
            See all
            <ArrowRightIcon width={16} height={16} />
          </Link>
        </div>

        {!session && (
          <p className="rounded-xl border border-line bg-white p-6 text-ink-soft">
            Sign in to see the available tests.
          </p>
        )}
        {session && isLoading && <p className="text-ink-soft">Loading tests…</p>}
        {session && error && (
          <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
            Could not load tests: {(error as Error).message}
          </p>
        )}
        {session && tests && tests.length === 0 && (
          <p className="rounded-xl border border-line bg-white p-6 text-ink-soft">
            No tests published yet — check back soon.
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {tests?.slice(0, 6).map((test, index) => (
            <TestCard
              key={test.id}
              test={test}
              index={index}
              attemptInfo={attemptInfo.get(test.id)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
