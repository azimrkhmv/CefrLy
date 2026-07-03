import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMyAttempts } from '../lib/api'
import { BAND_INFO } from '../lib/bands'
import { PlayIcon } from '../components/icons'

export function DashboardPage() {
  const {
    data: attempts,
    isLoading,
    error,
  } = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts })

  if (isLoading) return <p className="py-24 text-center text-ink-soft">Loading your results…</p>
  if (error) {
    return (
      <p className="py-24 text-center font-semibold text-rose-600">
        Could not load your results. {error instanceof Error ? error.message : ''}
      </p>
    )
  }

  const best = attempts && attempts.length > 0
    ? attempts.reduce((a, b) => (b.rawScore > a.rawScore ? b : a))
    : null

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-heading">My results</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Every attempt is saved here so you can watch your progress.
          </p>
        </div>
        <Link
          to="/reading"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
        >
          <PlayIcon width={13} height={13} />
          Take a test
        </Link>
      </div>

      {attempts && attempts.length === 0 && (
        <div className="rounded-xl border border-line bg-white p-10 text-center shadow-card">
          <p className="text-lg font-semibold text-heading">No attempts yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Take your first reading test and your results will appear here.
          </p>
        </div>
      )}

      {attempts && attempts.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-5 shadow-card">
              <p className="text-sm font-medium text-ink-soft">Tests taken</p>
              <p className="mt-1 font-num text-4xl font-semibold text-heading">{attempts.length}</p>
            </div>
            <div className="rounded-xl border border-line bg-white p-5 shadow-card">
              <p className="text-sm font-medium text-ink-soft">Best result</p>
              <p className="mt-1 flex items-baseline gap-2.5">
                <span className="font-num text-4xl font-semibold text-heading">
                  {best!.rawScore}/{best!.total}
                </span>
                <span
                  className={`rounded-lg px-2.5 py-0.5 text-sm font-semibold ${BAND_INFO[best!.band].className}`}
                >
                  {BAND_INFO[best!.band].label}
                </span>
              </p>
            </div>
          </div>

          <ul className="space-y-3">
            {attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-card"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-heading">{attempt.testTitle}</p>
                  <p className="text-sm text-ink-soft">
                    {new Date(attempt.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-num text-lg font-semibold text-heading">
                    {attempt.rawScore}/{attempt.total}
                  </span>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${BAND_INFO[attempt.band].className}`}
                  >
                    {BAND_INFO[attempt.band].label}
                  </span>
                  <Link
                    to={`/results/${attempt.id}`}
                    className="rounded-lg border border-brand/70 px-4 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
