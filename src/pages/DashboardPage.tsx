import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMyAttempts } from '../lib/api'
import { BAND_INFO } from '../lib/bands'

export function DashboardPage() {
  const {
    data: attempts,
    isLoading,
    error,
  } = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts })

  if (isLoading) return <p className="py-24 text-center text-slate-400">Loading your results…</p>
  if (error) {
    return (
      <p className="py-24 text-center text-rose-600">
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
          <h1 className="text-2xl font-bold">My results</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every attempt is saved here so you can watch your progress.
          </p>
        </div>
        <Link
          to="/"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Take a test
        </Link>
      </div>

      {attempts && attempts.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-lg font-semibold">No attempts yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Take your first reading test and your results will appear here.
          </p>
        </div>
      )}

      {attempts && attempts.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Tests taken</p>
              <p className="mt-1 text-3xl font-bold">{attempts.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Best result</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {best!.rawScore}/{best!.total}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-sm font-bold ${BAND_INFO[best!.band].className}`}
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{attempt.testTitle}</p>
                  <p className="text-sm text-slate-500">
                    {new Date(attempt.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">
                    {attempt.rawScore}/{attempt.total}
                  </span>
                  <span
                    className={`rounded-md px-2.5 py-1 text-sm font-bold ${BAND_INFO[attempt.band].className}`}
                  >
                    {BAND_INFO[attempt.band].label}
                  </span>
                  <Link
                    to={`/results/${attempt.id}`}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
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
