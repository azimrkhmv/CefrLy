import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchEntitlements } from '../lib/api'
import { ACTION_LABEL, PLAN_META } from '../lib/plans'
import type { ActionType } from '../types/plan'

// The signed-in student's plan + this month's PREMIUM-test usage. Free tests are
// unlimited for everyone and never metered, so this only shows caps once you're
// on a paid plan. Reads the authoritative numbers from get-entitlements.

// The live, enforceable premium actions today (Writing/Speaking checks aren't
// built yet, so their quotas are hidden for now).
const SHOWN_ACTIONS: ActionType[] = ['full_mock', 'reading_set', 'listening_set']

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit === null
  const pct = unlimited ? 12 : limit === 0 ? 100 : Math.min(100, (used / limit) * 100)
  const atCap = !unlimited && used >= limit
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-bold text-ink">{label}</span>
        <span className="tabular-nums font-bold text-ink-soft">
          {unlimited ? 'Unlimited' : `${used} / ${limit}`}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-soft">
        <div
          className={`h-full rounded-full transition-all ${
            unlimited ? 'bg-ok' : atCap ? 'bg-rose-400' : 'bg-brand'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function PlanSummary() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['entitlements'],
    queryFn: fetchEntitlements,
  })

  return (
    <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-line/50 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-heading">Your plan</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Free tests are always unlimited. Premium tests need a paid plan.
          </p>
        </div>
        {data && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold ${
              data.plan === 'free' ? 'border border-line bg-white text-ink-soft' : 'bg-brand text-white'
            }`}
          >
            {PLAN_META[data.plan].name}
            {data.isStaff && ' · staff'}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="mt-5 space-y-4">
          <div className="skeleton h-8 rounded-lg" />
          <div className="skeleton h-8 rounded-lg" />
          <div className="skeleton h-8 rounded-lg" />
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          Could not load your plan: {(error as Error).message}
        </p>
      )}

      {data && (
        <>
          {data.isStaff && (
            <p className="mt-4 rounded-xl border border-brand/20 bg-brand-soft px-3.5 py-2.5 text-sm font-bold text-brand">
              Staff account — unlimited access to everything.
            </p>
          )}
          {data.planExpiresAt && data.plan !== 'free' && !data.isStaff && (
            <p className="mt-4 text-sm text-ink-soft">
              Renews / expires on{' '}
              <span className="font-bold text-ink">
                {new Date(data.planExpiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </span>
              .
            </p>
          )}

          {!data.premiumAccess ? (
            // Free plan: unlimited free tests, but premium tests are locked.
            <div className="mt-5 rounded-xl border border-line bg-page p-4">
              <p className="text-sm font-bold text-ink">
                ✓ Unlimited access to every <span className="text-emerald-700">free</span> test.
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Premium mock tests are locked. Upgrade to Pro or Premium to unlock them.
              </p>
            </div>
          ) : (
            // Paid plan: show this month's premium-test allowance.
            <div className="mt-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
                Premium tests this month
              </p>
              {SHOWN_ACTIONS.map((a) => (
                <UsageRow
                  key={a}
                  label={ACTION_LABEL[a]}
                  used={data.usage[a].used}
                  limit={data.usage[a].limit}
                />
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-faint">
              Need more? Upgrade any time — your progress stays.
            </p>
            <Link
              to="/pricing"
              className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              {data.plan === 'free' ? 'See plans' : 'Manage plan'}
            </Link>
          </div>
        </>
      )}
    </section>
  )
}
