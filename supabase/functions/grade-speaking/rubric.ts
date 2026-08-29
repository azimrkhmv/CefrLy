// The official Multilevel speaking rubric, transcribed from the owner's papers
// ("yangi format baholash mezoni" + "reyting shkalasi").
//
// SCORING IS BLOCK-BASED, NOT PER QUESTION. The paper's eight questions form
// four blocks, and each block gets ONE score covering all of its answers:
//
//   Q1-3  Part 1.1   0-5   anchored at A2   (5 = speech above A2)
//   Q4-6  Part 1.2   0-5   anchored at B1
//   Q7    Part 2     0-5   anchored at B2
//   Q8    Part 3     0-6   anchored at C1
//
// Raw total (max 21) goes through the rating table to 0-75, and 75 is the
// ceiling because the exam does not test C2 at all.
//
// This is why grading is a SINGLE model call per attempt: a block score depends
// on how many of its answers are on topic ("all three" = 4, "two" = 3, "only
// one" = 1), so the three answers of a block cannot be scored in isolation.

export type BlockKey = 'q1_3' | 'q4_6' | 'q7' | 'q8'

export const BLOCKS: {
  key: BlockKey
  partType: string
  label: string
  max: number
  anchor: string
}[] = [
  { key: 'q1_3', partType: 'part_1_1', label: 'Part 1.1', max: 5, anchor: 'A2' },
  { key: 'q4_6', partType: 'part_1_2', label: 'Part 1.2', max: 5, anchor: 'B1' },
  { key: 'q7', partType: 'part_2', label: 'Part 2', max: 5, anchor: 'B2' },
  { key: 'q8', partType: 'part_3', label: 'Part 3', max: 6, anchor: 'C1' },
]

export const blockForPart = (partType: string): BlockKey =>
  (BLOCKS.find((b) => b.partType === partType)?.key ?? 'q1_3')

export const MAX_RAW = BLOCKS.reduce((n, b) => n + b.max, 0) // 21

/**
 * "Reyting shkalasi": raw score (0-21, half points allowed) -> rating (0-75).
 * Copied entry for entry from the table; no interpolation, no guessing.
 */
const RATING_TABLE: [number, number][] = [
  [21, 75], [20.5, 73], [20, 71], [19.5, 69], [19, 67], [18.5, 65], [18, 64],
  [17.5, 63], [17, 61], [16.5, 59], [16, 57], [15.5, 56], [15, 54], [14.5, 52],
  [14, 51], [13.5, 50], [13, 49], [12.5, 47], [12, 46], [11.5, 45], [11, 43],
  [10.5, 42], [10, 40], [9.5, 39], [9, 38], [8.5, 37], [8, 35], [7.5, 33],
  [7, 32], [6.5, 30], [6, 29], [5.5, 27], [5, 26], [4.5, 24], [4, 23],
  [3.5, 21], [3, 19], [2.5, 17], [2, 15], [1.5, 13], [1, 11], [0.5, 10],
  [0, 0],
]

/** Raw -> rating. Rounds DOWN to the nearest half point, as the table is discrete. */
export function ratingForRaw(raw: number): number {
  const clamped = Math.max(0, Math.min(MAX_RAW, raw))
  const halved = Math.floor(clamped * 2) / 2
  for (const [score, rating] of RATING_TABLE) {
    if (halved >= score) return rating
  }
  return 0
}

export type Band = 'below_B1' | 'B1' | 'B2' | 'C1'

/**
 * CEFR bands on the 75-point scale, from the agency's standard-score chart:
 * B1 starts at 38, B2 at 50, C1 at 65. Nothing reaches C2 — the format has no
 * C2 tasks, which is why the app's ruler caps there too.
 */
export function bandForRating(rating: number): Band {
  if (rating >= 65) return 'C1'
  if (rating >= 50) return 'B2'
  if (rating >= 38) return 'B1'
  return 'below_B1'
}

/**
 * A single-part drill only fills one block, so it has no honest /75. We scale
 * that block to the full raw scale to show an ESTIMATE — clearly labelled as
 * one in the UI, and never written to the attempt's `band` column, so it stays
 * out of the student's real CEFR history.
 */
export function estimateRatingFromBlock(blockKey: BlockKey, score: number): number {
  const block = BLOCKS.find((b) => b.key === blockKey)
  if (!block || block.max === 0) return 0
  return ratingForRaw((score / block.max) * MAX_RAW)
}

/** The descriptors, condensed from the papers — the grader's actual criteria. */
export const RUBRIC_TEXT = `
BLOCK Q1-3 (Part 1.1, three short interview questions). Max 5.
  5 = speech above A2.
  4 = answers to ALL THREE questions are on topic, and: some simple grammatical
      structures are used correctly but there are systematic errors; vocabulary
      is sufficient to answer though wrong word choices are noticeable;
      mispronunciations are noticeable and often affect meaning; frequent
      pauses, repetition and self-correction, but meaning is understandable.
  3 = the same quality, but only TWO answers are on topic.
  2 = at least two answers on topic, and: grammar limited to words and phrases,
      errors in simple structures block understanding; vocabulary limited to
      very simple personal words; pronunciation mostly unintelligible except
      isolated words; pauses and repetition block understanding.
  1 = the same weak quality, and only ONE answer is on topic.
  0 = no meaningful speech, or all answers entirely off topic (including
      memorised answers and guesses).

BLOCK Q4-6 (Part 1.2, photo comparison, three questions). Max 5.
  5 = speech above B1.
  4 = ALL THREE on topic, and: simple structures used correctly, errors appear
      when attempting complex ones; vocabulary sufficient for the task, errors
      when expressing complex ideas; pronunciation generally intelligible though
      mispronunciation sometimes affects meaning; some pauses, repetition and
      self-correction; only simple connectives, links between ideas not always
      clear.
  3 = the same quality with TWO answers on topic.
  2 = at least two on topic at the weaker (upper-A2-like) level described above.
  1 = only ONE answer on topic at that weaker level.
  0 = no meaningful speech or entirely off topic/memorised.

BLOCK Q7 (Part 2, one two-minute turn). Max 5.
  5 = speech above B2.
  4 = on topic, and: some complex grammatical constructions used correctly,
      errors do not block understanding; vocabulary sufficient to discuss the
      required topics, wrong lexical choices do not block understanding;
      pronunciation intelligible, mispronunciation does not cause
      misunderstanding; occasional pauses to search for a word but they do not
      trouble the listener; a range of connectives makes links between ideas
      clear.
  3 = the same quality but the response covers the topic only partly.
  2 = performance at the upper-B1 level (simple structures correct, errors when
      attempting complex ones, only simple connectives).
  1 = lower-B1 level performance.
  0 = speech below B1, or no meaningful speech, or entirely off topic/memorised.

BLOCK Q8 (Part 3, for-and-against, one two-minute turn). Max 6.
  6 = speech above C1.
  5 = the topic is covered in detail with balanced arguments for and against,
      and: a range of complex structures used correctly with only minor errors
      that do not block understanding; vocabulary meets the task's demands;
      pronunciation clear; speech flows with natural hesitation only; ideas are
      well linked.
  4-1 = progressively weaker on those same features, or the argument is
      one-sided rather than balanced.
  0 = no meaningful speech, or entirely off topic/memorised.
`.trim()
