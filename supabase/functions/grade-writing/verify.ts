/**
 * WHEN A WRITING TASK IS ALLOWED TO SCORE ZERO, AND WHICH CORRECTIONS ARE REAL.
 *
 * Speaking learned this rule three times over (docs/SPEAKING-DEFECTS.md #24,
 * #27, #28): a fully answered task scored 0 because one piece of supporting
 * evidence did not line up, and each fix closed only the door that bug walked
 * through. So the rule is the thing enforced here, not the door:
 *
 *   A MARK MAY ONLY BE ZEROED BY CONTRADICTED EVIDENCE, NEVER BY MISSING
 *   EVIDENCE.
 *
 *   · Contradicted: the page is blank, the answer is under the official
 *     zero-mark word floor, or the model states OUTRIGHT that this response
 *     does not address the task (`offTopic: true`) or is memorised
 *     (`memorised: true`). Those two are REQUIRED fields for exactly this
 *     reason — a model that forgot to answer must not read as an accusation.
 *   · Missing: a correction quote that will not match, a criterion the model
 *     left out, a field that came back null. None of these may erase work a
 *     student actually did.
 *
 * Writing has one advantage Speaking never had: the text is not a transcript
 * somebody's ears produced, it is the exact string the student typed. So a
 * quote either appears in it or it does not, and an inline correction that
 * cannot be located is simply not shown in place — it never changes a mark.
 *
 * Everything here is a pure function of (text, model output), so it tests
 * without a model or a network — see scoring.test.ts.
 */

/** Case, punctuation and whitespace must not decide whether a quote matched. */
export const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** The word count the rubric's length rules are applied to. Deliberately the
 *  same naive whitespace split the exam screen shows the student while they
 *  write — a mark must never rest on a number they were never shown. */
export function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/**
 * Locate a quote inside the student's own text.
 *
 * Exact first. Then a normalised search, mapping the hit back to real offsets,
 * which is what catches a quote the model tidied by a space or a curly
 * apostrophe while copying it out. Nothing fuzzier than that: an inline
 * correction points at specific words, and highlighting approximately the right
 * ones is worse than not highlighting at all.
 */
export function locateQuote(quote: string, text: string): { start: number; end: number } | null {
  const raw = quote.trim()
  if (raw.length < 2) return null

  const exact = text.indexOf(raw)
  if (exact !== -1) return { start: exact, end: exact + raw.length }

  // Normalised search. Build an index from each character of the normalised
  // string back to its position in the original, so a hit maps to real offsets.
  const map: number[] = []
  let normText = ''
  let pendingSpace = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/[\p{L}\p{N}]/u.test(ch)) {
      if (pendingSpace && normText.length > 0) {
        normText += ' '
        map.push(i)
      }
      pendingSpace = false
      normText += ch.toLowerCase()
      map.push(i)
    } else {
      pendingSpace = true
    }
  }

  const needle = normalize(raw)
  if (needle.length < 2) return null
  const at = normText.indexOf(needle)
  if (at === -1) return null

  const start = map[at]
  const lastCharIndex = map[at + needle.length - 1]
  return { start, end: lastCharIndex + 1 }
}

/** Equal once runs of whitespace are collapsed — case and punctuation intact. */
const sameIgnoringSpacing = (a: string, b: string) =>
  a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim()

export type CorrectionType = 'grammar' | 'vocabulary' | 'spelling' | 'punctuation' | 'register' | 'coherence'

const CORRECTION_TYPES: CorrectionType[] = [
  'grammar',
  'vocabulary',
  'spelling',
  'punctuation',
  'register',
  'coherence',
]

export interface RawCorrection {
  quote?: string
  type?: string
  suggestion?: string
  note?: string
}

export interface Correction {
  quote: string
  type: CorrectionType
  suggestion: string
  note?: string
  /** Offsets into the student's text, or -1 when the quote could not be found.
   *  An unlocated correction is still shown in the list — it is feedback the
   *  student can read — it just cannot be highlighted in place. */
  start: number
  end: number
}

/**
 * Turn the model's corrections into ones the report can render.
 *
 * Overlapping marks are dropped rather than nested: two highlights over the
 * same words render as one unreadable smear, and the second is nearly always
 * the same fault said twice.
 */
export function resolveCorrections(raw: RawCorrection[] | undefined, text: string): Correction[] {
  const out: Correction[] = []
  const taken: [number, number][] = []
  const seen = new Set<string>()

  for (const c of raw ?? []) {
    const quote = (c?.quote ?? '').trim()
    const suggestion = (c?.suggestion ?? '').trim()
    if (!quote || !suggestion) continue

    const key = `${normalize(quote)}→${normalize(suggestion)}`
    if (seen.has(key)) continue
    seen.add(key)

    // A "correction" that changes nothing is noise the student has to read past.
    // Compared with CASE KEPT: `normalize` lowercases, so comparing through it
    // threw away every capitalisation fix — "many english books" → "many
    // English books" is a real spelling correction, and it was being discarded
    // as a no-op. Whitespace is still collapsed, since a quote respaced while
    // being copied out is not a correction.
    if (sameIgnoringSpacing(quote, suggestion)) continue

    const type = (CORRECTION_TYPES as string[]).includes(c?.type ?? '')
      ? (c!.type as CorrectionType)
      : 'grammar'
    const at = locateQuote(quote, text)

    if (at && taken.some(([s, e]) => at.start < e && s < at.end)) continue
    if (at) taken.push([at.start, at.end])

    out.push({
      quote,
      type,
      suggestion,
      note: c?.note?.trim() || undefined,
      start: at?.start ?? -1,
      end: at?.end ?? -1,
    })
  }

  return out.sort((a, b) => a.start - b.start)
}

export interface ZeroInput {
  text: string
  zeroMarkMinWords: number
  /** The model's AFFIRMATIVE claim that this response does not address the task.
   *  Only `true` zeroes it. `undefined` is a model that did not say, which is
   *  missing evidence and must never cost a student their work. */
  offTopic?: boolean
  /** Likewise for a memorised or copied response. */
  memorised?: boolean
}

export type ZeroReason = 'blank' | 'too_short' | 'off_topic' | 'plagiarism'

/** The only four ways a task may be zeroed. Returns null when it may not be. */
export function zeroReasonFor(input: ZeroInput): ZeroReason | null {
  const words = wordCount(input.text)
  if (words === 0) return 'blank'
  if (words < input.zeroMarkMinWords) return 'too_short'
  if (input.offTopic === true) return 'off_topic'
  if (input.memorised === true) return 'plagiarism'
  return null
}

/**
 * The four criteria, made safe to compute with.
 *
 * A criterion the model omitted is MISSING evidence, so it may not drag the
 * mark down: it falls back to the mean of the criteria that did come back, and
 * the caller is told which ones were filled in so a thin judgement can be
 * flagged rather than quietly trusted. Only when the model returned nothing at
 * all does this refuse to guess.
 */
export function resolveCriteria<K extends string>(
  keys: readonly K[],
  raw: Partial<Record<K, unknown>> | undefined,
): { criteria: Record<K, number> | null; filledIn: K[] } {
  const source: Partial<Record<K, unknown>> = raw ?? {}
  const present: Partial<Record<K, number>> = {}
  for (const k of keys) {
    const v = Number(source[k])
    if (Number.isFinite(v) && v >= 0 && v <= 9) present[k] = Math.round(v)
  }

  const found = keys.filter((k) => present[k] !== undefined)
  if (found.length === 0) return { criteria: null, filledIn: [] }

  const mean = found.reduce((n, k) => n + present[k]!, 0) / found.length
  const criteria = {} as Record<K, number>
  const filledIn: K[] = []
  for (const k of keys) {
    if (present[k] === undefined) {
      criteria[k] = Math.round(mean)
      filledIn.push(k)
    } else {
      criteria[k] = present[k]!
    }
  }
  return { criteria, filledIn }
}
