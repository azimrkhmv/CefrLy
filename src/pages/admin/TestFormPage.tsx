import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ValidationError,
  adminGetTest,
  adminSetStatus,
  adminUpsertTest,
  type TestStatus,
} from '../../lib/adminApi'
import {
  contentToDraft,
  draftToContent,
  emptyDraft,
  slugify,
  type TestDraft,
} from '../../lib/testDraft'
import { validateReadingTestContent } from '../../lib/testValidation'
import { SectionCard, TextField } from '../../components/admin/form/fields'
import {
  Part1Editor,
  Part2Editor,
  Part3Editor,
  PassagePartEditor,
} from '../../components/admin/form/PartEditors'

// Create (/admin/tests/new) and edit (/admin/tests/:slug) share this page —
// edit differs only by prefill and a locked slug.
export function TestFormPage() {
  const { slug: editSlug } = useParams<{ slug: string }>()
  const isEdit = !!editSlug
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState<TestDraft>(emptyDraft)
  const [slugTouched, setSlugTouched] = useState(false)
  const [status, setStatus] = useState<TestStatus>('draft')
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const existing = useQuery({
    queryKey: ['admin-test', editSlug],
    queryFn: () => adminGetTest(editSlug!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing.data) {
      setDraft(contentToDraft(existing.data.content, existing.data.test.slug))
      setStatus(existing.data.test.status)
    }
  }, [existing.data])

  const content = useMemo(() => draftToContent(draft), [draft])
  const liveErrors = useMemo(() => validateReadingTestContent(content), [content])

  const save = useMutation({
    mutationFn: () =>
      adminUpsertTest(draft.slug, content, status === 'published' ? 'published' : 'draft'),
    onSuccess: (result) => {
      setServerErrors([])
      setSavedAt(new Date().toLocaleTimeString())
      queryClient.invalidateQueries({ queryKey: ['admin-tests'] })
      queryClient.invalidateQueries({ queryKey: ['admin-test', result.slug] })
      if (!isEdit) navigate(`/admin/tests/${result.slug}`, { replace: true })
    },
    onError: (error) => {
      setSavedAt(null)
      setServerErrors(error instanceof ValidationError ? error.errors : [error.message])
    },
  })

  const statusMutation = useMutation({
    mutationFn: (next: 'draft' | 'published') => adminSetStatus(draft.slug, next),
    onSuccess: (result) => {
      setStatus(result.status)
      queryClient.invalidateQueries({ queryKey: ['admin-tests'] })
    },
  })

  if (isEdit && existing.isLoading) {
    return <p className="py-24 text-center text-slate-400">Loading test…</p>
  }
  if (isEdit && existing.error) {
    return (
      <p className="py-24 text-center text-rose-600">
        {existing.error instanceof Error ? existing.error.message : 'Could not load this test.'}
      </p>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? `Edit: ${draft.title || editSlug}` : 'New Reading test'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Fixed template: 5 parts, 35 questions (6 / 8 / 6 / 9 / 6).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {status}
              </span>
              <button
                onClick={() => statusMutation.mutate(status === 'published' ? 'draft' : 'published')}
                disabled={statusMutation.isPending}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
            </>
          )}
          <Link to="/admin/tests" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            Back to list
          </Link>
        </div>
      </div>

      <SectionCard title="Test details">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Title"
            value={draft.title}
            onChange={(title) =>
              setDraft((d) => ({ ...d, title, slug: isEdit || slugTouched ? d.slug : slugify(title) }))
            }
            placeholder="CEFR Reading Mock Test 2"
          />
          <TextField
            label="Slug (URL name)"
            value={draft.slug}
            mono
            disabled={isEdit}
            onChange={(slug) => {
              setSlugTouched(true)
              setDraft((d) => ({ ...d, slug: slugify(slug) }))
            }}
            hint={isEdit ? 'The slug cannot change after creation.' : 'Lowercase letters, digits, hyphens.'}
          />
        </div>
        <TextField
          label="Duration (seconds)"
          value={String(draft.durationSec)}
          onChange={(v) => setDraft((d) => ({ ...d, durationSec: Number(v.replace(/\D/g, '')) || 0 }))}
          hint="3600 = 60 minutes"
        />
      </SectionCard>

      <Part1Editor value={draft.part1} onChange={(part1) => setDraft((d) => ({ ...d, part1 }))} startNumber={1} />
      <Part2Editor value={draft.part2} onChange={(part2) => setDraft((d) => ({ ...d, part2 }))} startNumber={7} />
      <Part3Editor value={draft.part3} onChange={(part3) => setDraft((d) => ({ ...d, part3 }))} startNumber={15} />
      <PassagePartEditor
        title="Part 4 — Passage with questions (21–29)"
        subtitle="9 questions: any mix of multiple choice and True/False/Not Given."
        value={draft.part4}
        onChange={(part4) => setDraft((d) => ({ ...d, part4 }))}
        startNumber={21}
        typeChoices={[
          { value: 'mcq', label: 'Multiple choice' },
          { value: 'tfng', label: 'True/False/NG' },
        ]}
      />
      <PassagePartEditor
        title="Part 5 — Academic passage (30–35)"
        subtitle="6 questions: summary gaps + multiple choice."
        value={draft.part5}
        onChange={(part5) => setDraft((d) => ({ ...d, part5 }))}
        startNumber={30}
        typeChoices={[
          { value: 'gap', label: 'Summary gap' },
          { value: 'mcq', label: 'Multiple choice' },
        ]}
      />

      {/* sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          {liveErrors.length > 0 ? (
            <details className="min-w-0 flex-1">
              <summary className="cursor-pointer text-sm font-medium text-amber-700">
                {liveErrors.length} problem{liveErrors.length === 1 ? '' : 's'} remaining
              </summary>
              <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-slate-600">
                {liveErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          ) : (
            <span className="flex-1 text-sm font-medium text-emerald-700">
              ✓ All checks pass — 35/35 questions complete
            </span>
          )}
          {savedAt && <span className="text-xs text-slate-500">Saved {savedAt}</span>}
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !draft.slug}
            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Save as draft'}
          </button>
        </div>
        {serverErrors.length > 0 && (
          <div className="mx-auto mt-2 max-w-6xl rounded-md bg-rose-50 p-3">
            <p className="text-sm font-semibold text-rose-700">The server rejected the test:</p>
            <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-rose-700">
              {serverErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
