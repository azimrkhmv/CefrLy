// Editable draft shape for the /admin/samples form, plus the converters and a
// client-side validator that MIRRORS supabase/functions/admin-samples/
// validate.ts (the server stays authoritative — this only powers the live
// "N problems remaining" hint). Writing keeps model paragraphs; speaking keeps
// dialogue turns; we hold BOTH in the draft so switching category never loses
// what you typed.
import type {
  AdminSampleFull,
  SampleUpsertInput,
} from './adminApi'
import type {
  SampleCategory,
  SampleContent,
  SampleImage,
  SpeakingTurn,
  VocabItem,
} from '../types/sample'
import { SAMPLE_CATEGORIES } from '../types/sample'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface SampleDraft {
  slug: string
  category: SampleCategory | ''
  badge: string
  title: string
  sortOrder: number
  task: string[]
  bullets: string[]
  note: string
  modelParagraphs: string[] // writing
  modelTurns: SpeakingTurn[] // speaking
  vocab: VocabItem[]
  images: SampleImage[]
  why: string[]
}

export const emptySampleDraft = (): SampleDraft => ({
  slug: '',
  category: '',
  badge: '',
  title: '',
  sortOrder: 0,
  task: [''],
  bullets: [],
  note: '',
  modelParagraphs: [''],
  modelTurns: [{ speaker: 'Student', text: '' }],
  vocab: [],
  images: [],
  why: [''],
})

const isSpeaking = (c: SampleCategory | ''): boolean => c === 'speaking'

/** Load an existing sample into the editable draft. */
export function sampleToDraft(s: AdminSampleFull): SampleDraft {
  const c = s.content
  const speaking = isSpeaking(s.category)
  return {
    slug: s.slug,
    category: s.category,
    badge: s.badge,
    title: s.title,
    sortOrder: s.sort_order,
    task: c.task?.length ? [...c.task] : [''],
    bullets: c.bullets ? [...c.bullets] : [],
    note: c.note ?? '',
    modelParagraphs: !speaking && Array.isArray(c.model) ? (c.model as string[]) : [''],
    modelTurns: speaking && Array.isArray(c.model) ? (c.model as SpeakingTurn[]) : [{ speaker: 'Student', text: '' }],
    vocab: c.vocab ? c.vocab.map((v) => ({ ...v })) : [],
    images: c.images ? c.images.map((i) => ({ ...i })) : [],
    why: c.why?.length ? [...c.why] : [''],
  }
}

const cleanList = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean)

/** Build the `content` object the edge function expects — trimmed, with empty
 *  optional sections omitted, and the model shaped for the chosen category. */
export function draftToContent(d: SampleDraft): SampleContent {
  const speaking = isSpeaking(d.category)
  const model: string[] | SpeakingTurn[] = speaking
    ? d.modelTurns
        .map((t) => ({ speaker: t.speaker.trim(), text: t.text.trim() }))
        .filter((t) => t.speaker && t.text)
    : cleanList(d.modelParagraphs)

  const content: SampleContent = {
    task: cleanList(d.task),
    note: d.note.trim(),
    model,
  }

  const why = cleanList(d.why)
  if (why.length) content.why = why

  const bullets = cleanList(d.bullets)
  if (bullets.length) content.bullets = bullets

  const vocab = d.vocab
    .map((v) => {
      const uz = v.uz?.trim()
      return { term: v.term.trim(), meaning: v.meaning.trim(), ...(uz ? { uz } : {}) }
    })
    .filter((v) => v.term && v.meaning)
  if (vocab.length) content.vocab = vocab

  const images = d.images
    .map((i) => {
      const caption = i.caption?.trim()
      return { assetPath: i.assetPath.trim(), alt: i.alt.trim(), ...(caption ? { caption } : {}) }
    })
    .filter((i) => i.assetPath && i.alt)
  if (images.length) content.images = images

  return content
}

/** slug/status are passed by the form; this bundles the validated meta+content. */
export function draftToUpsertInput(d: SampleDraft, status: 'draft' | 'published'): SampleUpsertInput {
  return {
    slug: d.slug,
    category: d.category as SampleCategory,
    badge: d.badge.trim(),
    title: d.title.trim(),
    content: draftToContent(d),
    status,
    sortOrder: d.sortOrder,
  }
}

/** Mirrors the server validator so the form can show problems before saving. */
export function sampleDraftErrors(d: SampleDraft): string[] {
  const e: string[] = []
  if (!d.slug || !SLUG_RE.test(d.slug)) e.push('Slug must be lowercase letters, digits and hyphens.')
  if (!SAMPLE_CATEGORIES.some((c) => c.key === d.category)) e.push('Pick a category.')
  if (!d.badge.trim()) e.push('Badge is required (e.g. “Task 1.1 · Informal email”).')
  if (!d.title.trim()) e.push('Title is required.')
  if (!Number.isInteger(d.sortOrder)) e.push('Sort order must be a whole number.')

  const content = draftToContent(d)
  if (content.task.length === 0) e.push('Add at least one task line.')
  if (!content.note.trim()) e.push('Note is required (the timing/length line).')
  // "why this scores well" is optional (bulk-ingested samples omit it).
  if (content.model.length === 0) {
    e.push(isSpeaking(d.category) ? 'Add at least one complete dialogue turn.' : 'Add at least one model paragraph.')
  }

  // Surface half-filled optional rows so they aren't silently dropped.
  d.vocab.forEach((v, i) => {
    const hasAny = v.term.trim() || v.meaning.trim() || v.uz?.trim()
    if (hasAny && !(v.term.trim() && v.meaning.trim())) e.push(`Vocabulary #${i + 1} needs both a term and a meaning.`)
  })
  d.images.forEach((img, i) => {
    if (img.assetPath.trim() && !img.alt.trim()) e.push(`Image #${i + 1} needs alt text.`)
    if (!img.assetPath.trim() && (img.alt.trim() || img.caption?.trim())) e.push(`Image #${i + 1} needs an uploaded file.`)
  })
  if (isSpeaking(d.category)) {
    d.modelTurns.forEach((t, i) => {
      const hasAny = t.speaker.trim() || t.text.trim()
      if (hasAny && !(t.speaker.trim() && t.text.trim())) e.push(`Turn #${i + 1} needs both a speaker and text.`)
    })
  }
  return e
}

export { SLUG_RE }
