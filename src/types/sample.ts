// The Writing/Speaking sample library (model answers for the two skills we
// don't test yet). Rows live in the `samples` table; published rows are read
// DIRECTLY under RLS — unlike tests, a sample has no answer key to protect.
// Authoring goes through the admin-samples edge function, whose validator
// (supabase/functions/admin-samples/validate.ts) mirrors these shapes.
//
// Structure follows the real Multilevel exam:
//   Writing — Part 1 shares one scenario, split into Task 1.1 (informal email,
//   B1) and Task 1.2 (formal email, B2); Part 2 is a forum post/article (C1).
//   Speaking — Part 1.1 interview, Part 1.2 photo comparison, Part 2 photo
//   talk, Part 3 for/against discussion — EACH its own category (mirroring the
//   writing split), grouped under the Speaking skill in a two-tier tab strip.

export type SampleSkill = 'writing' | 'speaking'

export type SampleCategory =
  | 'writing1_1'
  | 'writing1_2'
  | 'writing2'
  | 'speaking1_1'
  | 'speaking1_2'
  | 'speaking2'
  | 'speaking3'

/** Every sample category in exam order — the single list the /samples tabs and
 *  the admin editor both build on. `skill` groups them for the two-tier tab
 *  strip; `partLabel` is the short sub-tab caption; `label` is the full name.
 *  Speaking categories use dialogue turns for `model` (usesTurns); writing ones
 *  use string paragraphs. */
export const SAMPLE_CATEGORIES: {
  key: SampleCategory
  skill: SampleSkill
  label: string
  partLabel: string
  badgeHint: string
  usesTurns: boolean
}[] = [
  { key: 'writing1_1', skill: 'writing', label: 'Writing · Task 1.1', partLabel: 'Task 1.1', badgeHint: 'Task 1.1 · Informal email', usesTurns: false },
  { key: 'writing1_2', skill: 'writing', label: 'Writing · Task 1.2', partLabel: 'Task 1.2', badgeHint: 'Task 1.2 · Formal email', usesTurns: false },
  { key: 'writing2', skill: 'writing', label: 'Writing · Part 2', partLabel: 'Part 2', badgeHint: 'Part 2 · Forum post', usesTurns: false },
  { key: 'speaking1_1', skill: 'speaking', label: 'Speaking · Part 1.1', partLabel: 'Part 1.1', badgeHint: 'Part 1.1 · Interview', usesTurns: true },
  { key: 'speaking1_2', skill: 'speaking', label: 'Speaking · Part 1.2', partLabel: 'Part 1.2', badgeHint: 'Part 1.2 · Photo comparison', usesTurns: true },
  { key: 'speaking2', skill: 'speaking', label: 'Speaking · Part 2', partLabel: 'Part 2', badgeHint: 'Part 2 · Photo talk', usesTurns: true },
  { key: 'speaking3', skill: 'speaking', label: 'Speaking · Part 3', partLabel: 'Part 3', badgeHint: 'Part 3 · For & against', usesTurns: true },
]

export const SAMPLE_SKILLS: { key: SampleSkill; label: string }[] = [
  { key: 'writing', label: 'Writing' },
  { key: 'speaking', label: 'Speaking' },
]

export const sampleCategoryLabel = (c: SampleCategory): string =>
  SAMPLE_CATEGORIES.find((x) => x.key === c)?.label ?? c

/** Which skill a category belongs to (drives the two-tier tabs + card dressing). */
export const sampleSkill = (c: SampleCategory): SampleSkill =>
  SAMPLE_CATEGORIES.find((x) => x.key === c)?.skill ?? 'writing'

/** True when `model` is dialogue turns (all speaking categories) vs paragraphs. */
export const sampleUsesTurns = (c: SampleCategory): boolean =>
  SAMPLE_CATEGORIES.find((x) => x.key === c)?.usesTurns ?? false

export interface SpeakingTurn {
  speaker: string
  text: string
}

/** A prompt image — the photo(s) a Speaking task asks the student to describe or
 *  compare, or (for other formats) a chart/map. `assetPath` is an object path in
 *  the public `images` Storage bucket; resolve it with imageUrl(). */
export interface SampleImage {
  assetPath: string
  alt: string
  /** Optional short label shown under the image, e.g. "Photo A". */
  caption?: string
}

/** A glossary entry — the useful word/phrase from the model answer, its meaning,
 *  and (optionally) the Uzbek translation, exactly as the source papers present. */
export interface VocabItem {
  term: string
  meaning: string
  /** Uzbek gloss, shown muted after the meaning. */
  uz?: string
}

export interface SampleContent {
  task: string[]
  bullets?: string[]
  /** Prompt visuals: the photo(s) a Speaking task describes/compares. Absent for
   *  text-only tasks (emails, forum posts, interview questions). */
  images?: SampleImage[]
  note: string
  /** Writing: paragraphs. Speaking: dialogue/monologue turns. */
  model: string[] | SpeakingTurn[]
  /** Optional vocabulary glossary (word + meaning, with Uzbek) from the sample. */
  vocab?: VocabItem[]
  /** Optional "why this scores well" analysis. Absent for bulk-ingested samples
   *  where only the model answer + glossary are carried from the source paper. */
  why?: string[]
}

export interface Sample {
  id: string
  slug: string
  category: SampleCategory
  badge: string
  title: string
  content: SampleContent
}
