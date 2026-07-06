import type { AudioAsset, Band, CefrLevel, Explanation, ItemType, ListeningPart, Skill } from './test'

/** Row shape returned when listing published tests (metadata only, never content). */
export interface TestCatalogEntry {
  id: string
  title: string
  skill: string
  target_levels: CefrLevel[]
  duration_sec: number
}

/** Per-item grading result, built server-side by the submit-test edge function. */
export interface ItemResult {
  id: string
  partNumber: number
  type: ItemType
  prompt?: string
  correct: boolean
  /** Raw value the user submitted (option key / typed word / tfng value), or null. */
  userAnswer: string | null
  /** Human-readable version of the user's answer. */
  userAnswerLabel: string | null
  /** Human-readable correct answer. */
  correctAnswerLabel: string
  explanation: Explanation
}

/** What the submit-test function stores in attempts.result. */
export interface StoredAttemptResult {
  testId: string
  testTitle: string
  /** Absent on attempts stored before Phase 3; treat missing as 'reading'. */
  skill?: Skill
  rawScore: number
  total: number
  band: Band
  submittedAt: string
  items: ItemResult[]
}

export interface AttemptResult extends StoredAttemptResult {
  attemptId: string
}

/** The post-submit study payload from the review-attempt edge function: the
 *  FULL test content (answer keys + transcripts — safe only AFTER submission,
 *  and only for the attempt's owner) alongside the student's graded answers. */
export interface AttemptReview {
  attemptId: string
  testId: string
  testTitle: string
  skill: Skill
  submittedAt: string | null
  rawScore: number
  total: number
  band: Band
  audioMode: 'per_part' | 'single' | null
  singleAudio: AudioAsset | null
  /** Full parts including per-item answers and server-side transcripts. */
  parts: ListeningPart[]
  items: ItemResult[]
}

/** One row on the "My results" dashboard. */
export interface AttemptSummary {
  id: string
  testId: string | null
  testTitle: string
  /** Reading or Listening. Legacy rows (pre-Phase 3) default to 'reading'. */
  skill: Skill
  rawScore: number
  total: number
  band: Band
  createdAt: string
}
