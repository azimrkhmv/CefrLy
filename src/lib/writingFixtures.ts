import type { WritingTaskType } from '../types/test'

// ---------------------------------------------------------------------------
// Per-task constants for Writing: labels, blurbs, word targets and timings.
//
// The papers themselves are NOT here — they are built from the samples library
// (see writingFromSamples.ts), so the admin console can publish a paper without
// a code deploy. The placeholder papers this file used to carry were deleted
// when that landed. What remains is what a paper cannot supply.
// ---------------------------------------------------------------------------

const min = (m: number) => m * 60

export const TASK_LABEL: Record<WritingTaskType, string> = {
  task_1_1: 'Task 1.1',
  task_1_2: 'Task 1.2',
  part_2: 'Task 2',
}

/** Short human hint of what each task type is (used on the Add-Custom tile etc.). */
export const TASK_BLURB: Record<WritingTaskType, string> = {
  task_1_1: 'Informal email · ~50 words',
  task_1_2: 'Formal email · ~120–150 words',
  part_2: 'Forum post / article · ~250 words',
}

/** Default duration + word target per task type — used when a student adds a
 *  custom question (they only supply the prompt, not the timing). */
export const TASK_DEFAULTS: Record<
  WritingTaskType,
  { durationSec: number; minWords: number; maxWords?: number; level: 'B1' | 'B2' | 'C1' }
> = {
  task_1_1: { durationSec: min(12), minWords: 50, level: 'B1' },
  task_1_2: { durationSec: min(20), minWords: 120, maxWords: 150, level: 'B2' },
  part_2: { durationSec: min(30), minWords: 250, level: 'C1' },
}

/** The example placeholder shown in the custom-question textarea per task type. */
export const TASK_EXAMPLE: Record<WritingTaskType, string> = {
  task_1_1:
    'Example:\nYou have just moved to a new city. Write an informal email to your friend.\n\n• say where you moved\n• describe your new home\n• invite them to visit',
  task_1_2:
    'Example:\nYou want to complain about a service you received. Write a formal email to the manager.\n\n• explain what happened\n• say how it affected you\n• state what you expect them to do',
  part_2:
    'Example:\nYou have seen this comment on a forum: "Exams are the best way to measure learning."\n\nWrite a forum post giving your opinion, with reasons and examples.',
}
