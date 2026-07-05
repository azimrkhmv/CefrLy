import type { Band, CefrLevel, Explanation, ItemType, Skill } from './test'

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

/** One row on the "My results" dashboard. */
export interface AttemptSummary {
  id: string
  testId: string | null
  testTitle: string
  rawScore: number
  total: number
  band: Band
  createdAt: string
}
