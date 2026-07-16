import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminListUsers, type AdminUserRow } from '../../lib/adminApi'
import { TabStrip } from '../../components/TabStrip'
import { BandPill, RoleChip, formatDay, relativeDay } from '../../components/admin/userDisplay'

type RoleFilter = 'all' | 'student' | 'admin'

const FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'student', label: 'Students' },
  { key: 'admin', label: 'Admins' },
]

function matchesFilter(user: AdminUserRow, filter: RoleFilter) {
  if (filter === 'all') return true
  if (filter === 'admin') return user.role === 'admin' || user.role === 'super_admin'
  return user.role === 'student'
}

function matchesSearch(user: AdminUserRow, q: string) {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    user.email.toLowerCase().includes(needle) ||
    (user.name ?? '').toLowerCase().includes(needle)
  )
}

/** A user's display name, falling back through the fields we might have. */
function displayName(user: AdminUserRow) {
  if (user.name) return user.name
  const joined = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return joined || null
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3 shadow-card">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-heading">{value}</p>
    </div>
  )
}

export function AdminUsersPage() {
  const [filter, setFilter] = useState<RoleFilter>('all')
  const [search, setSearch] = useState('')
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminListUsers,
  })

  const stats = useMemo(() => {
    if (!users) return null
    return {
      total: users.length,
      students: users.filter((u) => u.role === 'student').length,
      admins: users.filter((u) => u.role === 'admin' || u.role === 'super_admin').length,
      active: users.filter((u) => u.attempts_count > 0).length,
    }
  }, [users])

  const rows = useMemo(
    () => (users ?? []).filter((u) => matchesFilter(u, filter) && matchesSearch(u, search)),
    [users, filter, search],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Users</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every account, with its latest mock result. Click a row for the full profile.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Accounts" value={stats.total} />
          <StatTile label="Students" value={stats.students} />
          <StatTile label="Admins" value={stats.admins} />
          <StatTile label="Have attempted" value={stats.active} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabStrip tabs={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter by role" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email or name…"
          aria-label="Search users"
          className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand sm:w-64"
        />
      </div>

      {isLoading && <p className="text-ink-soft">Loading users…</p>}
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {error instanceof Error ? error.message : 'Could not load users.'}
        </p>
      )}

      {users && rows.length === 0 && (
        <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-sm text-ink-soft shadow-card">
          No users match “{search}”.
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Last band</th>
                <th className="px-4 py-3">Best</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((user) => {
                const name = displayName(user)
                return (
                  <tr key={user.id} className="transition-colors hover:bg-page">
                    <td className="px-4 py-3">
                      <Link to={`/admin/users/${user.id}`} className="block">
                        <span className="font-bold text-brand hover:underline">{user.email}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft">
                          {name ?? 'No name yet'}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <RoleChip role={user.role} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-soft">
                      {user.attempts_count === 0 ? (
                        '—'
                      ) : (
                        <>
                          <span className="font-bold text-ink">{user.attempts_count}</span>
                          {user.mocks_count < user.attempts_count && (
                            <span className="ml-1 text-xs">({user.mocks_count} mock)</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.last_band ? (
                        <div className="flex items-center gap-2">
                          <BandPill band={user.last_band} />
                          <span className="tabular-nums text-xs text-ink-soft">
                            {user.last_score}/{user.last_total}
                          </span>
                        </div>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.best_band ? (
                        <span className="tabular-nums text-ink-soft">
                          {user.best_score}/{user.best_total}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {relativeDay(user.last_attempt_at ?? user.last_sign_in_at)}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatDay(user.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
