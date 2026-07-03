// Item schema v2 — see project context. The FULL types (with `answer` / `explanation`)
// exist server-side only; the browser must only ever receive the Sanitized* shapes
// before a test is submitted.

export type CefrLevel = 'B1' | 'B2' | 'C1'
export type Band = 'C1' | 'B2' | 'B1' | 'below_B1'

export type PartLayout =
  | 'cloze_from_text'
  | 'match_texts'
  | 'match_headings'
  | 'passage_questions'

export type ItemType = 'gap' | 'match' | 'mcq' | 'tfng'
export type PartNumber = 1 | 2 | 3 | 4 | 5

export interface Explanation {
  location: string
  quote: string
  reasoning: string
}

export interface OptionRef {
  key: string
  label: string
}

export interface Passage {
  title?: string
  /** May contain {{itemId}} gap markers. */
  html?: string
  paragraphs?: { label: string; html: string }[]
}

// ---------------------------------------------------------------------------
// Full item shapes (server-side only pre-submit)
// ---------------------------------------------------------------------------

export interface GapItem {
  id: string
  type: 'gap'
  points: 1
  answer: string[]
  caseSensitive?: false
  explanation: Explanation
}

export interface MatchItem {
  id: string
  type: 'match'
  points: 1
  prompt: string
  /** An optionPool key. */
  answer: string
  explanation: Explanation
}

export interface McqItem {
  id: string
  type: 'mcq'
  points: 1
  prompt: string
  options: OptionRef[]
  answer: string
  explanation: Explanation
}

export interface TfngItem {
  id: string
  type: 'tfng'
  points: 1
  prompt: string
  thirdOptionLabel: 'Not Given' | 'No Information'
  answer: 'true' | 'false' | 'not_given'
  explanation: Explanation
}

export type Item = GapItem | MatchItem | McqItem | TfngItem

export interface Part {
  id: string
  number: PartNumber
  layout: PartLayout
  instructions: string
  passage?: Passage
  /** Parts 2 & 3: shared options. */
  optionPool?: OptionRef[]
  /** Ordered; render in this exact order. */
  items: Item[]
}

export interface ReadingTest {
  id: string
  skill: 'reading'
  title: string
  targetLevels: CefrLevel[]
  durationSec: number
  parts: Part[]
}

// ---------------------------------------------------------------------------
// Sanitized shapes — what the get-test edge function returns to the browser.
// `answer` and `explanation` are stripped from every item.
// ---------------------------------------------------------------------------

export type SanitizedGapItem = Omit<GapItem, 'answer' | 'explanation'>
export type SanitizedMatchItem = Omit<MatchItem, 'answer' | 'explanation'>
export type SanitizedMcqItem = Omit<McqItem, 'answer' | 'explanation'>
export type SanitizedTfngItem = Omit<TfngItem, 'answer' | 'explanation'>

export type SanitizedItem =
  | SanitizedGapItem
  | SanitizedMatchItem
  | SanitizedMcqItem
  | SanitizedTfngItem

export interface SanitizedPart extends Omit<Part, 'items'> {
  items: SanitizedItem[]
}

/** Server-side attempt timing, created/reused by the get-test edge function. */
export interface TestSession {
  id: string
  startedAt: string
  expiresAt: string
}

export interface SanitizedReadingTest extends Omit<ReadingTest, 'parts'> {
  parts: SanitizedPart[]
  session: TestSession
}
