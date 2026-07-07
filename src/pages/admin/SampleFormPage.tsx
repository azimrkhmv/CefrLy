import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ValidationError,
  adminGetSample,
  adminSetSampleStatus,
  adminUpsertSample,
  type SampleStatus,
} from '../../lib/adminApi'
import {
  draftToUpsertInput,
  emptySampleDraft,
  sampleDraftErrors,
  sampleToDraft,
  type SampleDraft,
} from '../../lib/sampleDraft'
import { slugify } from '../../lib/testDraft'
import {
  SAMPLE_CATEGORIES,
  sampleCategoryLabel,
  type SampleCategory,
} from '../../types/sample'
import { SectionCard, SelectField, TextAreaField, TextField } from '../../components/admin/form/fields'
import {
  ImagesEditor,
  NumberField,
  StringListEditor,
  TurnListEditor,
  VocabEditor,
} from '../../components/admin/form/SampleEditors'

const STATUS_BADGE: Record<string, string> = {
  published:
    'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800',
  draft: 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800',
}
const NEUTRAL_BADGE =
  'rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-bold text-ink-soft'

// Create (/admin/samples/new) and edit (/admin/samples/:slug) share this page.
// Edit differs by prefill and a locked slug + category (both define identity /
// the model shape). The edge function re-validates every save server-side.
export function SampleFormPage() {
  const { slug: editSlug } = useParams<{ slug: string }>()
  const isEdit = !!editSlug
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState<SampleDraft>(emptySampleDraft)
  const [slugTouched, setSlugTouched] = useState(false)
  const [status, setStatus] = useState<SampleStatus>('draft')
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const existing = useQuery({
    queryKey: ['admin-sample', editSlug],
    queryFn: () => adminGetSample(editSlug!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing.data) {
      setDraft(sampleToDraft(existing.data))
      setStatus(existing.data.status)
    }
  }, [existing.data])

  const liveErrors = useMemo(() => sampleDraftErrors(draft), [draft])
  const speaking = draft.category === 'speaking'
  const categoryMeta = SAMPLE_CATEGORIES.find((c) => c.key === draft.category)

  const invalidate = (slug: string) => {
    queryClient.invalidateQueries({ queryKey: ['admin-samples'] })
    queryClient.invalidateQueries({ queryKey: ['admin-sample', slug] })
    queryClient.invalidateQueries({ queryKey: ['samples'] }) // the student /samples list
  }

  const save = useMutation({
    mutationFn: () => adminUpsertSample(draftToUpsertInput(draft, status === 'published' ? 'published' : 'draft')),
    onSuccess: (result) => {
      setServerErrors([])
      setSavedAt(new Date().toLocaleTimeString())
      invalidate(result.slug)
      if (!isEdit) navigate(`/admin/samples/${result.slug}`, { replace: true })
    },
    onError: (error) => {
      setSavedAt(null)
      setServerErrors(error instanceof ValidationError ? error.errors : [error.message])
    },
  })

  const statusMutation = useMutation({
    mutationFn: (next: 'draft' | 'published') => adminSetSampleStatus(draft.slug, next),
    onSuccess: (result) => {
      setStatus(result.status)
      invalidate(result.slug)
    },
  })

  if (isEdit && existing.isLoading) {
    return <p className="py-24 text-center text-ink-soft">Loading sample…</p>
  }
  if (isEdit && existing.error) {
    return (
      <p className="py-24 text-center text-sm text-rose-700">
        {existing.error instanceof Error ? existing.error.message : 'Could not load this sample.'}
      </p>
    )
  }

  const set = (patch: Partial<SampleDraft>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-heading">
            {isEdit ? `Edit: ${draft.title || editSlug}` : 'New sample'}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            A Writing or Speaking model answer for the /samples library.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <>
              <span className={STATUS_BADGE[status] ?? NEUTRAL_BADGE}>{status}</span>
              <button
                onClick={() => statusMutation.mutate(status === 'published' ? 'draft' : 'published')}
                disabled={statusMutation.isPending}
                className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
              >
                {status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
            </>
          )}
          <Link
            to="/admin/samples"
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Back to list
          </Link>
        </div>
      </div>

      <SectionCard title="Sample details">
        <div className="grid gap-4 sm:grid-cols-2">
          {isEdit ? (
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Category</span>
              <div className="rounded-xl border border-line bg-page px-3 py-2 text-sm text-ink-soft">
                {sampleCategoryLabel(draft.category as SampleCategory)}
              </div>
              <span className="mt-1 block text-xs text-ink-soft">The category can’t change after creation.</span>
            </label>
          ) : (
            <SelectField
              label="Category"
              value={draft.category}
              onChange={(value) =>
                set({
                  category: value as SampleCategory,
                  badge:
                    draft.badge.trim() === ''
                      ? SAMPLE_CATEGORIES.find((c) => c.key === value)?.badgeHint ?? ''
                      : draft.badge,
                })
              }
              options={SAMPLE_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
            />
          )}
          <TextField
            label="Slug (URL name)"
            value={draft.slug}
            mono
            disabled={isEdit}
            onChange={(slug) => {
              setSlugTouched(true)
              set({ slug: slugify(slug) })
            }}
            hint={isEdit ? 'The slug cannot change after creation.' : 'Lowercase letters, digits, hyphens.'}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Badge (eyebrow shown on the card)"
            value={draft.badge}
            onChange={(badge) => set({ badge })}
            placeholder={categoryMeta?.badgeHint ?? 'Task 1.1 · Informal email'}
          />
          <NumberField
            label="Sort order"
            value={draft.sortOrder}
            onChange={(sortOrder) => set({ sortOrder })}
            hint="Lower shows first within the category."
          />
        </div>
        <TextField
          label="Title"
          value={draft.title}
          onChange={(title) =>
            set({ title, slug: isEdit || slugTouched ? draft.slug : slugify(title) })
          }
          placeholder="Fitness club closure — email to a friend"
        />
      </SectionCard>

      <SectionCard title="The task" subtitle="What the student is asked to do — one line per paragraph. Include the received email / question here.">
        <StringListEditor
          items={draft.task}
          onChange={(task) => set({ task })}
          multiline
          placeholder="Task line / scenario paragraph…"
          addLabel="+ Add task line"
        />
        <TextAreaField
          label="Note (timing / length line)"
          rows={2}
          value={draft.note}
          onChange={(note) => set({ note })}
          placeholder={
            speaking ? 'e.g. Speak for about two minutes — a personal example plus a reflection.' : 'e.g. Write 120–150 words · ~23 minutes · Level B2 (formal email).'
          }
        />
        <details className="rounded-xl bg-page p-3">
          <summary className="cursor-pointer text-sm font-bold">Bullet points (optional)</summary>
          <div className="mt-3">
            <StringListEditor
              items={draft.bullets}
              onChange={(bullets) => set({ bullets })}
              placeholder="A short bullet under the task…"
              addLabel="+ Add bullet"
            />
          </div>
        </details>
      </SectionCard>

      <SectionCard
        title={speaking ? 'Model response (dialogue turns)' : 'Model answer (paragraphs)'}
        subtitle={
          speaking
            ? 'Each turn has a speaker (Examiner / Student) and what they say.'
            : 'One entry per paragraph, including the greeting and sign-off lines.'
        }
      >
        {speaking ? (
          <TurnListEditor items={draft.modelTurns} onChange={(modelTurns) => set({ modelTurns })} />
        ) : (
          <StringListEditor
            items={draft.modelParagraphs}
            onChange={(modelParagraphs) => set({ modelParagraphs })}
            multiline
            placeholder="A paragraph of the model answer…"
            addLabel="+ Add paragraph"
          />
        )}
      </SectionCard>

      <SectionCard title="Vocabulary (optional)" subtitle="Useful words from the answer: term, meaning, and an Uzbek gloss.">
        <VocabEditor items={draft.vocab} onChange={(vocab) => set({ vocab })} />
      </SectionCard>

      <SectionCard
        title="Prompt images (optional)"
        subtitle={
          speaking
            ? 'Speaking Part 1.2 / Part 2 photos. Two images render side by side as a comparison.'
            : 'Only needed for a “describe the visual” task — most writing samples have none.'
        }
      >
        <ImagesEditor slug={draft.slug} items={draft.images} onChange={(images) => set({ images })} />
      </SectionCard>

      <SectionCard title="Why this scores well" subtitle="The teaching bullets shown after the model answer.">
        <StringListEditor
          items={draft.why}
          onChange={(why) => set({ why })}
          multiline
          placeholder="A reason this answer scores well…"
          addLabel="+ Add point"
        />
      </SectionCard>

      {/* sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-page px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          {liveErrors.length > 0 ? (
            <details className="min-w-0 flex-1">
              <summary className="cursor-pointer text-sm font-bold text-amber-700">
                {liveErrors.length} problem{liveErrors.length === 1 ? '' : 's'} to fix
              </summary>
              <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-ink-soft">
                {liveErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          ) : (
            <span className="flex-1 text-sm font-semibold text-ok">All checks pass — ready to save.</span>
          )}
          {savedAt && <span className="tnum text-xs text-ink-soft">Saved {savedAt}</span>}
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !draft.slug || !draft.category}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Save as draft'}
          </button>
        </div>
        {serverErrors.length > 0 && (
          <div className="mx-auto mt-2 max-w-6xl rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
            <p className="font-bold">The server rejected the sample:</p>
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
