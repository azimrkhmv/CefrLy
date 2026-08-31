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
 * LEGACY. A drill's estimate used to be its block mark scaled to /75, which is
 * how full marks on Part 1.1 — anchored at A2, three easy questions — came out
 * as a perfect 75/75 and C1. Capping the scale then broke it the other way: a
 * student the grader had just judged B2 on every criterion was shown "B1",
 * because a cap describes what a task can PROVE (a floor) and was being read as
 * a measure of the speaker (a ceiling).
 *
 * Kept only for attempts graded before profiles existed. New drills use
 * estimateRatingFromProfile, below.
 */
export function estimateRatingFromBlock(blockKey: BlockKey, score: number): number {
  const block = BLOCKS.find((b) => b.key === blockKey)
  if (!block || block.max === 0) return 0
  return ratingForRaw((score / block.max) * MAX_RAW)
}

/**
 * A DRILL'S ESTIMATE COMES FROM HOW THE STUDENT SPOKE, NOT FROM THE BLOCK MARK.
 *
 * A block mark is bounded by its task: Part 1.1 is worth 5 and its top mark
 * means only "above A2", so no arithmetic on it can place a good speaker
 * correctly. The five criteria are not bounded that way — they describe the
 * speech itself, and a B2 speaker answering easy questions is still B2. So the
 * estimate is read off the profile and then reduced for whatever the student
 * did not actually do.
 *
 * The anchors are the middles of the official bands (B1 starts at 38, B2 at 50,
 * C1 at 65), so "all B2" lands mid-B2 rather than on a boundary where one
 * criterion would flip the band.
 */
const LEVEL_ANCHOR: [number, number][] = [
  [0, 10], // everything below A2
  [1, 30], // all A2      → mid below-B1
  [2, 44], // all B1      → mid B1  (38-49)
  [3, 57], // all B2      → mid B2  (50-64)
  [4, 70], // all C1      → mid C1  (65-75)
]

export interface TaskAchievement {
  onTopicCount: number
  questionCount: number
  coverage?: 'full' | 'partial'
  /** Q8 only. */
  balanced?: boolean
  block: BlockKey
}

export function estimateRatingFromProfile(
  criteria: Record<Criterion, CefrLevel>,
  task: TaskAchievement,
): number {
  // Mean, not median: half a level of difference between criteria should move
  // the estimate a little, and a /75 scale is fine enough to show it.
  const mean =
    CRITERIA.reduce((n, c) => n + (LEVEL_RANK[criteria[c]] ?? 0), 0) / CRITERIA.length

  let rating = LEVEL_ANCHOR[0][1]
  for (let i = 1; i < LEVEL_ANCHOR.length; i++) {
    const [lo, loR] = LEVEL_ANCHOR[i - 1]
    const [hi, hiR] = LEVEL_ANCHOR[i]
    if (mean <= hi) {
      rating = loR + ((mean - lo) / (hi - lo)) * (hiR - loR)
      break
    }
    rating = hiR
  }

  // Speaking well is not the whole job — the questions still have to be
  // answered. These come off the estimate rather than out of the criteria,
  // because they are about what was done, not about the English.
  const missed = Math.max(0, task.questionCount - task.onTopicCount)
  rating -= missed * 8
  if (task.coverage === 'partial') rating -= 6
  if (task.block === 'q8' && task.balanced === false) rating -= 4

  return Math.max(0, Math.min(MAX_RATING, Math.round(rating)))
}

/** The exam's ceiling: 75. Nothing above it exists on this paper. */
export const MAX_RATING = 75

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
