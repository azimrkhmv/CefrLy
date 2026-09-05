/**
 * REGRESSION TESTS FOR THE SPEAKING MARK.
 *
 * Every case here is a defect that reached a real student, numbered against
 * docs/SPEAKING-DEFECTS.md. Before this file existed, each fix was proved once
 * by hand against one paper whose audio was then deleted within seconds — so
 * nothing stopped the next change undoing it, and on 2026-09-03 something did,
 * twice in a row.
 *
 *   Run:  node --test supabase/functions/grade-speaking/
 *
 * Node 24 strips the types; no build step, no Deno, no network, no model. The
 * scoring functions are pure by design — keep them that way, and add a case
 * here the moment a new defect is found, BEFORE fixing it.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  allAtLeast,
  bandForRating,
  type CefrLevel,
  type Criterion,
  estimateRatingFromProfile,
  LEVEL_RANK,
  overallLevel,
  ratingForRaw,
  scoreBlock,
} from './rubric.ts'
import { MIN_ANSWER_WORDS, resolveOnTopic, verifyQuote } from './verify.ts'

const profile = (
  grammar: CefrLevel,
  vocabulary: CefrLevel = grammar,
  pronunciation: CefrLevel = grammar,
  fluency: CefrLevel = grammar,
  coherence: CefrLevel = grammar,
): Record<Criterion, CefrLevel> => ({
  grammar,
  vocabulary,
  pronunciation,
  fluency,
  coherence,
})

/** Gulmirasobirova's real Part 3 answer, attempt 6c207362, 2026-09-03. */
const REAL_Q8 =
  'There is a growing debate whether cars should be banned from city centers or not, ' +
  "so let's talk about for side. Firstly, it reduces traffic and makes the air cleaner " +
  'for everyone living there. Secondly, people would walk more and the streets would be ' +
  'safer for children. However, there is another side. Many workers depend on their cars ' +
  'to reach the centre early in the morning, and shops could lose customers who cannot ' +
  'carry heavy bags on a bus. In my opinion, a partial ban with good public transport is ' +
  'the fairest answer for both sides.'

const q8 = (over: Partial<Parameters<typeof resolveOnTopic>[0]> = {}) =>
  resolveOnTopic({ transcripts: [REAL_Q8], onTopic: [], offTopic: false, questionCount: 1, ...over })

// ---------------------------------------------------------------------------
// #27 — a fully answered block scored 0 because one quote would not match.
// 46/75 B1 for a paper that was 64/75 B2.
// ---------------------------------------------------------------------------

test('#27 an unmatched quote does not erase an answer that was spoken', () => {
  const r = q8({ onTopic: [{ quote: 'a quote that appears nowhere in her speech at all' }] })
  assert.equal(r.verifiedCount, 0)
  assert.equal(r.onTopicCount, 1, 'the speech is the evidence, not the quote')
  assert.equal(r.quoteAudit[0].verdict, 'rejected')
})

test('#27 the whole paper: B2 profile, everything answered, scores 64 not 46', () => {
  const p = profile('B2')
  const raw =
    scoreBlock({ block: 'q1_3', criteria: p, onTopicCount: 3, reason: '' }) +
    scoreBlock({ block: 'q4_6', criteria: p, onTopicCount: 3, reason: '' }) +
    scoreBlock({ block: 'q7', criteria: p, onTopicCount: 1, coverage: 'full', reason: '' }) +
    scoreBlock({
      block: 'q8',
      criteria: p,
      onTopicCount: 1,
      coverage: 'full',
      balanced: true,
      reason: '',
    })
  assert.equal(raw, 18)
  assert.equal(ratingForRaw(raw), 64)
  assert.equal(bandForRating(ratingForRaw(raw)), 'B2')
})

test('#27 a quote stitched across a gap still verifies', () => {
  const stitched = 'it reduces traffic and makes the air cleaner … shops could lose customers'
  assert.equal(verifyQuote(stitched, normalized(REAL_Q8)), 'fuzzy')
})

test('#27 a quote tidied by a word or two still verifies', () => {
  const tidied = 'many workers depend upon their cars to reach the centre early in the morning'
  assert.equal(verifyQuote(tidied, normalized(REAL_Q8)), 'fuzzy')
})

test('#27 case and punctuation never decide a mark', () => {
  assert.equal(verifyQuote('IT REDUCES TRAFFIC, AND MAKES THE AIR CLEANER!', normalized(REAL_Q8)), 'exact')
})

// ---------------------------------------------------------------------------
// #24 — the quote was checked against the wrong question's transcript.
// A C1 paper came out 35/75 Below B1.
// ---------------------------------------------------------------------------

test('#24 a quote is searched across the whole block, not one question', () => {
  const r = resolveOnTopic({
    transcripts: ['I love basketball because I played it at school every single week.', REAL_Q8],
    // Quote belongs to the SECOND transcript; the index it came with is worthless.
    onTopic: [{ quote: 'it reduces traffic and makes the air cleaner' }],
    offTopic: false,
    questionCount: 2,
  })
  assert.equal(r.verifiedCount, 1)
})

test('#24 one sentence cannot answer three questions', () => {
  const line = 'it reduces traffic and makes the air cleaner for everyone living there'
  const r = resolveOnTopic({
    transcripts: [REAL_Q8, REAL_Q8, REAL_Q8],
    onTopic: [{ quote: line }, { quote: line }, { quote: line }],
    offTopic: false,
    questionCount: 3,
  })
  assert.equal(r.verifiedCount, 1)
  assert.deepEqual(
    r.quoteAudit.map((q) => q.verdict),
    ['exact', 'duplicate', 'duplicate'],
  )
})

// ---------------------------------------------------------------------------
// THE RULE ITSELF — missing evidence lowers confidence, contradicted evidence
// zeroes. These are the cases that must hold however the model behaves.
// ---------------------------------------------------------------------------

test('silence scores 0 even when the model claims the question was answered', () => {
  const r = resolveOnTopic({
    transcripts: [''],
    onTopic: [{ quote: 'anything at all' }],
    offTopic: false,
    questionCount: 1,
  })
  assert.equal(r.onTopicCount, 0)
  assert.equal(r.basis, 'silence')
})

test('noise below the word floor is not an answer', () => {
  const r = resolveOnTopic({
    transcripts: ['um yeah okay so'],
    onTopic: [{ quote: 'um yeah okay so' }],
    offTopic: false,
    questionCount: 1,
  })
  assert.ok(4 < MIN_ANSWER_WORDS)
  assert.equal(r.onTopicCount, 0)
})

test('a declared off-topic answer scores 0, however fluent', () => {
  const r = q8({ offTopic: true, onTopic: [{ quote: 'it reduces traffic' }] })
  assert.equal(r.onTopicCount, 0)
  assert.equal(r.basis, 'declared_off_topic')
})

test('a MISSING offTopic field never zeroes a block', () => {
  const r = q8({ offTopic: undefined, onTopic: [{ quote: 'it reduces traffic' }] })
  assert.equal(r.onTopicCount, 1)
})

test('the model listing nothing, while there is speech, is a contradiction — take the speech', () => {
  const r = q8({ onTopic: [] })
  assert.equal(r.onTopicCount, 1)
  assert.equal(r.basis, 'speech_over_silence')
})

test('the model listing 2 of 3 is respected — no inflation to 3', () => {
  const three = ['a'.repeat(0) + REAL_Q8, REAL_Q8, REAL_Q8]
  const r = resolveOnTopic({
    transcripts: three,
    onTopic: [{ quote: 'nope one' }, { quote: 'nope two' }],
    offTopic: false,
    questionCount: 3,
  })
  assert.equal(r.onTopicCount, 2)
})

test('the count can never exceed the questions the block has', () => {
  const r = q8({
    onTopic: [{ quote: 'one' }, { quote: 'two' }, { quote: 'three' }, { quote: 'four' }],
  })
  assert.equal(r.onTopicCount, 1)
})

// ---------------------------------------------------------------------------
// #25 — the median discarded the two weakest criteria: A2 grammar and A2
// vocabulary behind a C1 surface scored a flawless 75/75.
// ---------------------------------------------------------------------------

test('#25 two criteria a level behind pull the reading down', () => {
  const uneven = profile('A2', 'A2', 'C1', 'C1', 'C1')
  assert.equal(overallLevel(uneven), LEVEL_RANK.B1, 'weakest + 1, not the median C1')
})

test('#25 one criterion lagging a level is free — good speakers are uneven', () => {
  assert.equal(overallLevel(profile('B2', 'C1', 'C1', 'C1', 'C1')), LEVEL_RANK.C1)
})

test('#25 a uniform profile reads as itself', () => {
  for (const l of ['A2', 'B1', 'B2', 'C1'] as CefrLevel[]) {
    assert.equal(overallLevel(profile(l)), LEVEL_RANK[l])
  }
})

test('#25 A2 grammar + A2 vocabulary behind a C1 surface is not a perfect paper', () => {
  const uneven = profile('A2', 'A2', 'C1', 'C1', 'C1')
  const raw =
    scoreBlock({ block: 'q1_3', criteria: uneven, onTopicCount: 3, reason: '' }) +
    scoreBlock({ block: 'q4_6', criteria: uneven, onTopicCount: 3, reason: '' }) +
    scoreBlock({ block: 'q7', criteria: uneven, onTopicCount: 1, coverage: 'full', reason: '' }) +
    scoreBlock({
      block: 'q8',
      criteria: uneven,
      onTopicCount: 1,
      coverage: 'full',
      balanced: true,
      reason: '',
    })
  assert.ok(ratingForRaw(raw) < 75, `expected below the ceiling, got ${ratingForRaw(raw)}`)
})

// ---------------------------------------------------------------------------
// #26 — "above B2" and "above C1" were awarded on the median alone.
// ---------------------------------------------------------------------------

test('#26 q7 top mark needs EVERY criterion at C1, not the median', () => {
  const medianC1 = profile('B2', 'C1', 'C1', 'C1', 'C1')
  assert.equal(overallLevel(medianC1), LEVEL_RANK.C1)
  assert.equal(allAtLeast(medianC1, LEVEL_RANK.C1), false)
  assert.equal(scoreBlock({ block: 'q7', criteria: medianC1, onTopicCount: 1, coverage: 'full', reason: '' }), 4)
  assert.equal(scoreBlock({ block: 'q7', criteria: profile('C1'), onTopicCount: 1, coverage: 'full', reason: '' }), 5)
})

test('#26 q8 six — the only route to 21/21 — is not automatic', () => {
  const medianC1 = profile('B2', 'C1', 'C1', 'C1', 'C1')
  const args = { onTopicCount: 1, coverage: 'full' as const, balanced: true, reason: '' }
  assert.equal(scoreBlock({ block: 'q8', criteria: medianC1, ...args }), 5)
  assert.equal(scoreBlock({ block: 'q8', criteria: profile('C1'), ...args }), 6)
})

test('#26 a one-sided argument caps q8 at 4, however good the English', () => {
  assert.equal(
    scoreBlock({
      block: 'q8',
      criteria: profile('C1'),
      onTopicCount: 1,
      coverage: 'full',
      balanced: false,
      reason: '',
    }),
    4,
  )
})

// ---------------------------------------------------------------------------
// #12 / #15 — a drill scored 75/75 C1 off Part 1.1; the cap that fixed it then
// told a B2 speaker he was B1.
// ---------------------------------------------------------------------------

test('#12 full marks on three easy A2-anchored questions is not a C1 exam score', () => {
  const r = estimateRatingFromProfile(profile('B2'), {
    onTopicCount: 3,
    questionCount: 3,
    block: 'q1_3',
  })
  assert.ok(r < 65, `a B2 speaker must not be shown C1, got ${r}`)
})

test('#15 a B2 speaker answering everything is shown B2, not B1', () => {
  const r = estimateRatingFromProfile(profile('B2'), {
    onTopicCount: 3,
    questionCount: 3,
    block: 'q1_3',
  })
  assert.equal(bandForRating(r), 'B2', `got ${r}`)
})

test('#15 questions not answered cost the estimate', () => {
  const all = estimateRatingFromProfile(profile('B2'), {
    onTopicCount: 3,
    questionCount: 3,
    block: 'q1_3',
  })
  const one = estimateRatingFromProfile(profile('B2'), {
    onTopicCount: 1,
    questionCount: 3,
    block: 'q1_3',
  })
  assert.ok(one < all)
})

// ---------------------------------------------------------------------------
// #05 — the denominator shrank when a part was skipped. The rating table is
// the exam's own; it is not ours to interpolate.
// ---------------------------------------------------------------------------

test('#05 the rating table is exact at both ends and never exceeds 75', () => {
  assert.equal(ratingForRaw(21), 75)
  assert.equal(ratingForRaw(0), 0)
  assert.equal(ratingForRaw(99), 75)
  assert.equal(ratingForRaw(-5), 0)
})

test('#05 the table never goes backwards as the raw score rises', () => {
  let previous = -1
  for (let raw = 0; raw <= 21; raw += 0.5) {
    const r = ratingForRaw(raw)
    assert.ok(r >= previous, `rating fell at raw ${raw}`)
    previous = r
  }
})

test('band thresholds sit where the agency chart puts them', () => {
  assert.equal(bandForRating(37), 'below_B1')
  assert.equal(bandForRating(38), 'B1')
  assert.equal(bandForRating(49), 'B1')
  assert.equal(bandForRating(50), 'B2')
  assert.equal(bandForRating(64), 'B2')
  assert.equal(bandForRating(65), 'C1')
})

// ---------------------------------------------------------------------------
// Whole-block sanity: nothing may score above its own maximum, and a block with
// answers on topic may never score 0.
// ---------------------------------------------------------------------------

test('no block can exceed its maximum, at any profile', () => {
  const max = { q1_3: 5, q4_6: 5, q7: 5, q8: 6 } as const
  for (const level of ['below_A2', 'A2', 'B1', 'B2', 'C1'] as CefrLevel[]) {
    for (const [block, cap] of Object.entries(max)) {
      for (const on of [0, 1, 2, 3]) {
        const s = scoreBlock({
          block: block as keyof typeof max,
          criteria: profile(level),
          onTopicCount: on,
          coverage: 'full',
          balanced: true,
          reason: '',
        })
        assert.ok(s >= 0 && s <= cap, `${block} ${level} on=${on} -> ${s}`)
      }
    }
  }
})

test('a block with something on topic scores 0 only below B1 on the long turns', () => {
  for (const block of ['q1_3', 'q4_6', 'q8'] as const) {
    for (const level of ['A2', 'B1', 'B2', 'C1'] as CefrLevel[]) {
      const s = scoreBlock({
        block,
        criteria: profile(level),
        onTopicCount: 1,
        coverage: 'full',
        balanced: true,
        reason: '',
      })
      assert.ok(s > 0, `${block} at ${level} with an answer on topic scored 0`)
    }
  }
})

function normalized(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
