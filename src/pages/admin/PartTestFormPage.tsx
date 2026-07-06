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
import {
  contentToListeningDraft,
  emptyListeningDraft,
  listeningDraftToContent,
  type ListeningDraft,
} from '../../lib/listeningDraft'
import type { ListeningTest, ReadingTest, Skill } from '../../types/test'
import { validateReadingTestContent } from '../../lib/testValidation'
import { validateListeningTestContent } from '../../lib/listeningValidation'
import { SectionCard, TextField } from '../../components/admin/form/fields'
import {
  Part1Editor,
  Part2Editor,
  Part3Editor,
  PassagePartEditor,
} from '../../components/admin/form/PartEditors'
import {
  LPart1Editor,
  LPart3Editor,
  LPart4Editor,
  LPart5Editor,
  LStemPartEditor,
} from '../../components/admin/form/ListeningPartEditors'

const STATUS_BADGE: Record<string, string> = {
  published:
    'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800',
  draft:
    'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800',
}
const NEUTRAL_BADGE =
  'rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-bold text-ink-soft'

const PART_LABELS: Record<Skill, string[]> = {
  reading: [
    'Gap fill (cloze)',
    'Matching texts',
    'Matching headings',
    'Passage questions',
    'Summary completion',
  ],
  listening: [
    'Short replies',
    'Form completion',
    'Matching speakers',
    'Map labelling',
    'Three extracts',
    'Note completion',
  ],
}

// Single-part test authoring (create at /admin/tests/new/part, edit via
// TestFormRouter when content.scope === 'part'). The trick that keeps this
// page small: it maintains a FULL draft per skill (the other slices stay
// empty), builds the full content with the existing converters, then keeps
// only the chosen part and stamps scope/partNumber. Prefill reverses it by
// planting the stored part into an empty full draft.
export function PartTestFormPage() {
  const { slug: editSlug } = useParams<{ slug: string }>()
  const isEdit = !!editSlug
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [skill, setSkill] = useState<Skill>('reading')
  const [partNumber, setPartNumber] = useState(1)
  const [draft, setDraft] = useState<TestDraft>(emptyDraft)
  const [ldraft, setLdraft] = useState<ListeningDraft>(emptyListeningDraft)
  const [slugTouched, setSlugTouched] = useState(false)
  const [status, setStatus] = useState<TestStatus>('draft')
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Shared meta lives on whichever draft matches the active skill.
  const meta = skill === 'listening' ? ldraft : draft
  const setMeta = (patch: { title?: string; slug?: string; durationSec?: number }) => {
    setDraft((d) => ({ ...d, ...patch }))
    setLdraft((d) => ({ ...d, ...patch }))
  }

  const existing = useQuery({
    queryKey: ['admin-test', editSlug],
    queryFn: () => adminGetTest(editSlug!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!existing.data) return
    const content = existing.data.content as (ReadingTest | ListeningTest) & {
      scope?: string
      partNumber?: number | null
    }
    const pn = content.partNumber ?? existing.data.test.part_number ?? 1
    setPartNumber(pn)
    setStatus(existing.data.test.status)
    if (content.skill === 'listening') {
      setSkill('listening')
      // Plant the stored part into an empty full draft so the standard
      // 6-part prefill converter can run.
      const template = listeningDraftToContent(emptyListeningDraft())
      const synthetic: ListeningTest = {
        ...(content as ListeningTest),
        audioMode: 'per_part',
        parts: template.parts.map((p) => (p.number === pn ? content.parts[0] : p)),
      }
      setLdraft(contentToListeningDraft(synthetic, existing.data.test.slug))
      setDraft((d) => ({ ...d, title: content.title, slug: existing.data.test.slug, durationSec: content.durationSec }))
    } else {
      setSkill('reading')
      const template = draftToContent(emptyDraft())
      const synthetic: ReadingTest = {
        ...(content as ReadingTest),
        parts: template.parts.map((p) => (p.number === pn ? (content as ReadingTest).parts[0] : p)),
      }
      setDraft(contentToDraft(synthetic, existing.data.test.slug))
      setLdraft((d) => ({ ...d, title: content.title, slug: existing.data.test.slug, durationSec: content.durationSec }))
    }
  }, [existing.data])

  const maxPart = skill === 'listening' ? 6 : 5

  // Build the one-part content: full content from the existing converters,
  // then keep only the chosen part + the scope/partNumber markers.
  const content = useMemo(() => {
    if (skill === 'listening') {
      const full = listeningDraftToContent({ ...ldraft, audioMode: 'per_part' })
      return {
        ...full,
        scope: 'part' as const,
        partNumber,
        parts: [full.parts[partNumber - 1]],
      }
    }
    const full = draftToContent(draft)
    return {
      ...full,
      scope: 'part' as const,
      partNumber,
      parts: [full.parts[partNumber - 1]],
    }
  }, [skill, partNumber, draft, ldraft])

  const liveErrors = useMemo(
    () =>
      skill === 'listening'
        ? validateListeningTestContent(content, partNumber)
        : validateReadingTestContent(content, partNumber),
    [skill, content, partNumber],
  )

  const save = useMutation({
    mutationFn: () =>
      adminUpsertTest(meta.slug, content, status === 'published' ? 'published' : 'draft'),
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
    mutationFn: (next: 'draft' | 'published') => adminSetStatus(meta.slug, next),
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

  const partLabel = PART_LABELS[skill][partNumber - 1]

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-heading">
            {isEdit ? `Edit: ${meta.title || editSlug}` : 'New part test'}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            One canonical part as its own practice drill — same layout rules as the full paper.
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
            to="/admin/tests"
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Back to list
          </Link>
        </div>
      </div>

      <SectionCard title="Part test details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink">Skill</label>
            <select
              value={skill}
              onChange={(e) => {
                setSkill(e.target.value as Skill)
                setPartNumber(1)
              }}
              disabled={isEdit}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
            >
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink">Part</label>
            <select
              value={partNumber}
              onChange={(e) => setPartNumber(Number(e.target.value))}
              disabled={isEdit}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
            >
              {Array.from({ length: maxPart }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Part {n} — {PART_LABELS[skill][n - 1]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Title"
            value={meta.title}
            onChange={(title) =>
              setMeta({ title, ...(isEdit || slugTouched ? {} : { slug: slugify(title) }) })
            }
            placeholder={`${skill === 'listening' ? 'Listening' : 'Reading'} Part ${partNumber} — ${partLabel} drill`}
          />
          <TextField
            label="Slug (URL name)"
            value={meta.slug}
            mono
            disabled={isEdit}
            onChange={(slug) => {
              setSlugTouched(true)
              setMeta({ slug: slugify(slug) })
            }}
            hint={isEdit ? 'The slug cannot change after creation.' : 'Lowercase letters, digits, hyphens.'}
          />
        </div>
        <TextField
          label="Duration (seconds)"
          value={String(meta.durationSec)}
          onChange={(v) => setMeta({ durationSec: Number(v.replace(/\D/g, '')) || 0 })}
          hint={
            skill === 'listening'
              ? 'Housekeeping only — listening drills are paced by the recording.'
              : '600 = 10 minutes. Students get exactly this long.'
          }
        />
      </SectionCard>

      {/* The one chosen part, edited with the same editor the full form uses. */}
      {skill === 'reading' && partNumber === 1 && (
        <Part1Editor value={draft.part1} onChange={(part1) => setDraft((d) => ({ ...d, part1 }))} startNumber={1} />
      )}
      {skill === 'reading' && partNumber === 2 && (
        <Part2Editor value={draft.part2} onChange={(part2) => setDraft((d) => ({ ...d, part2 }))} startNumber={7} />
      )}
      {skill === 'reading' && partNumber === 3 && (
        <Part3Editor value={draft.part3} onChange={(part3) => setDraft((d) => ({ ...d, part3 }))} startNumber={15} />
      )}
      {skill === 'reading' && partNumber === 4 && (
        <PassagePartEditor
          title="Part 4 — Passage with questions"
          subtitle="9 questions: any mix of multiple choice and True/False/Not Given."
          value={draft.part4}
          onChange={(part4) => setDraft((d) => ({ ...d, part4 }))}
          startNumber={21}
          typeChoices={[
            { value: 'mcq', label: 'Multiple choice' },
            { value: 'tfng', label: 'True/False/NG' },
          ]}
        />
      )}
      {skill === 'reading' && partNumber === 5 && (
        <PassagePartEditor
          title="Part 5 — Academic passage"
          subtitle="6 questions: summary gaps + multiple choice."
          value={draft.part5}
          onChange={(part5) => setDraft((d) => ({ ...d, part5 }))}
          startNumber={30}
          typeChoices={[
            { value: 'gap', label: 'Summary gap' },
            { value: 'mcq', label: 'Multiple choice' },
          ]}
        />
      )}
      {skill === 'listening' && partNumber === 1 && (
        <LPart1Editor value={ldraft.part1} onChange={(part1) => setLdraft((d) => ({ ...d, part1 }))} slug={ldraft.slug} audioMode="per_part" />
      )}
      {skill === 'listening' && partNumber === 2 && (
        <LStemPartEditor
          title="Part 2 — Form completion"
          subtitle="6 gaps; one word or number each."
          value={ldraft.part2}
          onChange={(part2) => setLdraft((d) => ({ ...d, part2 }))}
          slug={ldraft.slug}
          audioMode="per_part"
          startNumber={9}
          pathKey="part2"
        />
      )}
      {skill === 'listening' && partNumber === 3 && (
        <LPart3Editor value={ldraft.part3} onChange={(part3) => setLdraft((d) => ({ ...d, part3 }))} slug={ldraft.slug} audioMode="per_part" />
      )}
      {skill === 'listening' && partNumber === 4 && (
        <LPart4Editor value={ldraft.part4} onChange={(part4) => setLdraft((d) => ({ ...d, part4 }))} slug={ldraft.slug} audioMode="per_part" />
      )}
      {skill === 'listening' && partNumber === 5 && (
        <LPart5Editor value={ldraft.part5} onChange={(part5) => setLdraft((d) => ({ ...d, part5 }))} slug={ldraft.slug} audioMode="per_part" />
      )}
      {skill === 'listening' && partNumber === 6 && (
        <LStemPartEditor
          title="Part 6 — Note completion"
          subtitle="6 gaps; one word each."
          value={ldraft.part6}
          onChange={(part6) => setLdraft((d) => ({ ...d, part6 }))}
          slug={ldraft.slug}
          audioMode="per_part"
          startNumber={30}
          pathKey="part6"
        />
      )}

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
              All checks pass — Part {partNumber} ({partLabel}) complete
            </span>
          )}
          {savedAt && <span className="tnum text-xs text-ink-soft">Saved {savedAt}</span>}
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !meta.slug}
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
