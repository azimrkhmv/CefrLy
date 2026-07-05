import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchMyAttempts, listTests } from '../lib/api'
import { useAuth } from '../lib/auth'
import { skillMeta } from '../lib/skills'
import type { Skill } from '../types/test'
import type { AttemptSummary } from '../types/attempt'
import { EmptyState } from './EmptyState'
import { TestCard, type TestAttemptInfo } from './TestCard'
import { TestGridSkeleton } from './Skeleton'

/** Best score + attempt count per test id, for the "Best score …" line on a card. */
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

/** Published-test catalog for ONE skill. Reading and Listening share this shell;
 *  the sidebar's skill nav effectively filters (each page shows its skill only). */
export function TestCatalog({ skill }: { skill: Skill }) {
  const { session } = useAuth()
  const meta = skillMeta(skill)
  const {
    data: allTests,
    isLoading,
    error,
  } = useQuery({ queryKey: ['tests'], queryFn: listTests, enabled: !!session })
  const { data: attempts } = useQuery({
    queryKey: ['my-attempts'],
    queryFn: fetchMyAttempts,
    enabled: !!session,
  })

  const tests = allTests?.filter((t) => t.skill === skill)
  const attemptInfo = buildAttemptInfo(attempts)
  const parts = Array.from({ length: meta.parts }, (_, i) => `Part ${i + 1}`)

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <div className="inline-flex whitespace-nowrap rounded-xl border border-line bg-white p-1">
            <span className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white">
              Mock test
            </span>
            {parts.map((part) => (
              <span
                key={part}
                title="Practice by part is coming soon"
                className="cursor-not-allowed rounded-lg px-4 py-2 text-sm font-bold text-ink-faint"
              >
                {part}
              </span>
            ))}
          </div>
        </div>
        {tests && (
          <span className="text-sm text-ink-soft">
            {tests.length} {meta.label.toLowerCase()} test{tests.length === 1 ? '' : 's'} available
          </span>
        )}
      </div>

      {!session && (
        <EmptyState
          pose="nap"
          title="Sign in to see the tests"
          hint="A free account keeps every attempt so you can track your progress."
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
          title={`No ${meta.label.toLowerCase()} tests published yet`}
          hint="Check back soon — new mock tests are on the way."
        />
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {tests?.map((test, i) => (
          <div
            key={test.id}
            className="reveal"
            style={{ animationDelay: `${Math.min(i, 9) * 0.06}s` }}
          >
            <TestCard test={test} attemptInfo={attemptInfo.get(test.id)} />
          </div>
        ))}
      </div>
    </div>
  )
}
