// Server-side validation for Writing/Speaking samples. Mirrors the client
// shapes in src/types/sample.ts — a sample that passes here renders cleanly
// on the /samples page. Kept deliberately lenient on style, strict on shape.

export const CATEGORIES = ['writing1_1', 'writing1_2', 'writing2', 'speaking'] as const
export type Category = (typeof CATEGORIES)[number]

const MAX_ITEMS = 40 // no array in a sample legitimately needs more
const MAX_TEXT = 8000 // per paragraph/turn — a sample is a lesson, not a book
const MAX_IMAGES = 4 // a compare task shows 2; leave headroom, but not a gallery

function isFilledString(v: unknown, max = MAX_TEXT): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max
}

function checkStringArray(v: unknown, label: string, errors: string[], { optional = false } = {}) {
  if (v === undefined || v === null) {
    if (!optional) errors.push(`${label} is required (a non-empty list of strings).`)
    return
  }
  if (!Array.isArray(v) || v.length === 0) {
    errors.push(`${label} must be a non-empty array of strings.`)
    return
  }
  if (v.length > MAX_ITEMS) errors.push(`${label} has too many items (max ${MAX_ITEMS}).`)
  v.forEach((item, i) => {
    if (!isFilledString(item)) errors.push(`${label}[${i}] must be a non-empty string.`)
  })
}

// deno-lint-ignore no-explicit-any
export function validateSample(category: unknown, badge: unknown, title: unknown, content: any): string[] {
  const errors: string[] = []

  if (!CATEGORIES.includes(category as Category)) {
    errors.push(`category must be one of: ${CATEGORIES.join(', ')}.`)
  }
  if (!isFilledString(badge, 120)) errors.push('badge is required (max 120 chars).')
  if (!isFilledString(title, 200)) errors.push('title is required (max 200 chars).')

  if (typeof content !== 'object' || content === null || Array.isArray(content)) {
    errors.push('content must be an object.')
    return errors
  }

  checkStringArray(content.task, 'content.task', errors)
  checkStringArray(content.bullets, 'content.bullets', errors, { optional: true })
  if (!isFilledString(content.note, 500)) {
    errors.push('content.note is required (the "write at least…" line, max 500 chars).')
  }
  checkStringArray(content.why, 'content.why', errors, { optional: true })

  // images (optional): a chart/map for a Writing Task 1 "describe the visual"
  // task, or the photo(s) a Speaking task asks about. Each item is
  // { assetPath, alt, caption? } — assetPath is a path in the `images` bucket.
  if (content.images !== undefined && content.images !== null) {
    if (!Array.isArray(content.images) || content.images.length === 0) {
      errors.push('content.images must be a non-empty array when present (omit it for text-only tasks).')
    } else if (content.images.length > MAX_IMAGES) {
      errors.push(`content.images has too many items (max ${MAX_IMAGES}).`)
    } else {
      content.images.forEach((img: unknown, i: number) => {
        if (typeof img !== 'object' || img === null || Array.isArray(img)) {
          errors.push(`content.images[${i}] must be an { assetPath, alt, caption? } object.`)
          return
        }
        const image = img as Record<string, unknown>
        if (!isFilledString(image.assetPath, 400)) {
          errors.push(`content.images[${i}].assetPath is required (an object path in the images bucket).`)
        }
        if (!isFilledString(image.alt, 300)) {
          errors.push(`content.images[${i}].alt is required (describe the image for screen readers, max 300 chars).`)
        }
        if (image.caption !== undefined && !isFilledString(image.caption, 80)) {
          errors.push(`content.images[${i}].caption must be a non-empty string (max 80 chars) when present.`)
        }
      })
    }
  }

  // vocab (optional): glossary rows { term, meaning, uz? } from the sample.
  if (content.vocab !== undefined && content.vocab !== null) {
    if (!Array.isArray(content.vocab) || content.vocab.length === 0) {
      errors.push('content.vocab must be a non-empty array when present (omit it if there is no glossary).')
    } else if (content.vocab.length > MAX_ITEMS) {
      errors.push(`content.vocab has too many items (max ${MAX_ITEMS}).`)
    } else {
      content.vocab.forEach((entry: unknown, i: number) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          errors.push(`content.vocab[${i}] must be a { term, meaning, uz? } object.`)
          return
        }
        const v = entry as Record<string, unknown>
        if (!isFilledString(v.term, 120)) errors.push(`content.vocab[${i}].term is required (max 120 chars).`)
        if (!isFilledString(v.meaning, 400)) errors.push(`content.vocab[${i}].meaning is required (max 400 chars).`)
        if (v.uz !== undefined && !isFilledString(v.uz, 200)) {
          errors.push(`content.vocab[${i}].uz must be a non-empty string (max 200 chars) when present.`)
        }
      })
    }
  }

  // model: speaking = dialogue turns, writing = paragraphs
  const model = content.model
  if (!Array.isArray(model) || model.length === 0) {
    errors.push('content.model must be a non-empty array.')
  } else if (model.length > MAX_ITEMS) {
    errors.push(`content.model has too many items (max ${MAX_ITEMS}).`)
  } else if (category === 'speaking') {
    model.forEach((turn, i) => {
      if (typeof turn !== 'object' || turn === null || Array.isArray(turn)) {
        errors.push(`content.model[${i}] must be a {speaker, text} turn.`)
        return
      }
      if (!isFilledString(turn.speaker, 60)) errors.push(`content.model[${i}].speaker is required (max 60 chars).`)
      if (!isFilledString(turn.text)) errors.push(`content.model[${i}].text must be a non-empty string.`)
    })
  } else {
    model.forEach((paragraph, i) => {
      if (!isFilledString(paragraph)) errors.push(`content.model[${i}] must be a non-empty string (a paragraph).`)
    })
  }

  // reject stray top-level keys so typos don't silently vanish
  const allowed = new Set(['task', 'bullets', 'images', 'note', 'model', 'vocab', 'why'])
  for (const key of Object.keys(content)) {
    if (!allowed.has(key)) errors.push(`content.${key} is not a recognised field.`)
  }

  return errors
}
