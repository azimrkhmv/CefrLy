import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listTests } from '../lib/api'
import { useAuth } from '../lib/auth'

export function HomePage() {
  const { session } = useAuth()
  const {
    data: tests,
    isLoading,
    error,
  } = useQuery({ queryKey: ['tests'], queryFn: listTests, enabled: !!session })

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-indigo-700 px-8 py-12 text-white">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          Practise for your CEFR English exam — the real format, for free.
        </h1>
        <p className="mt-3 max-w-xl text-indigo-100">
          Full-length mock Reading papers (35 questions, 5 parts, 60 minutes) with instant
          scoring, an indicative band, and explanations for every answer.
        </p>
        {!session && (
          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            Sign in to start
          </Link>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Reading tests</h2>

        {!session && (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-slate-500">
            Sign in to see the available tests.
          </p>
        )}
        {session && isLoading && <p className="text-slate-400">Loading tests…</p>}
        {session && error && (
          <p className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
            Could not load tests: {(error as Error).message}
          </p>
        )}
        {session && tests && tests.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-slate-500">
            No tests published yet. Run the seed script in Supabase to add the sample test.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests?.map((test) => (
            <div
              key={test.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-2 flex flex-wrap gap-1.5">
                {test.target_levels.map((level) => (
                  <span
                    key={level}
                    className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700"
                  >
                    {level}
                  </span>
                ))}
              </div>
              <h3 className="font-semibold">{test.title}</h3>
              <p className="mt-1 text-sm text-slate-500">
                35 questions · 5 parts · {Math.round(test.duration_sec / 60)} minutes
              </p>
              <Link
                to={`/test/${test.id}`}
                className="mt-4 inline-block self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Start test
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
