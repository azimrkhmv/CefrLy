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

// Spec rule-8 chips — keep identical to the consts in AdminTestsPage.
const STATUS_BADGE: Record<string, string> = {
  published:
    'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800',
  draft:
    'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800',
}
const NEUTRAL_BADGE =
  'rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-bold text-ink-soft'

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
    return <p className="py-24 text-center text-ink-soft">Loading test…</p>
  }
  if (isEdit && existing.error) {
    return (
      <p className="py-24 text-center text-sm text-rose-700">
        {existing.error instanceof Error ? existing.error.message : 'Could not load this test.'}
      </p>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-heading">{isEdit ? `Edit: ${draft.title || editSlug}` : 'New Reading test'}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Fixed template: 5 parts, 35 questions (6 / 8 / 6 / 9 / 6).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <>
              <span className={STATUS_BADGE[status] ?? NEUTRAL_BADGE}>
                {status}
              </span>
              <button
                onClick={() => statusMutation.mutate(status === 'published' ? 'draft' : 'published')}
                disabled={statusMutation.isPending}
                className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
              >
                {status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
            </>
          )}
          <Link to="/admin/tests" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint">
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
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-page px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          {liveErrors.length > 0 ? (
            <details className="min-w-0 flex-1">
              <summary className="cursor-pointer text-sm font-bold text-amber-700">
                {liveErrors.length} problem{liveErrors.length === 1 ? '' : 's'} remaining
              </summary>
              <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-ink-soft">
                {liveErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          ) : (
            <span className="tnum flex-1 text-sm font-semibold text-ok">
              All checks pass — 35/35 questions complete
            </span>
          )}
          {savedAt && <span className="tnum text-xs text-ink-soft">Saved {savedAt}</span>}
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !draft.slug}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Save as draft'}
          </button>
        </div>
        {serverErrors.length > 0 && (
          <div className="mx-auto mt-2 max-w-6xl rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
            <p className="font-bold">The server rejected the test:</p>
            <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs">
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
