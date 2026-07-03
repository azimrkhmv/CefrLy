import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminArchiveTest,
  adminListTests,
  adminSetStatus,
  type AdminTestRow,
} from '../../lib/adminApi'

const STATUS_BADGE: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-800',
  draft: 'bg-amber-100 text-amber-800',
}

export function AdminTestsPage() {
  const queryClient = useQueryClient()
  const {
    data: tests,
    isLoading,
    error,
  } = useQuery({ queryKey: ['admin-tests'], queryFn: adminListTests })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-tests'] })

  const statusMutation = useMutation({
    mutationFn: ({ slug, status }: { slug: string; status: 'draft' | 'published' }) =>
      adminSetStatus(slug, status),
    onSuccess: invalidate,
  })
  const archiveMutation = useMutation({
    mutationFn: (slug: string) => adminArchiveTest(slug),
    onSuccess: invalidate,
  })

  function handleArchive(test: AdminTestRow) {
    const sure = window.confirm(
      `Archive "${test.title}"? Students will no longer see it. It stays in the database and can be restored later.`,
    )
    if (sure) archiveMutation.mutate(test.slug)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tests</h1>
        <Link
          to="/admin/tests/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + New test
        </Link>
      </div>

      {isLoading && <p className="text-slate-400">Loading tests…</p>}
      {error && (
        <p className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error instanceof Error ? error.message : 'Could not load tests.'}
        </p>
      )}
      {(statusMutation.error || archiveMutation.error) && (
        <p className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {((statusMutation.error ?? archiveMutation.error) as Error).message}
        </p>
      )}

      {tests && tests.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          No tests yet — create the first one.
        </p>
      )}

      {tests && tests.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tests.map((test) => (
                <tr key={test.id}>
                  <td className="px-4 py-3 font-medium">{test.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{test.slug}</td>
                  <td className="px-4 py-3 capitalize">{test.skill}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[test.status] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {test.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(test.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/admin/tests/${test.slug}`}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() =>
                          statusMutation.mutate({
                            slug: test.slug,
                            status: test.status === 'published' ? 'draft' : 'published',
                          })
                        }
                        disabled={statusMutation.isPending}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                      >
                        {test.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => handleArchive(test)}
                        disabled={archiveMutation.isPending}
                        className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Archive
                      </button>
                    </div>
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
