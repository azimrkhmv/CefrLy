import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminListUsers, adminSetUserRole, type AdminUserRow } from '../../lib/adminApi'
import { useAuth } from '../../lib/auth'

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-indigo-100 text-indigo-800',
  admin: 'bg-emerald-100 text-emerald-800',
  student: 'bg-slate-100 text-slate-600',
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
          className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
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
        className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
      >
        Demote to student
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admins</h1>
        <p className="mt-1 text-sm text-slate-500">
          Admins can manage all tests but cannot manage users. Only you (super admin) can see
          this page.
        </p>
      </div>

      {isLoading && <p className="text-slate-400">Loading users…</p>}
      {error && (
        <p className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error instanceof Error ? error.message : 'Could not load users.'}
        </p>
      )}
      {roleMutation.error && (
        <p className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {(roleMutation.error as Error).message}
        </p>
      )}

      {users && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium">
                    {user.email}
                    {user.id === session?.user.id && (
                      <span className="ml-2 text-xs text-slate-400">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{user.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[user.role]}`}
                    >
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
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
