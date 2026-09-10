// Run with:  node --test src/lib/speakingNotes.test.ts
//
// The note sheet's fields are not decoration — they are shaped to what the mark
// scheme counts, so a change to the shape is a change to what the student is
// nudged to prepare. These pin that shape.
import test from 'node:test'
import assert from 'node:assert/strict'

import { fieldsFor } from './speakingNotes.ts'
import type { SpeakingStep } from './speakingQuestions'

const step = (partType: string, text: string, debate?: unknown): SpeakingStep =>
  ({ id: 's1', task: { partType, debate }, question: { text } }) as unknown as SpeakingStep

const P2_THREE = [
  'Tell me about a critical decision you have made.',
  'How has this decision influenced you and your life?',
  'What factors have the highest impact on the decisions people make?',
].join('\n')

test('the short-answer parts get no note sheet', () => {
  // Parts 1.1 and 1.2 are answered on the spot with 5-10 seconds of preparation.
  // A notes box there would be an invitation to write instead of speak.
  assert.equal(fieldsFor(step('part_1_1', 'Where do you live?')), null)
  assert.equal(fieldsFor(step('part_1_2', 'Compare these two photographs.')), null)
})

test('Part 2 gets one line per prompt, numbered to match the question card', () => {
  // The block is scored by HOW MANY prompts were addressed, so an empty line is
  // a visible warning that a mark is about to be dropped.
  const fields = fieldsFor(step('part_2', P2_THREE))
  assert.ok(fields)
  assert.deepEqual(
    fields.map((f) => f.key),
    ['n1', 'n2', 'n3'],
  )
  assert.equal(fields[0].label, '1. Tell me about a critical decision you have made.')
  assert.equal(fields[2].label.startsWith('3. What factors'), true)
})

test('a single-prompt Part 2 gets one plain box, not a numbered list of one', () => {
  const fields = fieldsFor(step('part_2', 'Describe a place that means a lot to you.'))
  assert.ok(fields)
  assert.equal(fields.length, 1)
  assert.equal(fields[0].label, 'Notes')
})

test('Part 3 gets For, Against and a view — the three things it is marked on', () => {
  // 4 marks needs BOTH sides covered, 3 covers only one, and 5 needs them
  // argued in balance. The task then asks what the candidate thinks.
  const fields = fieldsFor(
    step('part_3', 'Give arguments for and against this, then say what you think.', {
      statement: 'Citizens should be allowed to carry personal guns.',
      for: ['self-defence'],
      against: ['accidents'],
    }),
  )
  assert.ok(fields)
  assert.deepEqual(
    fields.map((f) => f.key),
    ['for', 'against', 'view'],
  )
})

test('Part 3 still gets its sheet when the paper printed no suggested points', () => {
  // 23 of the 24 papers keep their points inside the prompt IMAGE, so `debate`
  // arrives with empty lists. The sheet must not vanish with them.
  const fields = fieldsFor(
    step('part_3', 'Give arguments for and against this.', {
      statement: 'X',
      for: [],
      against: [],
    }),
  )
  assert.ok(fields)
  assert.equal(fields.length, 3)
})

test('every field has a stable key, a label and a placeholder', () => {
  // The key is the storage id: change one and a student mid-attempt loses that
  // note on the next render.
  for (const s of [step('part_2', P2_THREE), step('part_3', 'For and against.')]) {
    for (const f of fieldsFor(s) ?? []) {
      assert.match(f.key, /^[a-z0-9]+$/, `key "${f.key}" must be storage-safe`)
      assert.ok(f.label.trim().length > 0)
      assert.ok(f.placeholder.trim().length > 0)
      assert.ok(f.rows >= 2)
    }
  }
})
