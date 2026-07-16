import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminArchiveTest,
  adminListTests,
  adminSetStatus,
  type AdminTestRow,
} from '../../lib/adminApi'
import { EmptyState } from '../../components/EmptyState'
import { TabStrip } from '../../components/TabStrip'

// Spec rule-8 chips — keep identical to the consts in TestFormPage.
const STATUS_BADGE: Record<string, string> = {
  published:
    'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800',
  draft:
    'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800',
}
const NEUTRAL_BADGE =
  'rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-bold text-ink-soft'

// The tabs mirror the "New test ▾" menu, so the list filters by the same three
// kinds you can create. 'part' cuts across skills (a reading drill is both
// Reading and a drill) — that overlap is intended: the tabs are views, not a
// partition.
type TypeFilter = 'all' | 'reading' | 'listening' | 'part'
type StatusFilter = 'all' | 'published' | 'draft'

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'reading', label: 'Reading' },
  { key: 'listening', label: 'Listening' },
  { key: 'part', label: 'Part drills' },
]

function matchesType(test: AdminTestRow, filter: TypeFilter) {
  if (filter === 'all') return true
  if (filter === 'part') return test.scope === 'part'
  return test.skill === filter
}

function matchesSearch(test: AdminTestRow, q: string) {
  if (!q) return true
  const needle = q.toLowerCase()
  return test.title.toLowerCase().includes(needle) || test.slug.toLowerCase().includes(needle)
}

export function AdminTestsPage() {
  const queryClient = useQueryClient()
  const [type, setType] = useState<TypeFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const {
    data: tests,
    isLoading,
    error,
  } = useQuery({ queryKey: ['admin-tests'], queryFn: adminListTests })

  const rows = useMemo(
    () =>
      (tests ?? []).filter(
        (t) =>
          matchesType(t, type) &&
          (status === 'all' || t.status === status) &&
          matchesSearch(t, search),
      ),
    [tests, type, status, search],
  )
  const filtered = rows.length !== (tests?.length ?? 0)

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
        <h1 className="text-2xl font-extrabold text-heading">Tests</h1>
        <details className="group relative">
          <summary className="cursor-pointer list-none rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep">
            New test ▾
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-card">
            <Link to="/admin/tests/new" className="block px-4 py-2 text-sm font-bold text-ink hover:bg-page">
              Reading test
            </Link>
            <Link to="/admin/tests/new/listening" className="block px-4 py-2 text-sm font-bold text-ink hover:bg-page">
              Listening test
            </Link>
            <Link to="/admin/tests/new/part" className="block px-4 py-2 text-sm font-bold text-ink hover:bg-page">
              Part test (single part)
            </Link>
          </div>
        </details>
      </div>

      {tests && tests.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabStrip tabs={TYPE_TABS} value={type} onChange={setType} ariaLabel="Filter by test type" />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              aria-label="Filter by status"
              className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-bold text-ink outline-none transition-colors focus:border-brand"
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or slug…"
              aria-label="Search tests"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand sm:w-56"
            />
          </div>
        </div>
      )}

      {filtered && (
        <p className="text-sm text-ink-soft">
          Showing <span className="font-bold text-ink">{rows.length}</span> of {tests?.length} tests.
        </p>
      )}

      {isLoading && <p className="text-ink-soft">Loading tests…</p>}
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {error instanceof Error ? error.message : 'Could not load tests.'}
        </p>
      )}
      {(statusMutation.error || archiveMutation.error) && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {((statusMutation.error ?? archiveMutation.error) as Error).message}
        </p>
      )}

      {tests && tests.length === 0 && (
        <EmptyState
          pose="nap"
          title="No tests yet"
          hint="Create your first test — the fixed template walks you through all 35 questions, for Reading or Listening."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to="/admin/tests/new"
                className="inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
              >
                New Reading test
              </Link>
              <Link
                to="/admin/tests/new/listening"
                className="inline-block rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
              >
                New Listening test
              </Link>
            </div>
          }
        />
      )}

      {tests && tests.length > 0 && rows.length === 0 && (
        <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-sm text-ink-soft shadow-card">
          No tests match this filter.{' '}
          <button
            onClick={() => {
              setType('all')
              setStatus('all')
              setSearch('')
            }}
            className="font-bold text-brand hover:underline"
          >
            Clear filters
          </button>
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((test) => (
                <tr key={test.id}>
                  <td className="px-4 py-3 font-bold">{test.title}</td>
                  <td className="tnum px-4 py-3 text-xs text-ink-soft">{test.slug}</td>
                  <td className="px-4 py-3 capitalize">
                    {test.skill}
                    {test.scope === 'part' && (
                      <span className="ml-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold normal-case text-brand">
                        Part {test.part_number}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={STATUS_BADGE[test.status] ?? NEUTRAL_BADGE}>
                      {test.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {new Date(test.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/admin/tests/${test.slug}`}
                        className="rounded-xl border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink transition-colors hover:border-ink-faint"
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
                        className="rounded-xl border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
                      >
                        {test.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => handleArchive(test)}
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
    </div>
  )
}
