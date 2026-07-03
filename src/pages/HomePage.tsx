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
      <section className="relative overflow-hidden rounded-3xl bg-brand-deep px-6 py-10 text-white sm:px-10 sm:py-12">
        {/* soft glow in the corner, like a stage light on the panel */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #ffb733 0%, transparent 70%)' }}
          aria-hidden
        />
        <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-4xl">
          Know your real English level — <span className="text-sun">before</span> exam day.
        </h1>
        <p className="mt-3 max-w-xl font-semibold text-white/80">
          Full CEFR Reading mock exams: 35 questions, 5 parts, 60 minutes. Instant band score
          and an explanation for every answer.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4 text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/60">
              Today
            </p>
            <p className="font-num text-4xl font-bold">B1</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-sun">
              60 minutes
            </p>
            <ArrowRightIcon className="mx-auto mt-1 text-sun" width={36} height={20} />
          </div>
          <div className="rounded-2xl border border-sun/40 bg-white/10 px-6 py-4 text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-sun">
              Your goal
            </p>
            <p className="font-num text-4xl font-bold text-sun">C1</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {session ? (
            <Link
              to="/reading"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-brand-deep transition-colors hover:bg-sun"
            >
              <PlayIcon width={14} height={14} />
              Start Reading test
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-brand-deep transition-colors hover:bg-sun"
              >
                Create free account
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-white/30 px-6 py-3 text-sm font-extrabold text-white hover:bg-white/10"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        <p className="mt-8 flex items-center gap-2 text-sm font-semibold text-white/70">
          <span className="h-2 w-2 rounded-full bg-mint" aria-hidden />
          Built on the official CEFR reading format
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-heading">Reading tests</h2>
          <Link
            to="/reading"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline"
          >
            See all
            <ArrowRightIcon width={16} height={16} />
          </Link>
        </div>

        {!session && (
          <p className="rounded-2xl border border-line bg-white p-6 text-ink-soft shadow-card">
            Sign in to see the available tests.
          </p>
        )}
        {session && isLoading && <p className="text-ink-soft">Loading tests…</p>}
        {session && error && (
          <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            Could not load tests: {(error as Error).message}
          </p>
        )}
        {session && tests && tests.length === 0 && (
          <p className="rounded-2xl border border-line bg-white p-6 text-ink-soft shadow-card">
            No tests published yet — check back soon.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
