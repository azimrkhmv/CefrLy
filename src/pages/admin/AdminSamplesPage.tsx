import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminArchiveSample,
  adminListSamples,
  adminSetSampleStatus,
  type AdminSampleRow,
} from '../../lib/adminApi'
import { SAMPLE_CATEGORIES } from '../../types/sample'
import { EmptyState } from '../../components/EmptyState'

const STATUS_BADGE: Record<string, string> = {
  published:
    'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800',
  draft: 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800',
}
const NEUTRAL_BADGE =
  'rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-bold text-ink-soft'

export function AdminSamplesPage() {
  const queryClient = useQueryClient()
  const {
    data: samples,
    isLoading,
    error,
  } = useQuery({ queryKey: ['admin-samples'], queryFn: adminListSamples })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-samples'] })
    queryClient.invalidateQueries({ queryKey: ['samples'] })
  }

  const statusMutation = useMutation({
    mutationFn: ({ slug, status }: { slug: string; status: 'draft' | 'published' }) =>
      adminSetSampleStatus(slug, status),
    onSuccess: invalidate,
  })
  const archiveMutation = useMutation({
    mutationFn: (slug: string) => adminArchiveSample(slug),
    onSuccess: invalidate,
  })

  function handleArchive(sample: AdminSampleRow) {
    const sure = window.confirm(
      `Archive "${sample.title}"? Students will no longer see it. It stays in the database and can be restored later.`,
    )
    if (sure) archiveMutation.mutate(sample.slug)
  }

  const groups = SAMPLE_CATEGORIES.map((c) => ({
    ...c,
    rows: (samples ?? [])
      .filter((s) => s.category === c.key)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-heading">Samples</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Writing &amp; Speaking model answers. Published rows show on /samples.
          </p>
        </div>
        <Link
          to="/admin/samples/new"
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          + New sample
        </Link>
      </div>

      {isLoading && <p className="text-ink-soft">Loading samples…</p>}
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {error instanceof Error ? error.message : 'Could not load samples.'}
        </p>
      )}
      {(statusMutation.error || archiveMutation.error) && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {((statusMutation.error ?? archiveMutation.error) as Error).message}
        </p>
      )}

      {samples && samples.length === 0 && (
        <EmptyState
          pose="nap"
          title="No samples yet"
          hint="Create your first Writing or Speaking model answer."
          action={
            <Link
              to="/admin/samples/new"
              className="inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              New sample
            </Link>
          }
        />
      )}

      {samples &&
        samples.length > 0 &&
        groups.map((group) => (
          <section key={group.key} className="rounded-2xl border border-line bg-white shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="font-extrabold text-heading">{group.label}</h2>
              <span className="text-xs font-semibold text-ink-soft">
                {group.rows.length} sample{group.rows.length === 1 ? '' : 's'}
              </span>
            </div>
            {group.rows.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-soft">Nothing here yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
                    <tr>
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">Title</th>
                      <th className="px-4 py-2.5">Badge</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {group.rows.map((sample) => (
                      <tr key={sample.id}>
                        <td className="tnum px-4 py-3 text-ink-soft">{sample.sort_order}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold">{sample.title}</span>
                          <span className="tnum ml-2 text-xs text-ink-faint">{sample.slug}</span>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{sample.badge}</td>
                        <td className="px-4 py-3">
                          <span className={STATUS_BADGE[sample.status] ?? NEUTRAL_BADGE}>{sample.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Link
                              to={`/admin/samples/${sample.slug}`}
                              className="rounded-xl border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink transition-colors hover:border-ink-faint"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() =>
                                statusMutation.mutate({
                                  slug: sample.slug,
                                  status: sample.status === 'published' ? 'draft' : 'published',
                                })
                              }
                              disabled={statusMutation.isPending}
                              className="rounded-xl border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
                            >
                              {sample.status === 'published' ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                              onClick={() => handleArchive(sample)}
                              disabled={archiveMutation.isPending}
                              className="rounded-xl border border-line bg-white px-2.5 py-1 text-xs font-bold text-rose-700 transition-colors hover:border-rose-300 disabled:opacity-50"
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
          </section>
        ))}
    </div>
  )
}
