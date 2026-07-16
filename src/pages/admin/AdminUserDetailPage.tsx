import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminGetUser, adminSetUserRole, type AdminAttemptRow } from '../../lib/adminApi'
import { useAuth } from '../../lib/auth'
import {
  BandPill,
  DAILY_MINUTES_LABEL,
  FIRST_EXAM_LABEL,
  HEARD_FROM_LABEL,
  RoleChip,
  SELF_LEVEL_LABEL,
  TIMEFRAME_LABEL,
  WEAK_AREA_LABEL,
  formatDateTime,
  formatDay,
  labelFor,
  relativeDay,
} from '../../components/admin/userDisplay'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-ink">{value}</dd>
    </div>
  )
}

/** Reading Mock 2 · Part 3 practice — what the student actually sat. */
function attemptLabel(a: AdminAttemptRow) {
  const title = a.test_title ?? 'Deleted test'
  return a.scope === 'part' && a.part_number !== null ? `${title} · Part ${a.part_number}` : title
}

export function AdminUserDetailPage() {
  const { id = '' } = useParams()
  const { session, role: myRole } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => adminGetUser(id),
    enabled: Boolean(id),
  })

  const roleMutation = useMutation({
    mutationFn: (role: 'student' | 'admin') => adminSetUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  if (isLoading) return <p className="text-ink-soft">Loading profile…</p>
  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/admin/users" className="text-sm font-bold text-brand hover:underline">
          ← Users
        </Link>
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {error instanceof Error ? error.message : 'Could not load this user.'}
        </p>
      </div>
    )
  }
  if (!data) return null

  const { user, onboarding, attempts } = data
  const name = user.name ?? [user.first_name, user.last_name].filter(Boolean).join(' ')
  // The API refuses to touch super admins or your own row; hide the controls to match.
  const canChangeRole =
    myRole === 'super_admin' && user.role !== 'super_admin' && user.id !== session?.user.id

  return (
    <div className="space-y-6">
      <Link to="/admin/users" className="inline-block text-sm font-bold text-brand hover:underline">
        ← Users
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-heading">{name || user.email}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <span>{user.email}</span>
            <RoleChip role={user.role} />
            {user.id === session?.user.id && <span className="text-xs">(you)</span>}
          </p>
        </div>
        {canChangeRole && (
          <div className="flex items-center gap-2">
            {user.role === 'student' ? (
              <button
                onClick={() => roleMutation.mutate('admin')}
                disabled={roleMutation.isPending}
                className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
              >
                Promote to admin
              </button>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm(`Remove admin access for ${user.email}?`)) {
                    roleMutation.mutate('student')
                  }
                }}
                disabled={roleMutation.isPending}
                className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-rose-700 transition-colors hover:border-rose-300 disabled:opacity-50"
              >
                Demote to student
              </button>
            )}
          </div>
        )}
      </header>

      {roleMutation.error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {(roleMutation.error as Error).message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Level">
          {user.best_band ? (
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-bold text-ink-soft">Best mock</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <BandPill band={user.best_band} />
                  <span className="text-lg font-extrabold tabular-nums text-heading">
                    {user.best_score}/{user.best_total}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-ink-soft">Latest mock</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  {user.last_band && <BandPill band={user.last_band} />}
                  <span className="text-sm font-bold tabular-nums text-ink">
                    {user.last_score}/{user.last_total}
                  </span>
                  <span className="text-xs text-ink-soft">{relativeDay(user.last_mock_at)}</span>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-ink-soft">
              No banded mock yet.{' '}
              {user.attempts_count > 0 && `${user.attempts_count} part drill(s) only.`}
            </p>
          )}
        </Card>

        <Card title="Activity">
          <dl className="space-y-3">
            <Field label="Attempts" value={<span className="tabular-nums">{user.attempts_count}</span>} />
            <Field
              label="Full mocks"
              value={<span className="tabular-nums">{user.mocks_count}</span>}
            />
            <Field label="Last attempt" value={relativeDay(user.last_attempt_at)} />
          </dl>
        </Card>

        <Card title="Account">
          <dl className="space-y-3">
            <Field label="Joined" value={formatDay(user.created_at)} />
            <Field label="Last sign-in" value={relativeDay(user.last_sign_in_at)} />
            <Field
              label="Onboarding"
              value={user.onboarded_at ? `Done ${formatDay(user.onboarded_at)}` : 'Not finished'}
            />
          </dl>
        </Card>
      </div>

      <Card title="Onboarding answers">
        {user.onboarded_at === null && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
            This student hasn’t finished the welcome wizard — answers may be incomplete.
          </p>
        )}
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Exam experience" value={labelFor(FIRST_EXAM_LABEL, onboarding.first_exam)} />
          <Field label="Self-assessed level" value={labelFor(SELF_LEVEL_LABEL, onboarding.self_level)} />
          <Field label="Goal band" value={onboarding.target_band ?? '—'} />
          <Field label="Exam timeframe" value={labelFor(TIMEFRAME_LABEL, onboarding.study_timeframe)} />
          <Field
            label="Study time"
            value={
              onboarding.daily_minutes ? DAILY_MINUTES_LABEL[onboarding.daily_minutes] ?? '—' : '—'
            }
          />
          <Field
            label="Heard from"
            value={
              <>
                {labelFor(HEARD_FROM_LABEL, onboarding.heard_from)}
                {onboarding.heard_from_note && (
                  <span className="block text-xs font-normal text-ink-soft">
                    “{onboarding.heard_from_note}”
                  </span>
                )}
              </>
            }
          />
          <Field label="Signup source" value={onboarding.source ?? '—'} />
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold text-ink-soft">Weak areas</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {onboarding.weak_areas && onboarding.weak_areas.length > 0 ? (
                onboarding.weak_areas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand"
                  >
                    {WEAK_AREA_LABEL[area] ?? area}
                  </span>
                ))
              ) : (
                <span className="text-sm font-bold text-ink">—</span>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold text-heading">
          Attempts <span className="font-bold text-ink-soft">· newest first</span>
        </h2>
        {attempts.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-sm text-ink-soft shadow-card">
            No attempts yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
                <tr>
                  <th className="px-4 py-3">Test</th>
                  <th className="px-4 py-3">Skill</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3">Taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-bold text-ink">{attemptLabel(a)}</td>
                    <td className="px-4 py-3 capitalize text-ink-soft">{a.skill ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-ink">
                      {a.raw_score}/{a.total}
                    </td>
                    <td className="px-4 py-3">
                      {a.band ? (
                        <BandPill band={a.band} />
                      ) : (
                        <span className="text-xs text-ink-faint">drill</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatDateTime(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
