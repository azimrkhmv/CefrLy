import type { Band } from './test'

// The graded speaking attempt, as stored in `speaking_attempts` and rendered by
// the analyze page. The audio behind it no longer exists — the transcript is
// the record of what the student said.

export type SpeakingErrorType = 'grammar' | 'vocabulary' | 'word_order' | 'register' | 'coherence'

export interface SpeakingError {
  /** An exact substring of `transcript`, so it can be highlighted in place. */
  quote: string
  type: SpeakingErrorType
  fix: string
}

export interface SpeakingStrength {
  quote: string
  why: string
}

export interface GradedAnswer {
  questionIndex: number
  questionText: string
  durationSec: number
  transcript: string
  wordsPerMinute: number
  fillerCount: number
  pronunciation: string
  fluency: string
  errors: SpeakingError[]
  strengths: SpeakingStrength[]
  /** The student's own answer rewritten about one CEFR level higher. */
  improved: string
}

export type CefrCriterionLevel = 'below_A2' | 'A2' | 'B1' | 'B2' | 'C1'

export interface GradedBlock {
  key: 'q1_3' | 'q4_6' | 'q7' | 'q8'
  label: string
  max: number
  score: number
  reason: string
  /** The levels the mark was CALCULATED from. The AI judges these; the score is
   *  arithmetic on top of them, so this is the working behind the number.
   *  Absent on attempts graded before that change. */
  criteria?: Record<'grammar' | 'vocabulary' | 'pronunciation' | 'fluency' | 'coherence', CefrCriterionLevel>
  /** How many of the block's questions were answered on topic, out of how many. */
  onTopicCount?: number
  questionCount?: number
}

export interface SpeakingResult {
  blocks: GradedBlock[]
  answers: GradedAnswer[]
  summary: string
  fixFirst: string
  /** The paper's full raw total (21 for a mock). Older attempts lack it. */
  maxRaw?: number
  /** DRILLS ONLY. One part cannot demonstrate the whole scale — Part 1.1 is
   *  anchored at A2, so however well it goes it proves the student is past A2
   *  and nothing more. The estimate is clamped to `capRating` (`capBand` is the
   *  band that lands in), and `cappedByPart` says the clamp actually bit. */
  capRating?: number | null
  capBand?: Band
  cappedByPart?: boolean
  /** Which Gemini model graded it — kept so a re-grade can be compared. */
  model?: string
}

export interface SpeakingAttemptRow {
  id: string
  test_id: string
  test_title: string
  scope: 'full' | 'part'
  part_type: string | null
  status: 'grading' | 'done' | 'failed'
  error_message: string | null
  raw_score: number | null
  rating: number | null
  /** NULL for single-part drills — an estimate from one block is not a band. */
  band: Band | null
  result: SpeakingResult | null
  /** Present only while an attempt is ungraded: which clip answers which
   *  question, so a failed check can be retried without the exam tab. */
  audio_manifest?: { questionIndex: number; path: string }[] | null
  created_at: string
  graded_at: string | null
}

/**
 * An attempt as the LIST views need it — everything except `result`.
 *
 * The full row carries every transcript, correction and rewritten answer of an
 * attempt. My results and the Speaking catalog render a score and a date, so
 * they ask for this shape instead and leave the heavy column in the database.
 */
export type SpeakingAttemptSummary = Omit<SpeakingAttemptRow, 'result' | 'audio_manifest'>

export const ERROR_LABEL: Record<SpeakingErrorType, string> = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  word_order: 'Word order',
  register: 'Formality',
  coherence: 'Linking ideas',
}
