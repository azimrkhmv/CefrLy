import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchMyAttempts, listTests } from '../lib/api'
import { useAuth } from '../lib/auth'
import { TestCard, type TestAttemptInfo } from '../components/TestCard'
import type { AttemptSummary } from '../types/attempt'

export function buildAttemptInfo(attempts: AttemptSummary[] | undefined) {
  const byTest = new Map<string, TestAttemptInfo>()
  for (const attempt of attempts ?? []) {
    if (!attempt.testId) continue
    const info = byTest.get(attempt.testId) ?? { count: 0, best: null }
    info.count += 1
    info.best = info.best === null ? attempt.rawScore : Math.max(info.best, attempt.rawScore)
    byTest.set(attempt.testId, info)
  }
  return byTest
}

export function ReadingPage() {
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
    <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-lg bg-brand-deep px-5 py-2.5 text-sm font-semibold text-white">
          Mock Test
        </span>
        {tests && (
          <span className="text-sm text-ink-soft">
            {tests.length} test{tests.length === 1 ? '' : 's'} available
          </span>
        )}
      </div>

      {!session && (
        <div className="rounded-xl bg-brand-soft/50 p-10 text-center">
          <p className="text-lg font-semibold text-heading">Sign in to see the tests</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
            A free account keeps every attempt so you can track your progress.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-block rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            Sign in
          </Link>
        </div>
      )}

      {session && isLoading && <p className="py-10 text-center text-ink-soft">Loading tests…</p>}
      {session && error && (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Could not load tests: {(error as Error).message}
        </p>
      )}
      {session && tests && tests.length === 0 && (
        <p className="rounded-xl bg-brand-soft/50 p-10 text-center text-ink-soft">
          No tests published yet — check back soon.
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {tests?.map((test, index) => (
          <TestCard key={test.id} test={test} index={index} attemptInfo={attemptInfo.get(test.id)} />
        ))}
      </div>
    </div>
  )
}
