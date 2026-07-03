// Client-side mirror of the server validation in
// supabase/functions/admin-tests/validate.ts — used for live feedback in the
// admin form. The SERVER remains the source of truth; keep the rules in sync.

/* eslint-disable @typescript-eslint/no-explicit-any */

const EXPECTED_LAYOUTS = [
  'cloze_from_text',
  'match_texts',
  'match_headings',
  'passage_questions',
  'passage_questions',
]
const EXPECTED_ITEM_COUNTS = [6, 8, 6, 9, 6]
const ALLOWED_TYPES_PER_PART: string[][] = [
  ['gap'],
  ['match'],
  ['match'],
  ['mcq', 'tfng'],
  ['gap', 'mcq'],
]
const GAP_MARKER_RE = /\{\{\s*([\w-]+)\s*\}\}/g

export function validateReadingTestContent(content: any): string[] {
  const errors: string[] = []
  const err = (msg: string) => errors.push(msg)

  if (!content || typeof content !== 'object') return ['Test content must be an object.']
  if (content.skill !== 'reading') err("skill must be 'reading'.")
  if (typeof content.title !== 'string' || !content.title.trim()) err('Test title is required.')
  if (
    typeof content.durationSec !== 'number' ||
    content.durationSec < 60 ||
    content.durationSec > 14400
  ) {
    err('Duration must be between 60 and 14400 seconds.')
  }
  if (!Array.isArray(content.targetLevels) || content.targetLevels.length === 0) {
    err('targetLevels must be a non-empty array.')
  }

  if (!Array.isArray(content.parts) || content.parts.length !== 5) {
    err(`Test must have exactly 5 parts (got ${content.parts?.length ?? 0}).`)
    return errors
  }

  const seenItemIds = new Set<string>()
  let totalItems = 0

  content.parts.forEach((part: any, index: number) => {
    const partNo = index + 1
    const label = `Part ${partNo}`

    if (part.number !== partNo) err(`${label}: number must be ${partNo} (got ${part.number}).`)
    if (part.layout !== EXPECTED_LAYOUTS[index]) {
      err(`${label}: layout must be '${EXPECTED_LAYOUTS[index]}' (got '${part.layout}').`)
    }
    if (typeof part.instructions !== 'string' || !part.instructions.trim()) {
      err(`${label}: instructions are required.`)
    }

    const items = Array.isArray(part.items) ? part.items : []
    totalItems += items.length
    if (items.length !== EXPECTED_ITEM_COUNTS[index]) {
      err(`${label}: must have exactly ${EXPECTED_ITEM_COUNTS[index]} questions (got ${items.length}).`)
    }

    if (partNo === 1 || partNo === 4 || partNo === 5) {
      if (typeof part.passage?.html !== 'string' || !part.passage.html.trim()) {
        err(`${label}: passage text is required.`)
      }
    }
    if (partNo === 2) {
      if (!Array.isArray(part.optionPool) || part.optionPool.length !== 10) {
        err(`${label}: needs exactly 10 statements A–J (got ${part.optionPool?.length ?? 0}).`)
      }
    }
    if (partNo === 3) {
      const poolLen = part.optionPool?.length ?? 0
      if (!Array.isArray(part.optionPool) || poolLen < 8 || poolLen > 9) {
        err(`${label}: needs 8 or 9 headings (got ${poolLen}).`)
      }
      if (!Array.isArray(part.passage?.paragraphs) || part.passage.paragraphs.length !== 6) {
        err(`${label}: needs exactly 6 paragraphs (got ${part.passage?.paragraphs?.length ?? 0}).`)
      } else {
        part.passage.paragraphs.forEach((p: any, i: number) => {
          if (typeof p?.html !== 'string' || !p.html.trim())
            err(`${label}: paragraph ${i + 1} text is empty.`)
          if (typeof p?.label !== 'string' || !p.label.trim())
            err(`${label}: paragraph ${i + 1} label is empty.`)
        })
      }
    }

    const poolKeys = new Set((part.optionPool ?? []).map((o: any) => o?.key))
    if (Array.isArray(part.optionPool)) {
      part.optionPool.forEach((o: any, i: number) => {
        if (
          typeof o?.key !== 'string' ||
          !o.key.trim() ||
          typeof o?.label !== 'string' ||
          !o.label.trim()
        ) {
          err(`${label}: option ${i + 1} in the option pool needs both a key and a label.`)
        }
      })
    }

    const htmlSources = [
      part.passage?.html ?? '',
      ...((part.passage?.paragraphs ?? []).map((p: any) => p?.html ?? '') as string[]),
    ]
    const markerIds = new Set<string>()
    for (const html of htmlSources) {
      for (const m of String(html).matchAll(GAP_MARKER_RE)) markerIds.add(m[1])
    }
    for (const markerId of markerIds) {
      const item = items.find((i: any) => i?.id === markerId)
      if (!item) err(`${label}: gap marker {{${markerId}}} has no matching question.`)
      else if (item.type !== 'gap') err(`${label}: marker {{${markerId}}} points at a non-gap question.`)
    }

    items.forEach((item: any, i: number) => {
      const qLabel = `${label}, question ${i + 1}`
      if (typeof item?.id !== 'string' || !item.id.trim()) {
        err(`${qLabel}: missing id.`)
        return
      }
      if (seenItemIds.has(item.id)) err(`${qLabel}: duplicate question id '${item.id}'.`)
      seenItemIds.add(item.id)

      if (!ALLOWED_TYPES_PER_PART[index].includes(item.type)) {
        err(
          `${qLabel}: type '${item.type}' is not allowed in ${label} (allowed: ${ALLOWED_TYPES_PER_PART[index].join(', ')}).`,
        )
      }

      switch (item.type) {
        case 'gap': {
          const answers = Array.isArray(item.answer)
            ? item.answer.filter((a: any) => typeof a === 'string' && a.trim())
            : []
          if (answers.length === 0) err(`${qLabel}: gap needs at least one accepted answer.`)
          if ((partNo === 1 || partNo === 5) && !markerIds.has(item.id)) {
            err(`${qLabel}: no {{${item.id}}} marker found in the passage text.`)
          }
          break
        }
        case 'match': {
          if (typeof item.prompt !== 'string' || !item.prompt.trim()) err(`${qLabel}: prompt is required.`)
          if (!poolKeys.has(item.answer)) err(`${qLabel}: answer '${item.answer}' is not in the option pool.`)
          break
        }
        case 'mcq': {
          if (typeof item.prompt !== 'string' || !item.prompt.trim()) err(`${qLabel}: prompt is required.`)
          const optKeys = new Set((item.options ?? []).map((o: any) => o?.key))
          if (!Array.isArray(item.options) || item.options.length < 2) {
            err(`${qLabel}: mcq needs at least 2 options.`)
          } else {
            item.options.forEach((o: any, oi: number) => {
              if (
                typeof o?.key !== 'string' ||
                !o.key.trim() ||
                typeof o?.label !== 'string' ||
                !o.label.trim()
              ) {
                err(`${qLabel}: option ${oi + 1} needs a key and a label.`)
              }
            })
          }
          if (!optKeys.has(item.answer)) err(`${qLabel}: answer '${item.answer}' is not one of its options.`)
          break
        }
        case 'tfng': {
          if (typeof item.prompt !== 'string' || !item.prompt.trim()) err(`${qLabel}: prompt is required.`)
          if (!['true', 'false', 'not_given'].includes(item.answer)) {
            err(`${qLabel}: tfng answer must be true, false or not_given.`)
          }
          if (!['Not Given', 'No Information'].includes(item.thirdOptionLabel)) {
            err(`${qLabel}: thirdOptionLabel must be 'Not Given' or 'No Information'.`)
          }
          break
        }
        default:
          err(`${qLabel}: unknown type '${item.type}'.`)
      }

      const ex = item.explanation
      if (
        !ex ||
        typeof ex.location !== 'string' ||
        !ex.location.trim() ||
        typeof ex.quote !== 'string' ||
        !ex.quote.trim() ||
        typeof ex.reasoning !== 'string' ||
        !ex.reasoning.trim()
      ) {
        err(`${qLabel}: explanation needs location, quote and reasoning.`)
      }
    })
  })

  if (totalItems !== 35) err(`Test must have exactly 35 questions in total (got ${totalItems}).`)

  return errors
}
