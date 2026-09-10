import type { Band, WritingTaskType } from './test'

// The graded writing attempt, as stored in `writing_attempts` and rendered by
// the report page.
//
// Unlike Speaking, the thing that was marked is still here: `answers` holds the
// exact text the student typed, and every correction points into it by offset.
// That is what makes the report an annotated script rather than a description
// of one — and what makes a disputed mark re-readable months later.
//
// Mirrors supabase/functions/grade-writing/{rubric,scoring,verify}.ts. Those
// files are the source of truth for the maths; keep this in lockstep.

export const WRITING_CRITERIA = ['task_achievement', 'grammar', 'vocabulary', 'coherence'] as const
export type WritingCriterion = (typeof WRITING_CRITERIA)[number]

export const CRITERION_LABEL: Record<WritingCriterion, string> = {
  task_achievement: 'Task achievement',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  coherence: 'Coherence & cohesion',
}

/** What each criterion is measuring, in the student's own terms. */
export const CRITERION_BLURB: Record<WritingCriterion, string> = {
  task_achievement: 'Did you answer every part of the task, in the right register?',
  grammar: 'Range of structures, and how accurate they are.',
  vocabulary: 'Range and precision of word choice.',
  coherence: 'Order, paragraphing and how ideas are linked.',
}

export type WritingCorrectionType =
  | 'grammar'
  | 'vocabulary'
  | 'spelling'
  | 'punctuation'
  | 'register'
  | 'coherence'

export const CORRECTION_LABEL: Record<WritingCorrectionType, string> = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  spelling: 'Spelling',
  punctuation: 'Punctuation',
  register: 'Formality',
  coherence: 'Linking ideas',
}

export interface WritingCorrection {
  /** Copied from the student's text — the words being corrected. */
  quote: string
  type: WritingCorrectionType
  suggestion: string
  note?: string
  /** Offsets into the student's text. -1 when the quote could not be located,
   *  in which case the fix is listed but not highlighted in place. A quote that
   *  will not match is missing evidence and never changes a mark (verify.ts). */
  start: number
  end: number
}

export type WritingZeroReason = 'blank' | 'too_short' | 'off_topic' | 'plagiarism'

export const ZERO_LABEL: Record<WritingZeroReason, string> = {
  blank: 'Nothing was written for this task.',
  too_short: 'Too short to be marked under the official rules.',
  off_topic: 'This does not answer the task that was set.',
  plagiarism: 'This reads as a memorised or copied text rather than an answer to this prompt.',
}

export interface GradedWritingTask {
  taskId: string
  taskType: WritingTaskType
  taskLabel: string
  /** The official 0-9 band for this task, after length caps and zero rules. */
  band: number
  criteria: Record<WritingCriterion, number>
  /** Criteria the model omitted, filled from the mean of the rest. A non-empty
   *  list means the judgement was thin. */
  inferredCriteria: WritingCriterion[]
  points: number
  weight: number
  wordCount: number
  targetWords: number
  /** What the criteria alone gave, before length capped it. */
  bandBeforeCap: number
  underlengthCapped: boolean
  zeroMark: WritingZeroReason | null
  evidence: string
  comment: string
  contentPoints: { point: string; covered: boolean }[]
  strengths: { quote: string; why: string }[]
  corrections: WritingCorrection[]
  /** The student's own answer rewritten about one band higher. */
  improved: string
}

export interface WritingResult {
  tasks: GradedWritingTask[]
  /** Σ points, out of `maxRaw` (always 36 — the full paper's denominator). */
  raw36: number
  maxRaw: number
  rating: number
  band: Band
  /** True for a single-task drill: the /75 is an extrapolation, not a mark. */
  estimate: boolean
  summary: string
  fixFirst: string
  /** Which model marked it, kept so a re-grade can be compared. */
  model?: string
  /** Both examiners' raw readings, stored for a disputed mark. */
  review?: unknown
}

/** One task's answer, exactly as submitted. */
export interface WritingAnswerRow {
  taskId: string
  taskType: WritingTaskType
  taskLabel: string
  text: string
  targetWords?: number
  promptTitle?: string
  promptText?: string
}

export interface WritingAttemptRow {
  id: string
  test_id: string
  test_title: string
  scope: 'full' | 'part'
  task_type: WritingTaskType | null
  status: 'grading' | 'done' | 'failed'
  error_message: string | null
  /** The raw /36. */
  raw_score: number | null
  /** The final /75. */
  rating: number | null
  /** NULL for single-task drills — an extrapolation from one task is not a band. */
  band: Band | null
  answers: WritingAnswerRow[]
  result: WritingResult | null
  created_at: string
  graded_at: string | null
}

/**
 * An attempt as the LIST views need it — without `result` or `answers`.
 *
 * The full row carries every essay, correction and rewrite of an attempt. My
 * results and the Writing catalog show a score and a date, so they ask for this
 * shape and leave the heavy columns in the database (the same fix as
 * fetchMyAttempts and fetchSpeakingAttempts).
 */
export type WritingAttemptSummary = Omit<WritingAttemptRow, 'result' | 'answers'>
