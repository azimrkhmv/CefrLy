// Client-side mirror of supabase/functions/admin-tests/validate-listening.ts —
// live feedback in the listening admin form. The SERVER is the source of truth;
// keep the two in sync.

/* eslint-disable @typescript-eslint/no-explicit-any */

const EXPECTED_LAYOUTS = [
  'mcq_response',
  'form_completion',
  'matching',
  'map_labelling',
  'multi_extract_mcq',
  'note_completion',
]
const EXPECTED_COUNTS = [8, 6, 4, 5, 6, 6]
const GAP_MARKER_RE = /\{\{\s*([\w-]+)\s*\}\}/g

function itemsOf(part: any): any[] {
  if (Array.isArray(part?.groups) && part.groups.length > 0)
    return part.groups.flatMap((g: any) => g?.items ?? [])
  return part?.items ?? []
}

export function validateListeningTestContent(content: any): string[] {
  const errors: string[] = []
  const err = (m: string) => errors.push(m)

  if (!content || typeof content !== 'object') return ['Test content must be an object.']
  if (content.skill !== 'listening') err("skill must be 'listening'.")
  if (typeof content.title !== 'string' || !content.title.trim()) err('Test title is required.')
  if (typeof content.durationSec !== 'number' || content.durationSec < 60 || content.durationSec > 14400) {
    err('Duration must be between 60 and 14400 seconds.')
  }
  if (!Array.isArray(content.targetLevels) || content.targetLevels.length === 0) {
    err('targetLevels must be a non-empty array.')
  }
  if (content.audioMode !== 'per_part' && content.audioMode !== 'single') {
    err("audioMode must be 'per_part' or 'single'.")
  }

  const checkAudio = (a: any, where: string) => {
    if (!a || typeof a.assetPath !== 'string' || !a.assetPath.trim()) {
      err(`${where}: an audio file is required (upload one).`)
      return
    }
    if (typeof a.playLimit !== 'number' || a.playLimit < 1) err(`${where}: play limit must be at least 1.`)
    if (typeof a.previewSec !== 'number' || a.previewSec < 0) err(`${where}: preview seconds must be 0 or more.`)
  }
  if (content.audioMode === 'single') checkAudio(content.singleAudio, 'Section audio')

  if (!Array.isArray(content.parts) || content.parts.length !== 6) {
    err(`Test must have exactly 6 parts (got ${content.parts?.length ?? 0}).`)
    return errors
  }

  const seenIds = new Set<string>()
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
    if (content.audioMode === 'per_part') checkAudio(part.audio, label)

    const items = itemsOf(part)
    totalItems += items.length
    if (items.length !== EXPECTED_COUNTS[index]) {
      err(`${label}: must have exactly ${EXPECTED_COUNTS[index]} questions (got ${items.length}).`)
    }

    if (part.layout === 'form_completion' || part.layout === 'note_completion') {
      if (typeof part.stem?.html !== 'string' || !part.stem.html.trim()) {
        err(`${label}: the notes/form text is required.`)
      }
    }
    const markerIds = new Set<string>()
    if (part.stem?.html) {
      for (const m of String(part.stem.html).matchAll(GAP_MARKER_RE)) markerIds.add(m[1])
    }

    if (part.layout === 'matching' || part.layout === 'map_labelling') {
      const pool = part.optionPool
      if (!Array.isArray(pool) || pool.length === 0) {
        err(`${label}: an option pool is required.`)
      } else {
        if (pool.length <= items.length) {
          err(`${label}: the option pool needs MORE options than questions (extras). Got ${pool.length} for ${items.length} questions.`)
        }
        pool.forEach((o: any, i: number) => {
          if (typeof o?.key !== 'string' || !o.key.trim() || typeof o?.label !== 'string' || !o.label.trim()) {
            err(`${label}: option ${i + 1} needs both a key and a label.`)
          }
        })
      }
    }
    if (part.layout === 'map_labelling') {
      if (typeof part.image?.assetPath !== 'string' || !part.image.assetPath.trim()) {
        err(`${label}: a map/plan image is required (upload one).`)
      }
    }
    if (part.layout === 'multi_extract_mcq') {
      if (!Array.isArray(part.groups) || part.groups.length !== 3) {
        err(`${label}: must have exactly 3 extracts (groups).`)
      } else {
        part.groups.forEach((g: any, gi: number) => {
          if (typeof g?.context !== 'string' || !g.context.trim()) {
            err(`${label}, extract ${gi + 1}: a context line is required.`)
          }
          if (!Array.isArray(g?.items) || g.items.length !== 2) {
            err(`${label}, extract ${gi + 1}: must have exactly 2 questions.`)
          }
        })
      }
    }

    const poolKeys = new Set((part.optionPool ?? []).map((o: any) => o?.key))

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
      if (seenIds.has(item.id)) err(`${qLabel}: duplicate question id '${item.id}'.`)
      seenIds.add(item.id)

      switch (item.type) {
        case 'gap': {
          const answers = Array.isArray(item.answer)
            ? item.answer.filter((a: any) => typeof a === 'string' && a.trim())
            : []
          if (answers.length === 0) err(`${qLabel}: gap needs at least one accepted answer.`)
          if ((part.layout === 'form_completion' || part.layout === 'note_completion') && !markerIds.has(item.id)) {
            err(`${qLabel}: no {{${item.id}}} marker found in the notes text.`)
          }
          break
        }
        case 'match': {
          if (typeof item.prompt !== 'string' || !item.prompt.trim()) err(`${qLabel}: a prompt (speaker or place) is required.`)
          if (!poolKeys.has(item.answer)) err(`${qLabel}: answer '${item.answer}' is not in the option pool.`)
          break
        }
        case 'mcq': {
          if (part.layout !== 'mcq_response' && (typeof item.prompt !== 'string' || !item.prompt.trim())) {
            err(`${qLabel}: a question prompt is required.`)
          }
          const optKeys = new Set((item.options ?? []).map((o: any) => o?.key))
          if (!Array.isArray(item.options) || item.options.length < 2) {
            err(`${qLabel}: mcq needs at least 2 options.`)
          } else {
            item.options.forEach((o: any, oi: number) => {
              if (typeof o?.key !== 'string' || !o.key.trim() || typeof o?.label !== 'string' || !o.label.trim()) {
                err(`${qLabel}: option ${oi + 1} needs a key and a label.`)
              }
            })
          }
          if (!optKeys.has(item.answer)) err(`${qLabel}: answer '${item.answer}' is not one of its options.`)
          break
        }
        default:
          err(`${qLabel}: type '${item.type}' is not allowed in listening (use gap, match or mcq).`)
      }

      const ex = item.explanation
      if (
        !ex ||
        typeof ex.location !== 'string' || !ex.location.trim() ||
        typeof ex.quote !== 'string' || !ex.quote.trim() ||
        typeof ex.reasoning !== 'string' || !ex.reasoning.trim()
      ) {
        err(`${qLabel}: explanation needs location, quote and reasoning.`)
      }
    })
  })

  if (totalItems !== 35) err(`Test must have exactly 35 questions in total (got ${totalItems}).`)

  return errors
}
