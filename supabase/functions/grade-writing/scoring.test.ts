/**
 * REGRESSION TESTS FOR THE WRITING MARK.
 *
 *   Run:  node --test supabase/functions/grade-writing/
 *
 * Node strips the types; no build step, no Deno, no network, no model. The
 * scoring functions are pure by design — keep them that way.
 *
 * The first group pins the OFFICIAL maths against writing.md §4.5's own worked
 * examples: if the conversion table was transcribed wrong, these fail. The rest
 * pin the rules that Speaking had to learn by shipping wrong marks to students
 * (docs/SPEAKING-DEFECTS.md) — above all that MISSING EVIDENCE MAY NEVER ZERO A
 * MARK. Add a case here the moment a defect is found, BEFORE fixing it.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  bandForRating,
  estimateRatingFromBand,
  ratingForRaw,
  taskBandFromCriteria,
  taskPoints,
  underlengthCap,
  type Criterion,
} from './rubric.ts'
import { locateQuote, resolveCorrections, resolveCriteria, wordCount, zeroReasonFor } from './verify.ts'
import { scoreAttempt, scoreTask, type TaskIn, type TaskJudgement } from './scoring.ts'

const crit = (
  task_achievement: number,
  grammar = task_achievement,
  vocabulary = task_achievement,
  coherence = task_achievement,
): Record<Criterion, number> => ({ task_achievement, grammar, vocabulary, coherence })

const words = (n: number, word = 'idea') => Array.from({ length: n }, () => word).join(' ')

const TASK: Record<string, TaskIn> = {
  t11: { taskId: 'a', taskType: 'task_1_1', taskLabel: 'Task 1.1', text: words(60), targetWords: 50 },
  t12: { taskId: 'b', taskType: 'task_1_2', taskLabel: 'Task 1.2', text: words(150), targetWords: 150 },
  t2: { taskId: 'c', taskType: 'part_2', taskLabel: 'Task 2', text: words(220), targetWords: 200 },
}

const judged = (c: Record<Criterion, number>, extra: Partial<TaskJudgement> = {}): TaskJudgement => ({
  criteria: c,
  ...extra,
})

// ---------------------------------------------------------------------------
// The official conversion — writing.md §4.5 worked examples, verbatim.
// ---------------------------------------------------------------------------

test('official: all three tasks at band 9 → raw 36 → 75 (C1)', () => {
  const g = scoreAttempt([TASK.t11, TASK.t12, TASK.t2], [judged(crit(9)), judged(crit(9)), judged(crit(9))], 'full')
  assert.equal(g.raw36, 36)
  assert.equal(g.rating, 75)
  assert.equal(g.band, 'C1')
})

test('official: all three at band 7 → raw 28.0 → 64 (B2)', () => {
  const g = scoreAttempt([TASK.t11, TASK.t12, TASK.t2], [judged(crit(7)), judged(crit(7)), judged(crit(7))], 'full')
  assert.equal(g.raw36, 28)
  assert.equal(g.rating, 64)
  assert.equal(g.band, 'B2')
})

test('official: all three at band 5 → raw 20.0 → 49 (B1)', () => {
  const g = scoreAttempt([TASK.t11, TASK.t12, TASK.t2], [judged(crit(5)), judged(crit(5)), judged(crit(5))], 'full')
  assert.equal(g.raw36, 20)
  assert.equal(g.rating, 49)
  assert.equal(g.band, 'B1')
})

test('official: mixed 6 / 7 / 5 → raw 22.22 → 54 (B2)', () => {
  const g = scoreAttempt([TASK.t11, TASK.t12, TASK.t2], [judged(crit(6)), judged(crit(7)), judged(crit(5))], 'full')
  assert.equal(g.rating, 54)
  assert.equal(g.band, 'B2')
})

test('the table reads the LOWER bound of each published range', () => {
  // "36.0-35.1 → 75" means 35.1 is already 75, and 35.0 is not.
  assert.equal(ratingForRaw(35.1), 75)
  assert.equal(ratingForRaw(35.0), 74)
  assert.equal(ratingForRaw(0.1), 10)
  assert.equal(ratingForRaw(0), 0)
})

test('rating is clamped to the paper, not extrapolated past it', () => {
  assert.equal(ratingForRaw(99), 75)
  assert.equal(ratingForRaw(-5), 0)
})

test('CEFR thresholds on the /75 scale', () => {
  assert.equal(bandForRating(75), 'C1')
  assert.equal(bandForRating(65), 'C1')
  assert.equal(bandForRating(64), 'B2')
  assert.equal(bandForRating(51), 'B2')
  assert.equal(bandForRating(50), 'B1')
  assert.equal(bandForRating(38), 'B1')
  assert.equal(bandForRating(37), 'below_B1')
})

test('task weights fill the official 12 / 24 buckets', () => {
  assert.equal(taskPoints(9, 4) + taskPoints(9, 8), 12)
  assert.equal(taskPoints(9, 24), 24)
})

// ---------------------------------------------------------------------------
// Criteria → band. The weakest criterion holds a veto.
// ---------------------------------------------------------------------------

test('uniform criteria give that band', () => {
  assert.equal(taskBandFromCriteria(crit(7)), 7)
})

test('ONE criterion a level behind costs nothing — writers are uneven', () => {
  // 9,9,9,7 → mean 8.5 → 9, weakest+2 = 9. A C1 letter with B2 vocabulary is
  // still a C1 letter.
  assert.equal(taskBandFromCriteria(crit(9, 9, 7, 9)), 9)
})

test('two strong criteria may NOT hide two weak ones', () => {
  // 9 content + 9 coherence behind 3 grammar + 3 vocabulary means 6 to a plain
  // mean — a solid B2 letter for someone who cannot build a sentence.
  assert.equal(taskBandFromCriteria(crit(9, 3, 3, 9)), 5)
})

test('a single collapsed criterion pulls the band down to just above it', () => {
  assert.equal(taskBandFromCriteria(crit(8, 8, 8, 2)), 4)
})

// ---------------------------------------------------------------------------
// Length rules.
// ---------------------------------------------------------------------------

test('underlength caps are ratios of what the PAPER asked for', () => {
  // The essay ladder is written against 250 words; a Cefrly prompt asking for
  // 200 must not cap a student who wrote the 190 it requested.
  assert.equal(underlengthCap('task_2', 190, 200), 9)
  // The very same 190 words, judged against the official 250-word essay, is
  // short enough to cost the top two bands.
  assert.equal(underlengthCap('task_2', 190, 250), 7)
})

test('essay ladder against a full-length 250-word task', () => {
  assert.equal(underlengthCap('task_2', 230, 250), 9)
  assert.equal(underlengthCap('task_2', 200, 250), 7)
  assert.equal(underlengthCap('task_2', 150, 250), 5)
  assert.equal(underlengthCap('task_2', 130, 250), 5)
  assert.equal(underlengthCap('task_2', 80, 250), 3)
  assert.equal(underlengthCap('task_2', 60, 250), 2)
})

test('letter ladder against a full-length 150-word task', () => {
  assert.equal(underlengthCap('task_1', 140, 150), 9)
  assert.equal(underlengthCap('task_1', 130, 150), 7)
  assert.equal(underlengthCap('task_1', 100, 150), 5)
  assert.equal(underlengthCap('task_1', 70, 150), 3)
})

test('writing MORE than asked is not a length fault', () => {
  assert.equal(underlengthCap('task_1', 400, 150), 9)
})

test('a capped task reports the band it would have had', () => {
  const short: TaskIn = { ...TASK.t2, text: words(120), targetWords: 200 }
  const g = scoreTask(short, judged(crit(9)))
  assert.equal(g.bandBeforeCap, 9)
  assert.equal(g.band, 5) // 120/200 = 0.6 → below 0.75 → cap 5
  assert.equal(g.underlengthCapped, true)
})

test('length never RAISES a band', () => {
  const g = scoreTask({ ...TASK.t2, text: words(400) }, judged(crit(4)))
  assert.equal(g.band, 4)
  assert.equal(g.underlengthCapped, false)
})

// ---------------------------------------------------------------------------
// THE ZERO RULE. Contradicted evidence only — never missing evidence.
// ---------------------------------------------------------------------------

test('zero: blank and under the official word floor', () => {
  assert.equal(zeroReasonFor({ text: '', zeroMarkMinWords: 20 }), 'blank')
  assert.equal(zeroReasonFor({ text: words(19), zeroMarkMinWords: 20 }), 'too_short')
  assert.equal(zeroReasonFor({ text: words(20), zeroMarkMinWords: 20 }), null)
  assert.equal(zeroReasonFor({ text: words(39), zeroMarkMinWords: 40 }), 'too_short')
})

test('zero: only an AFFIRMATIVE off-topic claim counts', () => {
  assert.equal(zeroReasonFor({ text: words(60), zeroMarkMinWords: 20, offTopic: true }), 'off_topic')
  assert.equal(zeroReasonFor({ text: words(60), zeroMarkMinWords: 20, offTopic: false }), null)
  // The model forgot the field. That is missing evidence, not an accusation.
  assert.equal(zeroReasonFor({ text: words(60), zeroMarkMinWords: 20, offTopic: undefined }), null)
})

test('a model that returns NOTHING may not zero real work', () => {
  // No judgement at all for an essay the student plainly wrote. The mark is not
  // awarded (criteria are unknown) but nor is it recorded as a zero the student
  // earned — the caller turns a missing judgement into a FAILED grade.
  const g = scoreTask(TASK.t2, undefined)
  assert.equal(g.zeroMark, null)
  assert.equal(g.band, 0)
})

test('a criterion the model omitted is filled from the others, not from 0', () => {
  const { criteria, filledIn } = resolveCriteria(
    ['task_achievement', 'grammar', 'vocabulary', 'coherence'] as const,
    { task_achievement: 7, grammar: 7, vocabulary: 7 },
  )
  assert.equal(criteria?.coherence, 7)
  assert.deepEqual(filledIn, ['coherence'])
})

test('an out-of-range criterion is discarded, not clamped into a mark', () => {
  const { criteria, filledIn } = resolveCriteria(
    ['task_achievement', 'grammar', 'vocabulary', 'coherence'] as const,
    { task_achievement: 7, grammar: 42, vocabulary: 7, coherence: 7 },
  )
  assert.equal(criteria?.grammar, 7)
  assert.deepEqual(filledIn, ['grammar'])
})

test('an entirely empty judgement gives no criteria at all', () => {
  const { criteria } = resolveCriteria(['task_achievement'] as const, {})
  assert.equal(criteria, null)
})

test('a zeroed task scores 0 points and carries no inline marking', () => {
  const g = scoreTask(
    TASK.t2,
    judged(crit(8), { offTopic: true, corrections: [{ quote: 'idea', type: 'grammar', suggestion: 'ideas' }] }),
  )
  assert.equal(g.band, 0)
  assert.equal(g.points, 0)
  assert.equal(g.zeroMark, 'off_topic')
  assert.equal(g.corrections.length, 0)
})

// ---------------------------------------------------------------------------
// Inline corrections.
// ---------------------------------------------------------------------------

test('a quote is located at its real offsets', () => {
  const text = 'I have went to the shop yesterday.'
  const at = locateQuote('have went', text)
  assert.deepEqual(at, { start: 2, end: 11 })
  assert.equal(text.slice(at.start, at.end), 'have went')
})

test('a quote tidied while copying still lands on the right words', () => {
  const text = "I don't  know  what to say."
  const at = locateQuote("don't know what", text)
  assert.ok(at)
  assert.equal(text.slice(at.start, at.end), "don't  know  what")
})

test('a quote that is not in the text is kept as feedback but not highlighted', () => {
  const out = resolveCorrections(
    [{ quote: 'words the student never wrote', type: 'grammar', suggestion: 'something else' }],
    'A completely different sentence.',
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].start, -1)
})

test('overlapping corrections are dropped, not nested', () => {
  const text = 'I have went to the shop.'
  const out = resolveCorrections(
    [
      { quote: 'have went', type: 'grammar', suggestion: 'went' },
      { quote: 'went to', type: 'grammar', suggestion: 'go to' },
    ],
    text,
  )
  assert.equal(out.length, 1)
})

test('a correction that changes nothing is discarded', () => {
  const out = resolveCorrections([{ quote: 'the shop', type: 'grammar', suggestion: 'the shop' }], 'the shop')
  assert.equal(out.length, 0)
})

test('a CAPITALISATION fix is a real correction, not a no-op', () => {
  // Found by rendering a sample paper: the no-op check compared through
  // `normalize`, which lowercases, so every proper-noun and sentence-case fix
  // was silently thrown away before it reached the student.
  const out = resolveCorrections(
    [{ quote: 'many english books', type: 'spelling', suggestion: 'many English books' }],
    'they have many english books here',
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].type, 'spelling')
  assert.ok(out[0].start > 0)
})

test('a quote respaced while being copied out is still a no-op', () => {
  const out = resolveCorrections(
    [{ quote: 'the  shop', type: 'grammar', suggestion: 'the shop' }],
    'I went to the  shop.',
  )
  assert.equal(out.length, 0)
})

test('an unknown correction type falls back rather than being dropped', () => {
  const out = resolveCorrections([{ quote: 'went', type: 'nonsense', suggestion: 'gone' }], 'I have went.')
  assert.equal(out[0].type, 'grammar')
})

// ---------------------------------------------------------------------------
// Whole attempts.
// ---------------------------------------------------------------------------

test('SKIPPING A TASK DOES NOT SHRINK THE DENOMINATOR', () => {
  // The essay left blank. Its 24 points are lost, not excused — otherwise
  // "skip the hard one" is the highest-scoring strategy on the paper.
  const blank: TaskIn = { ...TASK.t2, text: '' }
  const g = scoreAttempt([TASK.t11, TASK.t12, blank], [judged(crit(9)), judged(crit(9)), judged(crit(9))], 'full')
  assert.equal(g.maxRaw, 36)
  assert.equal(g.raw36, 12)
  assert.equal(g.tasks[2].zeroMark, 'blank')
  // Two perfect emails and no essay is 12/36 → 33/75. The essay IS the paper.
  assert.equal(g.rating, 33)
  assert.equal(g.band, 'below_B1')
})

test('a drill is an extrapolation, flagged as one', () => {
  const g = scoreAttempt([TASK.t12], [judged(crit(7))], 'part')
  assert.equal(g.estimate, true)
  // "If I wrote at band 7 across the whole paper" — raw 28 → 64, the same
  // number the full paper at band 7 gets. Nothing is scaled or invented.
  assert.equal(g.rating, 64)
  assert.equal(g.rating, estimateRatingFromBand(7))
})

test('a drill on the SHORT informal email is not punished for its task', () => {
  // The Speaking bug this mirrors: full marks on the easy part came out as B1
  // because the estimate was scaled from a task-bounded mark.
  const g = scoreAttempt([TASK.t11], [judged(crit(9))], 'part')
  assert.equal(g.rating, 75)
  assert.equal(g.band, 'C1')
})

test('judgements are matched by taskId, not by array order', () => {
  const g = scoreAttempt(
    [TASK.t11, TASK.t12],
    [{ taskId: 'b', criteria: crit(9) }, { taskId: 'a', criteria: crit(3) }],
    'full',
  )
  assert.equal(g.tasks[0].band, 3)
  assert.equal(g.tasks[1].band, 9)
})

test('word count matches what the exam screen showed the student', () => {
  assert.equal(wordCount('  one   two\nthree '), 3)
  assert.equal(wordCount('   '), 0)
})
