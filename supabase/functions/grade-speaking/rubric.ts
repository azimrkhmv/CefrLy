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
 * The highest rating a single block can HONESTLY demonstrate.
 *
 * Scaling a block straight to /75 produces nonsense: Part 1.1 is anchored at A2
 * and its top mark means only "speech above A2", so three well-answered
 * questions about your favourite films used to report 75/75 and C1 — a perfect
 * exam score for the easiest task on the paper. What a block proves is bounded
 * by what it ASKS. Part 1.1 can show a student is past A2 and no more; only
 * Parts 2 and 3 put them in a position to show C1.
 *
 * So a drill's estimate is clamped here: 49 = top of B1, 64 = top of B2, 71 =
 * a solid C1 (never the perfect 75, which no single block can earn).
 */
export const BLOCK_RATING_CAP: Record<BlockKey, number> = {
  q1_3: 49,
  q4_6: 64,
  q7: 71,
  q8: 75,
}

/**
 * A single-part drill only fills one block, so it has no honest /75. We scale
 * that block to the full raw scale to show an ESTIMATE — capped at what the
 * block can actually demonstrate, clearly labelled in the UI, and never written
 * to the attempt's `band` column, so it stays out of the student's real CEFR
 * history.
 */
export function estimateRatingFromBlock(blockKey: BlockKey, score: number): number {
  const block = BLOCKS.find((b) => b.key === blockKey)
  if (!block || block.max === 0) return 0
  const scaled = ratingForRaw((score / block.max) * MAX_RAW)
  return Math.min(scaled, BLOCK_RATING_CAP[blockKey])
}

// ---------------------------------------------------------------------------
// SCORING IS OURS, JUDGEMENT IS THE MODEL'S.
//
// Asking a model for "0-5 for this block" produces a number with no working
// shown, and it anchors high — it would list two grammar errors and still award
// the top mark. So it no longer scores anything. It reports what it heard, at
// the level of the rubric's own criteria (grammar, vocabulary, pronunciation,
// fluency, coherence) plus how many answers were on topic, and the mark is
// computed from that here, by the rules below.
//
// Two things follow. The score becomes auditable — a student can be shown WHY
// it is a 4 — and it becomes impossible for a block to take the top mark while
// the criteria underneath it say B1.
// ---------------------------------------------------------------------------

export type CefrLevel = 'below_A2' | 'A2' | 'B1' | 'B2' | 'C1'

export const LEVEL_RANK: Record<CefrLevel, number> = {
  below_A2: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
}

export const CRITERIA = ['grammar', 'vocabulary', 'pronunciation', 'fluency', 'coherence'] as const
export type Criterion = (typeof CRITERIA)[number]

/**
 * ONE language profile per attempt, not one per block.
 *
 * The criteria used to be judged inside each block, and the same student came
 * out A2 in Part 1 and B1 in Part 2 of the same sitting — the model was quietly
 * rating the language against how hard the task was. Measured over students who
 * sat a paper twice, their own two attempts landed an average of 18 rating
 * points apart, once 28: more than a whole band, for the same speaker on the
 * same day.
 *
 * A human examiner forms ONE view of how well somebody speaks and then asks,
 * per task, whether they answered it. That is what this is.
 */
export interface SpeakingProfile {
  criteria: Record<Criterion, CefrLevel>
  /** Quotes from the transcripts that put the levels where they are. */
  evidence: string
}

export interface BlockJudgement {
  block: BlockKey
  /** How many of the block's questions were answered on topic. */
  onTopicCount: number
  /** The attempt's language profile — the SAME for every block. */
  criteria: Record<Criterion, CefrLevel>
  /** Long-turn blocks only (Q7, Q8): was the topic covered fully or in part? */
  coverage?: 'full' | 'partial'
  /** Q8 only: were both sides genuinely argued? The rubric's 5 demands it. */
  balanced?: boolean
  reason: string
}

/** The level the speech as a whole sits at: the MIDDLE of the five criteria.
 *  Not the average (which invents half-levels the rubric has no words for) and
 *  not the minimum (one weak accent would drag a fluent speaker to A2). */
export function overallLevel(criteria: Record<Criterion, CefrLevel>): number {
  const ranks = CRITERIA.map((c) => LEVEL_RANK[criteria[c]] ?? 0).sort((a, b) => a - b)
  return ranks[Math.floor(ranks.length / 2)]
}

/**
 * The rubric, as arithmetic.
 *
 * Each block is anchored at a level: the top mark means "above the anchor", the
 * next mark down means "at the anchor, everything on topic", and it falls from
 * there as fewer answers stay on topic or the language drops a level.
 */
export function scoreBlock(j: BlockJudgement): number {
  const level = overallLevel(j.criteria)
  const on = Math.max(0, Math.round(j.onTopicCount))

  // Nothing on topic — or nothing said at all — is 0 in every block. Speech
  // BELOW the anchor still scores, but only the bottom marks, handled per block.
  if (on === 0) return 0

  switch (j.block) {
    // Three short answers, anchored A2. 5 = above A2.
    case 'q1_3':
      if (level >= LEVEL_RANK.B1) return on >= 3 ? 5 : on === 2 ? 4 : 3
      if (level === LEVEL_RANK.A2) return on >= 3 ? 4 : on === 2 ? 3 : 2
      return on >= 2 ? 2 : 1

    // Photo comparison, three answers, anchored B1. 5 = above B1.
    case 'q4_6':
      if (level >= LEVEL_RANK.B2) return on >= 3 ? 5 : on === 2 ? 4 : 3
      if (level === LEVEL_RANK.B1) return on >= 3 ? 4 : on === 2 ? 3 : 2
      if (level === LEVEL_RANK.A2) return on >= 2 ? 2 : 1
      return 1

    // One two-minute turn, anchored B2. 5 = above B2.
    case 'q7':
      if (on === 0) return 0
      if (level >= LEVEL_RANK.C1) return j.coverage === 'partial' ? 4 : 5
      if (level === LEVEL_RANK.B2) return j.coverage === 'partial' ? 3 : 4
      if (level === LEVEL_RANK.B1) return j.coverage === 'partial' ? 1 : 2
      return 0 // below B1 is 0 here, as the rubric says in so many words

    // For-and-against, anchored C1, worth 6. 6 = above C1; 5 needs BOTH sides.
    case 'q8': {
      if (on === 0) return 0
      if (level >= LEVEL_RANK.C1) {
        if (j.balanced === false) return 4 // one-sided caps it, however good
        return j.coverage === 'partial' ? 5 : 6
      }
      if (level === LEVEL_RANK.B2) return j.balanced === false ? 3 : 4
      if (level === LEVEL_RANK.B1) return 2
      return 1
    }
  }
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
