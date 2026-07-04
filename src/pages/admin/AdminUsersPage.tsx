import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminListUsers, adminSetUserRole, type AdminUserRow } from '../../lib/adminApi'
import { useAuth } from '../../lib/auth'

// Neutral chips; brand text marks the admin roles.
const ROLE_BADGE: Record<string, string> = {
  super_admin: 'rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-bold text-brand',
  admin: 'rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-bold text-brand',
  student: 'rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-bold text-ink-soft',
}

export function AdminUsersPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const {
    data: users,
    isLoading,
    error,
  } = useQuery({ queryKey: ['admin-users'], queryFn: adminListUsers })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'student' | 'admin' }) =>
      adminSetUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  function actionFor(user: AdminUserRow) {
    if (user.role === 'super_admin' || user.id === session?.user.id) return null
    if (user.role === 'student') {
      return (
        <button
          onClick={() => roleMutation.mutate({ userId: user.id, role: 'admin' })}
          disabled={roleMutation.isPending}
          className="rounded-xl border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
        >
          Promote to admin
        </button>
      )
    }
    return (
      <button
        onClick={() => {
          if (window.confirm(`Remove admin access for ${user.email}?`)) {
            roleMutation.mutate({ userId: user.id, role: 'student' })
          }
        }}
        disabled={roleMutation.isPending}
        className="rounded-xl border border-line bg-white px-2.5 py-1 text-xs font-bold text-rose-700 transition-colors hover:border-rose-300 disabled:opacity-50"
      >
        Demote to student
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Admins</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Admins can manage all tests but cannot manage users. Only you (super admin) can see
          this page.
        </p>
      </div>

      {isLoading && <p className="text-ink-soft">Loading users…</p>}
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {error instanceof Error ? error.message : 'Could not load users.'}
        </p>
      )}
      {roleMutation.error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {(roleMutation.error as Error).message}
        </p>
      )}

      {users && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-bold">
                    {user.email}
                    {user.id === session?.user.id && (
                      <span className="ml-2 text-xs text-ink-soft">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{user.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={ROLE_BADGE[user.role]}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">{actionFor(user)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
