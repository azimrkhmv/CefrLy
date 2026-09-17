import type { Sample, SampleCategory } from '../types/sample'
import type { WritingTask, WritingTaskType, WritingTest } from '../types/test'
import { TASK_DEFAULTS, TASK_LABEL } from './writingFixtures'

// ---------------------------------------------------------------------------
// The writing papers are BUILT FROM THE SAMPLES LIBRARY, exactly like Speaking
// (speakingFromSamples.ts). They used to be a hard-coded fixtures file of
// placeholder prompts, so every new paper was a code deploy; now publishing a
// writing sample in the admin console publishes a writing paper.
//
// Only the QUESTION side is read (the `sample_prompts` view), so free students
// get the papers while the model answers stay paid.
//
// HOW PAPERS ARE GROUPED: the samples table has no "paper" column, so
// sort_order is the link. Writing paper N = the writing1_1, writing1_2 and
// writing2 samples whose sort_order is N — Task 1.1 and 1.2 share one scenario
// in the real exam, and matching sort_orders is how the admin says so. Every
// sample is also its own single-task drill; an incomplete set yields drills
// only, never a mock.
// ---------------------------------------------------------------------------

const TASK_OF: Partial<Record<SampleCategory, WritingTaskType>> = {
  writing1_1: 'task_1_1',
  writing1_2: 'task_1_2',
  writing2: 'part_2',
}

const PART_NUMBER: Record<WritingTaskType, 1 | 2 | 3> = {
  task_1_1: 1,
  task_1_2: 2,
  part_2: 3,
}

/** The official paper clock: 60 minutes for all three tasks. */
const MOCK_DURATION_SEC = 60 * 60

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A line wholly in quotes is the message/comment the student responds to. */
const isQuoted = (s: string) => /^\s*["“].*["”]\s*$/s.test(s)

function promptHtml(sample: Sample): string {
  const paras = sample.content.task.map((t) =>
    isQuoted(t) ? `<blockquote>${esc(t)}</blockquote>` : `<p>${esc(t)}</p>`,
  )
  const bullets = sample.content.bullets?.length
    ? `<ul>${sample.content.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
    : ''
  return paras.join('') + bullets
}

function toTask(sample: Sample, taskType: WritingTaskType, id: string): WritingTask {
  const d = TASK_DEFAULTS[taskType]
  return {
    id,
    taskType,
    label: TASK_LABEL[taskType],
    minWords: d.minWords,
    maxWords: d.maxWords,
    prompt: { title: sample.title, html: promptHtml(sample) },
  }
}

export function writingTestsFromSamples(samples: Sample[]): WritingTest[] {
  const drills: WritingTest[] = []
  const byPaper = new Map<number, Partial<Record<WritingTaskType, Sample>>>()

  // Drills come out in exam order (1.1, 1.2, Part 2), each task by sort_order.
  const ordered = samples
    .filter((s) => TASK_OF[s.category])
    .sort(
      (a, b) =>
        PART_NUMBER[TASK_OF[a.category]!] - PART_NUMBER[TASK_OF[b.category]!] ||
        (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity),
    )

  for (const sample of ordered) {
    const taskType = TASK_OF[sample.category]
    if (!taskType || sample.content.task.length === 0) continue
    const d = TASK_DEFAULTS[taskType]

    drills.push({
      id: `writing-${sample.slug}`,
      skill: 'writing',
      title: sample.title,
      targetLevels: [d.level],
      durationSec: d.durationSec,
      scope: 'part',
      partNumber: PART_NUMBER[taskType],
      tasks: [toTask(sample, taskType, `writing-${sample.slug}-t`)],
    })

    const n = sample.sort_order
    if (n == null) continue
    const set = byPaper.get(n) ?? {}
    // Two samples of one task type on the same number: the first one wins.
    set[taskType] ??= sample
    byPaper.set(n, set)
  }

  const mocks: WritingTest[] = []
  for (const n of [...byPaper.keys()].sort((a, b) => a - b)) {
    const set = byPaper.get(n)!
    const t11 = set.task_1_1
    const t12 = set.task_1_2
    const p2 = set.part_2
    if (!t11 || !t12 || !p2) continue // an incomplete paper is not a mock
    // `writing-paper-N`, not the old fixture id `writing-mock-1`, so a draft left
    // over from the placeholder paper can never restore into a different prompt.
    const id = `writing-paper-${n}`
    mocks.push({
      id,
      skill: 'writing',
      title: `CEFR Writing Mock ${n}`,
      targetLevels: ['B1', 'B2', 'C1'],
      durationSec: MOCK_DURATION_SEC,
      scope: 'full',
      tasks: [
        toTask(t11, 'task_1_1', `${id}-t1`),
        toTask(t12, 'task_1_2', `${id}-t2`),
        toTask(p2, 'part_2', `${id}-t3`),
      ],
    })
  }

  return [...mocks, ...drills]
}
