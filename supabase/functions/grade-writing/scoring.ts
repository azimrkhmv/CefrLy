// Turning the model's judgement into the exam's marks.
//
// Pure functions only — no Deno, no network, no model. That is what lets
// scoring.test.ts run the whole mark scheme in a fifth of a second under plain
// `node --test`, which is the only reason the Speaking grader stopped shipping
// wrong marks (docs/SPEAKING-DEFECTS.md). Keep it that way: anything that needs
// a fetch belongs in index.ts.

import {
  CRITERIA,
  MAX_RAW,
  TASKS,
  bandForRating,
  clampBand,
  estimateRatingFromBand,
  ratingForRaw,
  taskBandFromCriteria,
  taskPoints,
  underlengthCap,
  type Band,
  type Criterion,
  type WritingTaskType,
} from './rubric.ts'
import {
  resolveCorrections,
  resolveCriteria,
  wordCount,
  zeroReasonFor,
  type Correction,
  type RawCorrection,
  type ZeroReason,
} from './verify.ts'

/** One task as it arrives from the browser. */
export interface TaskIn {
  taskId: string
  taskType: WritingTaskType
  taskLabel: string
  text: string
  /** What the paper asked for, so length is judged against the instruction the
   *  student was actually given (see underlengthCap). */
  targetWords?: number
  /** The prompt itself, carried through so the model can judge task achievement
   *  — an essay cannot be marked against a question nobody showed the examiner.
   *  Plain text; the browser strips the prompt's HTML. */
  promptTitle?: string
  promptText?: string
}

/** One task as the model judged it. Every field is optional on purpose: a model
 *  that omits something must cost the student nothing (see verify.ts). */
export interface TaskJudgement {
  taskId?: string
  criteria?: Partial<Record<Criterion, unknown>>
  evidence?: string
  offTopic?: boolean
  memorised?: boolean
  contentPoints?: { point?: string; covered?: boolean }[]
  strengths?: { quote?: string; why?: string }[]
  corrections?: RawCorrection[]
  improved?: string
  comment?: string
}

export interface GradedTask {
  taskId: string
  taskType: WritingTaskType
  taskLabel: string
  band: number
  criteria: Record<Criterion, number>
  /** Criteria the model left out, filled from the mean of the rest. A long list
   *  here means the judgement was thin and the mark should be treated as such. */
  inferredCriteria: Criterion[]
  points: number
  weight: number
  wordCount: number
  targetWords: number
  /** The band the criteria alone would have given, before length capped it.
   *  Kept so the report can say "band 7, capped to 5 for length" honestly. */
  bandBeforeCap: number
  underlengthCapped: boolean
  zeroMark: ZeroReason | null
  evidence: string
  comment: string
  contentPoints: { point: string; covered: boolean }[]
  strengths: { quote: string; why: string }[]
  corrections: Correction[]
  improved: string
}

export interface GradedAttempt {
  tasks: GradedTask[]
  /** Σ points, out of 36 — the full paper's denominator even when only one task
   *  was sat, so a drill is never mistaken for a completed paper. */
  raw36: number
  maxRaw: number
  rating: number
  band: Band
  /** Set only for a single-task drill: the /75 is an extrapolation, not a mark,
   *  and never enters the student's history. */
  estimate: boolean
  summary: string
  fixFirst: string
}

/** Score ONE task: the model's criteria, the length rules, the zero rules. */
export function scoreTask(task: TaskIn, judgement: TaskJudgement | undefined): GradedTask {
  const meta = TASKS[task.taskType]
  const words = wordCount(task.text)
  const target = task.targetWords && task.targetWords > 0 ? task.targetWords : meta.defaultTargetWords

  const { criteria, filledIn } = resolveCriteria(CRITERIA, judgement?.criteria)
  const zero = zeroReasonFor({
    text: task.text,
    zeroMarkMinWords: meta.zeroMarkMinWords,
    offTopic: judgement?.offTopic,
    memorised: judgement?.memorised,
  })

  // No judgement at all AND nothing to contradict it: the model failed, the
  // student did not. Refusing to invent a band is the honest move — the caller
  // turns this into a failed grade rather than a zero on the student's record.
  const resolved: Record<Criterion, number> =
    criteria ?? ({ task_achievement: 0, grammar: 0, vocabulary: 0, coherence: 0 } as Record<Criterion, number>)

  // LENGTH IS BOOKED AGAINST CONTENT, NOT AGAINST EVERYTHING. The PDF prints
  // its underlength lines inside the Task achievement column, so a short piece
  // loses marks for what it failed to cover — while its grammar, vocabulary and
  // coherence are still judged on what IS on the page. This used to cap the
  // whole task band, which took a student's real grammar mark away for a fault
  // the agency books against content alone.
  const cap = underlengthCap(meta.family, words, target)
  const marked: Record<Criterion, number> = criteria
    ? { ...resolved, task_achievement: Math.min(resolved.task_achievement, cap) }
    : resolved
  const bandBeforeCap = criteria ? taskBandFromCriteria(resolved) : 0
  let band = criteria ? taskBandFromCriteria(marked) : 0
  const capped = criteria !== null && band < bandBeforeCap
  if (zero) band = 0

  return {
    taskId: task.taskId,
    taskType: task.taskType,
    taskLabel: task.taskLabel || meta.label,
    band: clampBand(band),
    // The MARKED criteria, i.e. with the length cap already applied to task
    // achievement — the report shows the numbers the band was computed from,
    // and `underlengthCapped` explains why that one is lower than it reads.
    criteria: marked,
    inferredCriteria: filledIn,
    points: taskPoints(band, meta.weight),
    weight: meta.weight,
    wordCount: words,
    targetWords: target,
    bandBeforeCap,
    underlengthCapped: capped && !zero,
    zeroMark: zero,
    evidence: judgement?.evidence?.trim() ?? '',
    comment: judgement?.comment?.trim() ?? '',
    contentPoints: (judgement?.contentPoints ?? [])
      .filter((p) => p?.point)
      .map((p) => ({ point: p.point!.trim(), covered: p.covered === true })),
    strengths: (judgement?.strengths ?? [])
      .filter((s) => s?.quote && s?.why)
      .map((s) => ({ quote: s.quote!.trim(), why: s.why!.trim() })),
    // Zeroed work gets no inline marking: correcting the grammar of an answer
    // to the wrong question tells the student nothing about why it scored 0.
    corrections: zero ? [] : resolveCorrections(judgement?.corrections, task.text),
    improved: judgement?.improved?.trim() ?? '',
  }
}

/**
 * Score a whole attempt.
 *
 * A FULL PAPER IS ALWAYS OUT OF 36, whatever it contains. A student who left a
 * task blank must not get a smaller denominator as a reward — that is exactly
 * how "skip the essay, score higher" becomes true. A single-task DRILL is a
 * different thing: it is not an incomplete paper, it is one exercise, so its
 * /75 is an extrapolation (see estimateRatingFromBand) and its band is not
 * stored.
 */
export function scoreAttempt(
  tasks: TaskIn[],
  judgements: TaskJudgement[],
  scope: 'full' | 'part',
  copy: { summary?: string; fixFirst?: string } = {},
): GradedAttempt {
  const byId = new Map(judgements.filter((j) => j?.taskId).map((j) => [j.taskId!, j]))
  const graded = tasks.map((t, i) => scoreTask(t, byId.get(t.taskId) ?? judgements[i]))

  const raw36 = Math.round(graded.reduce((n, t) => n + t.points, 0) * 100) / 100
  const estimate = scope === 'part'
  const rating = estimate ? estimateRatingFromBand(graded[0]?.band ?? 0) : ratingForRaw(raw36)

  return {
    tasks: graded,
    raw36,
    maxRaw: MAX_RAW,
    rating,
    band: bandForRating(rating),
    estimate,
    summary: copy.summary?.trim() ?? '',
    fixFirst: copy.fixFirst?.trim() ?? '',
  }
}
