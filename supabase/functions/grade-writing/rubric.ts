// The official Multilevel WRITING rubric, as arithmetic.
//
// Two source documents define this (see writing.md §4):
//   · "Writing criteria multilevel.pdf"                  — the 0-9 band descriptors
//   · "Chet tili (multilevel) baholash mezonlari - yangi" — weights + the /36→/75 table
//
// ⚠️ RUBRIC_TEXT BELOW IS NOT A VERBATIM TRANSCRIPTION. The descriptor PDF is
// gitignored and was not present in the working tree when this was written, so
// the descriptors here are reconstructed from the anchors the PRD does record
// (9 = C1, 7 = B2, 5 = B1, 3-2 below B1, plus the zero-mark and underlength
// rules). REPLACE RUBRIC_TEXT WITH THE PDF's OWN WORDS when the file is
// available — it is one constant, and nothing else in this module depends on
// its wording. The MATHS below (weights, conversion table, thresholds) IS from
// the PRD's transcription of the second PDF and reproduces all four of its
// worked examples exactly; scoring.test.ts pins them.

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

export const clampBand = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.min(9, Math.round(n))) : 0

/**
 * UNDERLENGTH CAPS — how short an answer limits the band it can reach.
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
 * ⚠️ grade-speaking/rubric.ts puts the B2 floor at 50, not 51, from the same
 * agency chart. One of the two transcriptions is off by a point and only the
 * PDFs can settle it. Flagged rather than silently unified — a student on
 * exactly 50 is B1 in writing and B2 in speaking until somebody checks.
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

/** The descriptors the model marks against. See the warning at the top of this
 *  file: reconstructed from the PRD's CEFR anchors, NOT the PDF's own words. */
export const RUBRIC_TEXT = `
THE BAND SCALE (0-9), used for every criterion on every task.
  9 = C1.  7 = B2.  5 = B1.  3 = below B1.
  8, 6, 4 and 2 mean the writing shares features of the bands either side of it.
  Use the whole scale. A band is a description of what is on the page, not a
  reward for effort.

TASK 1 DESCRIPTORS (informal email / formal email — Cefrly Task 1.1 and 1.2).

  Task achievement
    9 = every content point in the prompt is covered and developed, the purpose
        is immediately clear, and the register (informal to a friend, formal to
        an official) is consistent throughout.
    7 = all content points are covered, most developed; register is appropriate
        with the odd slip.
    5 = the content points are addressed but thinly, or one is passed over;
        register wavers between formal and informal.
    3 = the response only partly relates to the task, or leaves most of the
        prompt unanswered; register is wrong for the reader.
    1 = barely connected to the task set.

  Grammar range and accuracy
    9 = a range of structures used flexibly and accurately; errors are rare and
        do not affect meaning.
    7 = complex structures attempted and mostly correct; errors appear but do
        not block understanding.
    5 = simple structures are correct; errors appear whenever anything complex
        is attempted, occasionally obscuring meaning.
    3 = errors in basic structures are frequent and interfere with meaning.
    1 = grammar limited to memorised words and phrases.

  Vocabulary range and appropriacy
    9 = a wide, precise range including less common items; word choice is
        natural and suits the register.
    7 = enough range for the task with some flexibility; occasional wrong
        choices that do not block meaning.
    5 = adequate for simple content; repetition and wrong choices are noticeable.
    3 = very limited, mostly everyday personal vocabulary; wrong choices often
        obscure meaning.
    1 = isolated words only.

  Coherence and cohesion
    9 = ideas are ordered so the reader never has to work; cohesion is varied
        and unobtrusive; paragraphing is purposeful.
    7 = a clear line of thought with a range of linkers, occasionally mechanical.
    5 = ideas are followable but linking is simple and repetitive; paragraphing
        may be missing.
    3 = links between ideas are often unclear; the reader has to reconstruct
        the order.
    1 = no discernible organisation.

TASK 2 DESCRIPTORS (essay / forum post — Cefrly Task 2).

  Task achievement
    9 = a clear position is stated and sustained; the argument is developed with
        relevant reasons and specific examples; the response answers the exact
        question asked.
    7 = a clear position with reasons and examples; some development is thin or
        general.
    5 = a position is present but the argument is assertion rather than
        development; examples are generic or missing.
    3 = the position is unclear or shifts; the response drifts from the question.
    1 = the topic is mentioned but the question is not addressed.

  Grammar range and accuracy — as Task 1, judged against the greater demands of
    argument: subordination, hedging, conditionals and passive forms are part of
    the range expected at 9 and 7.

  Vocabulary range and appropriacy — as Task 1, plus: at 9 and 7 the register is
    appropriately impersonal or discursive and topic vocabulary is precise.

  Coherence and cohesion
    9 = a genuine essay shape (position, developed body, conclusion that follows
        from it); each paragraph carries one idea; cohesion is varied.
    7 = a clear structure with functioning paragraphs and a range of linkers.
    5 = some structure, but paragraphs may run together or repeat.
    3 = one undifferentiated block, or an order the reader must reconstruct.
    1 = no organisation.

JUDGING NOTES (these matter as much as the descriptors).
  · Judge the PATTERN, not the tally. High-level writers make careless slips;
    an isolated agreement error in otherwise complex accurate prose is not
    evidence of a low band. Errors in basic structures point to a low band only
    when they are SYSTEMATIC.
  · Length is not yours to judge. Word counts and their caps are applied by the
    system afterwards; mark the quality of what is in front of you.
  · Do not reward volume. A long answer that repeats itself is not developed.
  · Do not punish an opinion you disagree with, an unusual position, or a
    culture you do not share. Mark the English and the argument, not the view.
`.trim()
