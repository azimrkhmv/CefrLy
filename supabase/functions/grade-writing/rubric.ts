// The official Multilevel WRITING rubric, as arithmetic.
//
// Two source documents define this (see writing.md §4):
//   · "Writing criteria multilevel.pdf"                  — the 0-9 band descriptors
//   · "Chet tili (multilevel) baholash mezonlari - yangi" — weights + the /36→/75 table
//
// RUBRIC_TEXT at the foot of this file is now TRANSCRIBED FROM THE DESCRIPTOR
// PDF (2026-09-10), replacing the reconstruction written before that file was
// available. The MATHS was checked against the second PDF the same day, row by
// row: all 66 entries of the conversion table, the 12/24 weights, the word
// floors and both underlength ladders match exactly. scoring.test.ts pins them.

export type WritingTaskType = 'task_1_1' | 'task_1_2' | 'part_2'

/** Which official descriptor set a task is judged against. Cefrly's Task 1.1 and
 *  Task 1.2 are both letters/emails and share the official "Task 1" rubric; the
 *  essay uses "Task 2". */
export type RubricFamily = 'task_1' | 'task_2'

export const TASKS: Record<
  WritingTaskType,
  {
    label: string
    family: RubricFamily
    /** Share of the 36 raw points. 4 + 8 fills the official 12-point Task 1
     *  bucket; the essay is the official 24-point Task 2 bucket. */
    weight: number
    /** Below this the whole task is 0, whatever is on the page. Official. */
    zeroMarkMinWords: number
    /** Fallback word target when the paper does not state one. */
    defaultTargetWords: number
  }
> = {
  task_1_1: {
    label: 'Task 1.1',
    family: 'task_1',
    weight: 4,
    zeroMarkMinWords: 20,
    defaultTargetWords: 50,
  },
  task_1_2: {
    label: 'Task 1.2',
    family: 'task_1',
    weight: 8,
    zeroMarkMinWords: 20,
    defaultTargetWords: 150,
  },
  part_2: {
    label: 'Task 2',
    family: 'task_2',
    weight: 24,
    zeroMarkMinWords: 40,
    defaultTargetWords: 250,
  },
}

/** 4 + 8 + 24. The denominator of the raw score, whatever the paper contains. */
export const MAX_RAW = 36
/** The exam's ceiling. Nothing above it exists on this paper. */
export const MAX_RATING = 75

export const CRITERIA = ['task_achievement', 'grammar', 'vocabulary', 'coherence'] as const
export type Criterion = (typeof CRITERIA)[number]

export const CRITERION_LABEL: Record<Criterion, string> = {
  task_achievement: 'Task achievement',
  grammar: 'Grammar range and accuracy',
  vocabulary: 'Vocabulary range and appropriacy',
  coherence: 'Coherence and cohesion',
}

/** The band scale's CEFR anchors: 9 = C1, 7 = B2, 5 = B1. The even bands mean
 *  "shares features of the bands above and below". */
export const BAND_ANCHOR: Record<number, string> = {
  9: 'C1',
  7: 'B2',
  5: 'B1',
  3: 'below B1',
}

// ---------------------------------------------------------------------------
// SCORING IS OURS, JUDGEMENT IS THE MODEL'S.
//
// The same rule Speaking arrived at the hard way (see grade-speaking/rubric.ts).
// The model never returns a task band. It returns the four official criteria,
// each 0-9, with quotes behind them; the task band is computed here. That makes
// a mark auditable — a student can be shown which criterion cost them the point
// — and makes it impossible for a task to take band 8 while the grammar
// underneath it says 4.
// ---------------------------------------------------------------------------

/**
 * The four criteria → one task band.
 *
 * The mean, with THE WEAKEST CRITERION HOLDING A VETO. A plain mean lets two
 * strong criteria hide two weak ones: band 9 content and coherence behind band
 * 3 grammar and vocabulary averages to 6, which would read as a solid B2 letter
 * for someone who cannot build a sentence. Two bands on this scale is one CEFR
 * level, so "no more than two bands above the weakest criterion" says exactly
 * what an examiner means by it — one skill may lag a level for free, a bigger
 * gap pulls the reading down.
 */
export function taskBandFromCriteria(criteria: Record<Criterion, number>): number {
  const values = CRITERIA.map((c) => clampBand(criteria[c]))
  const mean = values.reduce((n, v) => n + v, 0) / values.length
  const weakest = Math.min(...values)
  return clampBand(Math.min(Math.round(mean), weakest + 2))
}

/**
 * A mark on the official scale.
 *
 * THE SCALE HAS NO BAND 1. The agency's table runs 9, 8, 7, 6, 5, 4, 3, 2 and
 * then 0 for the fail conditions; "2" is its word for everything below band 3.
 * A 1 is therefore not a mark that exists, whether the model returned it or the
 * arithmetic landed on it, and it rounds UP to 2 — never down to 0, because 0
 * is reserved for the zero-mark rules (blank, off topic, memorised, under the
 * word floor) and may never be reached by averaging (see verify.ts).
 */
export const clampBand = (n: number): number => {
  if (!Number.isFinite(n)) return 0
  const b = Math.max(0, Math.min(9, Math.round(n)))
  return b === 1 ? 2 : b
}

/**
 * UNDERLENGTH CAPS — how short an answer limits the band it can reach.
 *
 * ⚠️ THIS CAPS TASK ACHIEVEMENT, NOT THE WHOLE TASK BAND. In the PDF every
 * underlength line ("Text may be 10-20% underlength (121-135 words)") is a
 * bullet inside the TASK ACHIEVEMENT column — it sits beside "all content
 * points are addressed", not above the table. Grammar, vocabulary and coherence
 * are judged on their own merit however short the piece is. Capping all four
 * (which is what this used to do) threw away a student's real grammar mark for
 * a fault the agency books against content alone. scoreTask applies it to the
 * one criterion and lets the band follow from the four.
 *
 * The official ladders are written against the full-length tasks: a 150-word
 * letter is capped at band 7 from 121-135 words, band 5 from 91-120, band 3
 * from 61-90; a 250-word essay at 7 from 188-225, 5 from 125-187, 3 from 76-125.
 *
 * THOSE ARE HELD AS RATIOS OF WHAT THE PAPER ACTUALLY ASKED FOR, not as absolute
 * word counts. Cefrly's Task 1.1 asks for ~50 words and its essay prompts ask
 * for 180-200, so applying the 250-word ladder literally would cap a student who
 * wrote exactly what the paper requested at band 5. A student is judged against
 * the instruction they were given.
 */
/** At or above this share of the paper's target, length is no obstacle at all.
 *  (135/150 and 225/250 — the top of both official ladders.) */
const FULL_LENGTH_RATIO = 0.9

/** Each rung is the LOWER bound of a published range, as a ratio of the target:
 *    Task 1 (150w): 121-135 → cap 7 · 91-120 → cap 5 · 61-90 → cap 3
 *    Task 2 (250w): 188-225 → cap 7 · 125-187 → cap 5 · 76-125 → cap 3 */
const UNDERLENGTH: Record<RubricFamily, { ratio: number; cap: number }[]> = {
  // 121/150 = 0.81 · 91/150 = 0.61 · 61/150 = 0.41
  task_1: [
    { ratio: 0.8, cap: 7 },
    { ratio: 0.6, cap: 5 },
    { ratio: 0.4, cap: 3 },
  ],
  // 188/250 = 0.75 · 125/250 = 0.50 · 76/250 = 0.30
  task_2: [
    { ratio: 0.75, cap: 7 },
    { ratio: 0.5, cap: 5 },
    { ratio: 0.3, cap: 3 },
  ],
}

/** The highest band a piece of this length can reach, or 9 if length is no
 *  obstacle. Anything at or above the paper's target is uncapped — writing MORE
 *  than asked is not a length fault. */
export function underlengthCap(
  family: RubricFamily,
  wordCount: number,
  targetWords: number,
): number {
  if (targetWords <= 0) return 9
  const ratio = wordCount / targetWords
  if (ratio >= FULL_LENGTH_RATIO) return 9
  for (const step of UNDERLENGTH[family]) {
    if (ratio >= step.ratio) return step.cap
  }
  // Shorter than the bottom rung but still above the zero-mark floor: the
  // official ladder stops describing it, and a fragment is not a band-3 answer.
  return 2
}

export type ZeroReason = 'blank' | 'too_short' | 'off_topic' | 'plagiarism'

export const ZERO_LABEL: Record<ZeroReason, string> = {
  blank: 'Nothing was written for this task.',
  too_short: 'Too short to be marked under the official rules.',
  off_topic: 'The response does not address the task set.',
  plagiarism: 'The response is memorised or copied rather than written for this task.',
}

/** Points a task contributes to the raw /36: its band as a fraction of 9, times
 *  its weight. DELIBERATELY UNROUNDED. Rounding each task to two places before
 *  summing turned the PRD's worked example of exactly 20.0 into 19.99 — near
 *  enough for the band, but the boundaries of the conversion table are printed
 *  to a tenth, and a mark must not fall through one because of a rounding step
 *  nobody asked for. The SUM is rounded once, in scoreAttempt. */
export function taskPoints(band: number, weight: number): number {
  return (clampBand(band) / 9) * weight
}

export const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Raw /36 → final /75, the agency's lookup table (writing.md §4.3), held as the
 * LOWER BOUND of each published range: "36.0–35.1 → 75" means 35.1 and up is 75.
 * No interpolation, no guessing. All four of the PRD's worked examples come back
 * out of this exactly; scoring.test.ts pins them.
 */
const RATING_TABLE: [number, number][] = [
  [35.1, 75], [34.1, 74], [33.1, 73], [32.6, 72], [32.1, 71], [31.6, 70],
  [31.1, 69], [30.6, 68], [30.1, 67], [29.1, 66], [28.1, 65], [27.1, 64],
  [26.6, 63], [26.1, 62], [25.6, 61], [25.1, 60], [24.6, 59], [24.1, 58],
  [23.6, 57], [23.1, 56], [22.6, 55], [22.1, 54], [21.6, 53], [21.1, 52],
  [20.6, 51], [20.1, 50], [19.6, 49], [19.1, 48], [18.6, 47], [18.1, 46],
  [17.6, 45], [17.1, 44], [16.6, 43], [16.1, 42], [15.6, 41], [15.1, 40],
  [14.6, 39], [14.1, 38], [13.6, 37], [13.1, 36], [12.6, 35], [12.1, 34],
  [11.6, 33], [11.1, 32], [10.6, 31], [10.1, 30], [9.6, 29], [9.1, 28],
  [8.6, 27], [8.1, 26], [7.6, 25], [7.1, 24], [6.6, 23], [6.1, 22],
  [5.6, 21], [5.1, 20], [4.6, 19], [4.1, 18], [3.6, 17], [3.1, 16],
  [2.6, 15], [2.1, 14], [1.6, 13], [1.1, 12], [0.6, 11], [0.1, 10],
  [0, 0],
]

export function ratingForRaw(raw: number): number {
  const clamped = Math.max(0, Math.min(MAX_RAW, raw))
  for (const [floor, rating] of RATING_TABLE) {
    // Rounded to two places first: 22.219999 must not miss a 22.1 boundary it
    // is plainly above.
    if (round2(clamped) >= floor) return rating
  }
  return 0
}

export type Band = 'below_B1' | 'B1' | 'B2' | 'C1'

/**
 * CEFR bands on the 75-point scale (writing.md §4.4): C1 65-75, B2 51-64,
 * B1 38-50.
 *
 * SETTLED 2026-09-10: grade-speaking read 50 here, so a student on exactly 50
 * was B1 in writing and B2 in speaking off one chart. The PDF's B1 row is
 * "38-50", so 50 is the top of B1 — speaking was the wrong transcription and
 * now matches. Both graders share this table; change neither alone.
 */
export function bandForRating(rating: number): Band {
  if (rating >= 65) return 'C1'
  if (rating >= 51) return 'B2'
  if (rating >= 38) return 'B1'
  return 'below_B1'
}

/**
 * A SINGLE-TASK DRILL'S ESTIMATE.
 *
 * One task cannot produce a real /75 — the paper has three, weighted 4/8/24 —
 * so a drill stores band NULL and shows an estimate instead. The honest way to
 * place one task on the full scale is to answer the question the student is
 * actually asking: "if I wrote at this level across the whole paper, what would
 * I get?" Every task at band b gives raw = 4b, so the estimate is just that raw
 * through the same official table. Nothing is scaled, nothing is invented, and
 * a good writer on the short informal email is not told they are B1 — the flaw
 * that cost Speaking two rewrites (grade-speaking/rubric.ts, estimateRating*).
 */
export function estimateRatingFromBand(band: number): number {
  return ratingForRaw(clampBand(band) * 4)
}

/** The descriptors the model marks against — TRANSCRIBED FROM
 *  "Writing criteria multilevel.pdf", the agency's own words, column by column.
 *  It replaced a reconstruction written before the PDF was available; the
 *  reconstruction invented a band 1 (there is none), and left out paraphrasing,
 *  referencing/substitution and the countable content-point rule entirely. */
export const RUBRIC_TEXT = `
THE BAND SCALE. The official marks are 9, 8, 7, 6, 5, 4, 3, 2 — and 0 for the
fail conditions below. THERE IS NO BAND 1. The odd bands carry the descriptors;
8, 6 and 4 mean the writing shares features of the bands either side of it, and
2 means "performance below Band 3". CEFR anchors: 9 = C1, 7 = B2, 5 = B1.

ZERO MARK. A task scores 0 only if the response is: not written; completely off
topic; fully plagiarized or memorized; or under the word floor (20 words for
Task 1, 40 for Task 2). Nothing else zeroes a task.

=============================================================================
TASK 1 — the letter/email (Cefrly Task 1.1 and Task 1.2)
=============================================================================

BAND 9 (C1)
  Task achievement
    · All content is relevant to the task
    · Addresses the requirements of the genre and style
    · Presents a purpose that is clear and well-written
    · All content points are addressed and adequately developed
  Grammar range and accuracy
    · A variety of complex structures are used with full control, flexibility
      and sophistication
    · There are few errors; good control of grammar and punctuation
  Vocabulary range and appropriacy
    · A wide range of vocabulary is used with flexibility and precision
    · Some less common lexis are used with some awareness of style and
      collocation
    · There are few errors in word choice, spelling and/or word formation
    · Paraphrasing is effectively used
  Coherence and Cohesion
    · Text is a well-organised, coherent whole
    · Uses a variety of cohesive devices and organizational patterns with
      flexibility
    · Referencing / substitution is used appropriately to avoid repetition
    · Paragraphing conventions are followed

BAND 8 — performance shares features of Band 7 and Band 9.

BAND 7 (B2)
  Task achievement
    · Minor irrelevances and/or omissions may be present
    · Generally addresses the genre and style; the format may be inappropriate
      in places
    · Presents a purpose for the letter
    · All content points are addressed
    · Text may be 10-20% underlength (121-135 words)
  Grammar range and accuracy
    · A mix of simple and complex structures are used
    · Errors in grammar and/or punctuation exist, but they do not impede
      understanding
  Vocabulary range and appropriacy
    · A good range of vocabulary is used
    · Some less common lexis are attempted, but with some inaccuracy
    · Errors in word choice, spelling and/or word formation do not impede
      understanding
    · Paraphrasing is used to some effect
  Coherence and Cohesion
    · Text is well organized and coherent
    · Cohesive devices are used effectively, but cohesion within and/or between
      sentences may be faulty or mechanical
    · Referencing may not always be used clearly or appropriately
    · Uses paragraphing, but not always logically

BAND 6 — performance shares features of Band 5 and Band 7.

BAND 5 (B1)
  Task achievement
    · Irrelevances and misinterpretation of task may be present
    · Attempts to address the genre and style; the format may be inappropriate
    · May fail to clearly explain the purpose of the letter
    · Some content points (2 out of 3) are addressed, parts may be unclear,
      irrelevant, repetitive or inaccurate
    · Text may be 20-40% underlength (91-120 words)
  Grammar range and accuracy
    · Mostly simple structures are used, complex sentences are attempted, but
      these tend to be less accurate than simple sentences
    · There are frequent grammatical errors and punctuation may be faulty
    · Errors sometimes impede understanding
  Vocabulary range and appropriacy
    · Uses a range of everyday vocabulary appropriately, with occasional
      inappropriate use of less common lexis
    · Errors in word choice, spelling and/or word formation may impede
      understanding
    · Paraphrasing is rarely used
  Coherence and Cohesion
    · Ideas are presented with some organization
    · Cohesive devices may be inappropriate, inaccurate and/or over-used
    · Cohesive devices may be repetitive because of lack of referencing and
      substitution
    · May not write in paragraphs, or paragraphing may be inadequate

BAND 4 — performance shares features of Band 3 and Band 5.

BAND 3
  Task achievement
    · Fails to address the task, which may have been completely misunderstood
    · Presents limited ideas which may be largely irrelevant or repetitive
    · Some content points (1 out of 3) may be addressed
    · Text may be 40-60% underlength (61-90 words)
  Grammar range and accuracy
    · Only a limited range of structures are used with rare use of subordinate
      clauses
    · Some structures are accurate but errors predominate, and punctuation is
      often faulty
    · Errors impede understanding
  Vocabulary range and appropriacy
    · Only basic vocabulary is used which may be repetitive or inappropriate
      for the task
    · Errors in word choice, word formation and/or spelling causes strain for
      the reader
    · Paraphrasing is not used
  Coherence and Cohesion
    · Ideas are presented, but not arranged coherently and there is no clear
      progression in the response
    · Some basic cohesive devices are used, but these may be inaccurate or
      repetitive
    · There is no attempt at referencing and substitution
    · May not write in paragraphs or their use may be confusing

BAND 2 — performance below Band 3.

=============================================================================
TASK 2 — the essay / forum post (Cefrly Task 2)
=============================================================================
Grammar, Vocabulary and Coherence use the SAME descriptors as Task 1 at every
band. Task achievement differs, because this task is an argued response:

BAND 9 (C1)
    · Presents a clear position throughout the response
    · Ideas are relevant, fully extended and well-supported
    · All parts of the task are addressed and well-developed
    · Requirements of academic style are fully observed
    · Thesis is appropriately stated
    · Introduction and conclusion are included and appropriately developed
    · Paragraphs in the body are developed correctly

BAND 7 (B2)
    · Presents, extends and supports main ideas, but there may be a tendency to
      overgeneralise or supporting ideas may lack focus
    · All parts of the task are addressed
    · Requirements of academic style are generally observed
    · Thesis is stated
    · Introduction and conclusion are included
    · Paragraphs in the body are developed generally correctly
    · Text may be 10-25% underlength (188-225 words)

BAND 5 (B1)
    · Expresses a position but the development is not always clear
    · The conclusions may become unclear or repetitive
    · Presents relevant main ideas but some may be inadequately
      developed/unclear
    · All parts of the task are addressed, but some parts may be more fully
      covered than others
    · Requirements of academic style are partially observed
    · Thesis is stated, but may be unclear or inadequate
    · Some paragraphs in the body are incorrectly developed
    · Text may be 25-50% underlength (125-187 words)

BAND 3
    · Responds to the task only in a minimal way
    · Presents some main ideas but these are limited and not sufficiently
      developed; there may be irrelevant details
    · Task is only partially observed
    · Requirements of academic style are not observed
    · Thesis may be missing
    · Introduction or conclusion is/are missing or inadequately developed
    · Paragraphs in the body are incorrectly developed
    · Text may be 50-70% underlength (76-125 words)

BAND 2 — performance below Band 3.

=============================================================================
HOW TO APPLY THIS
=============================================================================
· LENGTH IS NOT YOURS TO JUDGE. The underlength lines above are printed so you
  can see where the agency draws them, but the system applies them afterwards,
  to Task achievement only, against the word target THIS paper asked for. Mark
  the quality of what is in front of you and do not deduct for shortness
  yourself — doing so would punish it twice.
· CONTENT POINTS ARE COUNTABLE. Band 5 means two of the three prompt bullets
  are addressed, band 3 means one. Count them, and list what you counted.
· PARAPHRASING AND REFERENCING ARE MARKED. Whether the writer recasts the
  prompt in their own words belongs to Vocabulary; whether they use "it",
  "this", "the former" instead of repeating nouns belongs to Coherence. Both
  are part of the official descriptors — do not ignore them.
· JUDGE THE PATTERN, NOT THE TALLY. High-level writers make careless slips. An
  isolated agreement error in otherwise complex accurate prose is not evidence
  of a low band. Basic errors point to a low band when they are SYSTEMATIC.
· DO NOT REWARD VOLUME. A long answer that repeats itself is not developed.
· DO NOT PUNISH AN OPINION you disagree with, an unusual position, or a culture
  you do not share. Mark the English and the argument, not the view.
`.trim()
