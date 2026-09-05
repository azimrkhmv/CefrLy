/**
 * WHEN A BLOCK IS ALLOWED TO SCORE ZERO.
 *
 * This module exists because the same bug reached students twice in a row
 * (docs/SPEAKING-DEFECTS.md #24 and #27): a fully answered block scored 0
 * because ONE piece of supporting evidence did not line up. Each time the fix
 * closed the one door it came through, and each time it came back through the
 * next one.
 *
 * So the rule is now the thing being enforced, not the door:
 *
 *   A MARK MAY ONLY BE ZEROED BY CONTRADICTED EVIDENCE, NEVER BY MISSING
 *   EVIDENCE.
 *
 *   · Contradicted: there is no speech on the recording, or the examiner model
 *     states outright that nothing here answered the question.
 *   · Missing: a quote that will not match, a question left off a list, a field
 *     the model forgot. None of these may erase an answer that was spoken.
 *
 * Everything below is a pure function of (transcripts, model judgement) so it
 * can be tested without audio, a model, or a network — see scoring.test.ts.
 */

/** Case and punctuation must not decide a mark. */
export const normalizeSpeech = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export const wordCount = (s: string) => (normalizeSpeech(s).match(/\S+/g) ?? []).length

/** Below this a "transcript" is noise, a false start or a dead mic — never an
 *  answer. Above it there IS speech, whatever the rest of the evidence says. */
export const MIN_ANSWER_WORDS = 10

const QUOTE_NGRAM = 5
const QUOTE_MATCH_RATIO = 0.6

export type QuoteVerdict = 'exact' | 'fuzzy' | 'rejected' | 'duplicate' | 'empty'

/**
 * A QUOTE IS PROOF THE MODEL READ THE SPEECH — IT IS NOT THE ANSWER ITSELF.
 *
 * An exact-substring test alone rejects three things that are not lies: a quote
 * stitched across a gap ("cars pollute … the air gets cleaner"), a quote the
 * model tidied by a word while copying it out, and a quote from a sentence the
 * transcript renders differently ("cuz" vs "'cause"). So the test widens in
 * three steps before it gives up.
 */
export function verifyQuote(rawQuote: string, pool: string): 'exact' | 'fuzzy' | null {
  const quote = normalizeSpeech(rawQuote)
  if (quote.length < 3) return null
  if (pool.includes(quote)) return 'exact'

  // Split the RAW quote: normalising first turns "…" into a space, and the
  // ellipsis branch could then never fire. Caught by scoring.test.ts on the
  // day it was written, which is the entire argument for that file existing.
  const runs = rawQuote
    .split(/(?:…|\.\.\.)/)
    .map(normalizeSpeech)
    .filter((r) => r.length >= 12)
  if (runs.length > 1 && runs.every((r) => pool.includes(r))) return 'fuzzy'

  const words = quote.match(/\S+/g) ?? []
  if (words.length < QUOTE_NGRAM) return null
  let hit = 0
  let total = 0
  for (let i = 0; i + QUOTE_NGRAM <= words.length; i++) {
    total++
    if (pool.includes(words.slice(i, i + QUOTE_NGRAM).join(' '))) hit++
  }
  return total > 0 && hit / total >= QUOTE_MATCH_RATIO ? 'fuzzy' : null
}

export interface OnTopicInput {
  /** Every transcript of this block, in question order. */
  transcripts: string[]
  /** What the model listed as answered, with its proof quote. */
  onTopic: { quote?: string }[]
  /**
   * The model's AFFIRMATIVE claim that nothing in this block answered the
   * question — off topic, or a memorised speech aimed elsewhere. Only `true`
   * zeroes a block. `undefined` is a model that did not say, which is missing
   * evidence and must never cost a student a mark.
   */
  offTopic?: boolean
  /** How many questions the paper has in this block. */
  questionCount: number
}

export interface OnTopicResult {
  onTopicCount: number
  /** Kept for the stored result: the recordings are deleted seconds after a
   *  successful grade, so this is the only trace of why a block counted. */
  quoteAudit: { quote: string; verdict: QuoteVerdict }[]
  verifiedCount: number
  /** Block questions carrying real speech. */
  spoken: number
  /** Why the count came out where it did — logged, and stored for disputes. */
  basis: 'silence' | 'declared_off_topic' | 'quotes' | 'declared' | 'speech_over_silence'
}

export function resolveOnTopic(input: OnTopicInput): OnTopicResult {
  const pool = normalizeSpeech(input.transcripts.join('\n'))
  const spoken = input.transcripts.filter((t) => wordCount(t) >= MIN_ANSWER_WORDS).length

  const seen = new Set<string>()
  const quoteAudit = (input.onTopic ?? []).map((t) => {
    const raw = t?.quote ?? ''
    const key = normalizeSpeech(raw)
    if (key.length < 3) return { quote: raw.slice(0, 160), verdict: 'empty' as QuoteVerdict }
    // One sentence cannot answer three questions.
    if (seen.has(key)) return { quote: raw.slice(0, 160), verdict: 'duplicate' as QuoteVerdict }
    seen.add(key)
    const verdict = verifyQuote(raw, pool)
    return { quote: raw.slice(0, 160), verdict: (verdict ?? 'rejected') as QuoteVerdict }
  })

  const verifiedCount = quoteAudit.filter(
    (q) => q.verdict === 'exact' || q.verdict === 'fuzzy',
  ).length
  // Entries the model actually put forward, whether or not the quote held up.
  const declared = quoteAudit.filter(
    (q) => q.verdict !== 'duplicate' && q.verdict !== 'empty',
  ).length

  const cap = (n: number) => Math.max(0, Math.min(input.questionCount, spoken, n))

  // Contradicted evidence — the only two things allowed to zero a block.
  if (spoken === 0) {
    return { onTopicCount: 0, quoteAudit, verifiedCount, spoken, basis: 'silence' }
  }
  if (input.offTopic === true) {
    return { onTopicCount: 0, quoteAudit, verifiedCount, spoken, basis: 'declared_off_topic' }
  }

  const listed = Math.max(verifiedCount, declared)
  if (listed === 0) {
    // The model listed nothing AND did not declare the block off topic, while
    // the recording plainly has speech on it. That is a contradiction in the
    // model's own output, not an admission by the student — take the speech.
    return {
      onTopicCount: cap(spoken),
      quoteAudit,
      verifiedCount,
      spoken,
      basis: 'speech_over_silence',
    }
  }

  return {
    onTopicCount: cap(listed),
    quoteAudit,
    verifiedCount,
    spoken,
    basis: listed === verifiedCount ? 'quotes' : 'declared',
  }
}
