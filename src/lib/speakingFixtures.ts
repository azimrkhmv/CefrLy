import type { SpeakingPartType } from '../types/test'

// ---------------------------------------------------------------------------
// Per-part constants for Speaking: labels, blurbs and THE EXAM CLOCK.
//
// The papers themselves are NOT here — they are built from the samples library
// (see speakingFromSamples.ts), which already holds the owner's real Multilevel
// tests with their photos. The placeholder papers this file used to carry were
// deleted once the real ones landed. What remains is what a paper cannot supply:
// the fixed timings, and the copy shown when a student writes their own prompt.
// ---------------------------------------------------------------------------

export const PART_LABEL: Record<SpeakingPartType, string> = {
  part_1_1: 'Part 1.1',
  part_1_2: 'Part 1.2',
  part_2: 'Part 2',
  part_3: 'Part 3',
}

/** Short human hint of what each part is (used on the Add-Custom tile etc.). */
export const PART_BLURB: Record<SpeakingPartType, string> = {
  part_1_1: 'Interview · 3 questions · 30s each',
  part_1_2: 'Photo comparison · 3 questions',
  part_2: 'Talk on a topic · 1 min prep · 2 min',
  part_3: 'For & against · 1 min prep · 2 min',
}

// ---------------------------------------------------------------------------
// THE EXAM CLOCK IS RIGID. These are the real Multilevel timings, not defaults
// anyone may tune:
//   Part 1.1 — 3 questions, 5s prep + 30s speaking each
//   Part 1.2 — Q1 10s prep (look at the photos) + 45s; Q2 & Q3 5s + 30s
//   Part 2   — 60s prep + 120s
//   Part 3   — 60s prep + 120s
// The per-part values below are the DEFAULT for every question in that part;
// Part 1.2's opening question overrides them on the question itself.
// ---------------------------------------------------------------------------
export const PART_DEFAULTS: Record<
  SpeakingPartType,
  { prepSec: number; speakSec: number; durationSec: number; level: 'B1' | 'B2' | 'C1' }
> = {
  part_1_1: { prepSec: 5, speakSec: 30, durationSec: 3 * (5 + 30), level: 'B1' },
  part_1_2: { prepSec: 5, speakSec: 30, durationSec: 10 + 45 + 2 * (5 + 30), level: 'B2' },
  part_2: { prepSec: 60, speakSec: 120, durationSec: 60 + 120, level: 'B2' },
  part_3: { prepSec: 60, speakSec: 120, durationSec: 60 + 120, level: 'C1' },
}

/** Part 1.2's first question is the comparison itself: longer look, longer turn. */
export const PART_1_2_OPENING = { prepSec: 10, speakSec: 45 }

/** The example placeholder shown in the custom-question textarea per part. */
export const PART_EXAMPLE: Record<SpeakingPartType, string> = {
  part_1_1:
    'Example:\nAnswer these questions about your home town.\n\n• Where do you live?\n• What do you like most about it?\n• How has it changed in recent years?',
  part_1_2:
    'Example:\nCompare and contrast these two photos.\n\n• say what is happening in each\n• explain how they are similar and different\n• say which situation you would prefer',
  part_2:
    'Example:\nTalk about a skill you would like to learn.\n\n• say what the skill is\n• explain why you want to learn it\n• describe how you would start',
  part_3:
    'Example:\nSome people think university education should be free for everyone.\n\nGive arguments for and against this opinion, then say what you think.',
}
