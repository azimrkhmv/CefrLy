// Item schema v2 — see project context. The FULL types (with `answer` /
// `explanation`, and for listening `transcript`) exist server-side only; the
// browser must only ever receive the Sanitized* shapes before a test is
// submitted.
//
// Two skills share this file:
//   * reading  — 5 parts, layouts cloze_from_text / match_texts / match_headings
//                / passage_questions; item types gap | match | mcq | tfng.
//   * listening — 6 parts, layouts mcq_response / form_completion / matching /
//                map_labelling / multi_extract_mcq / note_completion; item types
//                gap | match | mcq (never tfng). Audio + a Part 4 map image.
// The `mcq` / `match` / `gap` item types are shared between both skills.

export type CefrLevel = 'B1' | 'B2' | 'C1'
export type Band = 'C1' | 'B2' | 'B1' | 'below_B1'
export type Skill = 'reading' | 'listening' | 'writing' | 'speaking'
/** 'full' = the whole rigid mock paper; 'part' = exactly ONE canonical part of
 *  it (same layout/count rules), powering practice-by-part. */
export type TestScope = 'full' | 'part'

export type ReadingPartLayout =
  | 'cloze_from_text'
  | 'match_texts'
  | 'match_headings'
  | 'passage_questions'

export type ListeningPartLayout =
  | 'mcq_response'
  | 'form_completion'
  | 'matching'
  | 'map_labelling'
  | 'multi_extract_mcq'
  | 'note_completion'

export type PartLayout = ReadingPartLayout | ListeningPartLayout

export type ItemType = 'gap' | 'match' | 'mcq' | 'tfng'
export type PartNumber = 1 | 2 | 3 | 4 | 5
export type ListeningPartNumber = 1 | 2 | 3 | 4 | 5 | 6

export interface Explanation {
  location: string
  quote: string
  reasoning: string
}

export interface OptionRef {
  key: string
  label: string
}

export interface Passage {
  title?: string
  /** May contain {{itemId}} gap markers. */
  html?: string
  paragraphs?: { label: string; html: string }[]
}

/** Listening audio for a part (per_part mode) or the whole section (single mode). */
export interface AudioAsset {
  /** Object path inside the `audio` storage bucket. */
  assetPath: string
  /** How many times the recording may be played (real exams: 2). */
  playLimit: number
  /** Seconds to preview the questions before the first play unlocks. */
  previewSec: number
}

/** Listening map/plan image for Part 4 (map_labelling). */
export interface ImageAsset {
  /** Object path inside the `images` storage bucket. */
  assetPath: string
  alt: string
}

/** Notes/form body for form_completion & note_completion; html holds {{itemId}} markers. */
export interface Stem {
  title?: string
  html: string
}

// ---------------------------------------------------------------------------
// Full item shapes (server-side only pre-submit). Shared across skills.
// `number` is the global 1–35 question number (set for listening).
// ---------------------------------------------------------------------------

export interface GapItem {
  id: string
  type: 'gap'
  points: 1
  number?: number
  /** Accepted spellings; a typed answer matches if it normalizes to any of these. */
  answer: string[]
  caseSensitive?: false
  explanation: Explanation
}

export interface MatchItem {
  id: string
  type: 'match'
  points: 1
  number?: number
  /** e.g. a short text (reading), "Speaker 1" or a place name (listening). */
  prompt: string
  /** An optionPool key. */
  answer: string
  explanation: Explanation
}

export interface McqItem {
  id: string
  type: 'mcq'
  points: 1
  number?: number
  /** Optional: listening Part 1 (mcq_response) has no written prompt — the audio is the prompt. */
  prompt?: string
  options: OptionRef[]
  answer: string
  explanation: Explanation
}

export interface TfngItem {
  id: string
  type: 'tfng'
  points: 1
  number?: number
  prompt: string
  thirdOptionLabel: 'Not Given' | 'No Information'
  answer: 'true' | 'false' | 'not_given'
  explanation: Explanation
}

export type Item = GapItem | MatchItem | McqItem | TfngItem
/** Listening uses only these three (no tfng). */
export type ListeningItem = GapItem | MatchItem | McqItem

/** One extract of a multi_extract_mcq part (Part 5): a context line + its items. */
export interface Group {
  id: string
  /** The extract's intro/context line, shown above its questions. */
  context: string
  items: Item[]
}

// ---------------------------------------------------------------------------
// Reading parts / test
// ---------------------------------------------------------------------------

export interface Part {
  id: string
  number: PartNumber
  layout: ReadingPartLayout
  instructions: string
  passage?: Passage
  /** Parts 2 & 3: shared options. */
  optionPool?: OptionRef[]
  /** Ordered; render in this exact order. */
  items: Item[]
}
export type ReadingPart = Part

export interface ReadingTest {
  id: string
  skill: 'reading'
  title: string
  targetLevels: CefrLevel[]
  durationSec: number
  /** 'part' marks a single-part drill; parts then holds exactly that one part. */
  scope?: TestScope
  partNumber?: number | null
  parts: Part[]
}

// ---------------------------------------------------------------------------
// Listening parts / test
// ---------------------------------------------------------------------------

export interface ListeningPart {
  id: string
  number: ListeningPartNumber
  layout: ListeningPartLayout
  instructions: string
  /** REQUIRED per part when the test's audioMode is 'per_part'. */
  audio?: AudioAsset
  /** REQUIRED for map_labelling (Part 4). */
  image?: ImageAsset
  /** matching & map_labelling: the letters/labels to match against (with extras). */
  optionPool?: OptionRef[]
  /** form_completion & note_completion: notes/form body with {{itemId}} markers. */
  stem?: Stem
  /** multi_extract_mcq (Part 5): one group per extract. */
  groups?: Group[]
  /** Every layout that doesn't use groups. */
  items?: Item[]
  /** SERVER-ONLY — the recording transcript. Stripped by get-test. */
  transcript?: string
}

export interface ListeningTest {
  id: string
  skill: 'listening'
  title: string
  targetLevels: CefrLevel[]
  durationSec: number
  /** 'part' marks a single-part drill; parts then holds exactly that one part. */
  scope?: TestScope
  partNumber?: number | null
  /** How audio is supplied: one file per part, or one file for the whole section. */
  audioMode: 'per_part' | 'single'
  /** REQUIRED iff audioMode === 'single'. */
  singleAudio?: AudioAsset
  parts: ListeningPart[]
}

// ---------------------------------------------------------------------------
// Writing test (Phase 4) — the Multilevel writing paper: two emails + a forum
// post. Unlike Reading/Listening there are NO gradable items and no answer key;
// a task carries a prompt (+ an OPTIONAL image) the student writes against. The
// `rubric` / `modelAnswer` are SERVER-ONLY (for a later grader) and get stripped
// before the browser sees the task — same isolation rule as answers/transcripts.
// NOTE: Writing is deliberately kept OUT of AnyTest / SanitizedTest — it does not
// route through the graded get-test / submit-test spine (see Phase 4 PRD).
// ---------------------------------------------------------------------------

/** 1.1 = informal email (B1) · 1.2 = formal email (B2) · Part 2 = forum post (C1). */
export type WritingTaskType = 'task_1_1' | 'task_1_2' | 'part_2'

export interface WritingTaskPrompt {
  title?: string
  /** The writing instruction; may hold rich prose (rendered in a .passage). */
  html: string
}

export interface WritingTaskImage {
  /** A directly-usable image URL (public path, storage URL, or object URL).
   *  Optional context art only — the Multilevel writing format has no charts. */
  src: string
  alt: string
  caption?: string
}

export interface WritingTask {
  id: string
  taskType: WritingTaskType
  /** Short display label, e.g. "Task 1.1", "Part 2". */
  label: string
  /** Drives the "Write at least N words" guidance + the word-count colour. */
  minWords: number
  maxWords?: number
  prompt: WritingTaskPrompt
  /** OPTIONAL — never required (no IELTS-style chart to describe). */
  image?: WritingTaskImage
  /** Author pick — renders the brand "Recommended" badge on the card. */
  recommended?: boolean
  /** SERVER-ONLY (future grader) — never delivered to the browser. */
  rubric?: string
  modelAnswer?: string[]
}

export interface WritingTest {
  id: string
  skill: 'writing'
  title: string
  targetLevels: CefrLevel[]
  /** Author-set; drives the countdown on the writing screen. */
  durationSec: number
  /** 'full' = the Mock Test (up to 3 tasks); 'part' = a single-task drill. */
  scope?: TestScope
  /** iff scope='part': 1→Task 1.1, 2→Task 1.2, 3→Part 2. */
  partNumber?: 1 | 2 | 3 | null
  /** full = ordered tasks (1.1, 1.2, Part 2); part = exactly one. */
  tasks: WritingTask[]
}

// ---------------------------------------------------------------------------
// Speaking test (Phase 5) — the Multilevel speaking paper: interview, photo
// comparison, a talk on a topic, and a for/against discussion. Like Writing
// there is NO answer key: a part carries a prompt (+ OPTIONAL photos) the
// student speaks against, with a prep window and a speaking window. The
// `rubric` / `modelAnswer` are SERVER-ONLY (for a later grader) and get
// stripped before the browser sees the part — same isolation rule as Writing.
// NOTE: Speaking is deliberately kept OUT of AnyTest / SanitizedTest — it does
// not route through the graded get-test / submit-test spine.
// ---------------------------------------------------------------------------

/** 1.1 = interview (B1) · 1.2 = photo comparison (B2) · 2 = topic talk (B2) ·
 *  3 = for & against (C1). */
export type SpeakingPartType = 'part_1_1' | 'part_1_2' | 'part_2' | 'part_3'

export interface SpeakingPrompt {
  title?: string
  /** The speaking instruction; may hold rich prose (rendered in a .passage). */
  html: string
}

export interface SpeakingImage {
  /** A directly-usable image URL (public path, storage URL, or object URL). */
  src: string
  alt: string
  caption?: string
}

/** One question the student answers with one recording.
 *
 *  A bare string is still accepted (the fixtures and every custom question the
 *  student writes use that form) and is normalised to `{ text }` — see
 *  `taskQuestions()` in lib/speakingQuestions. */
export interface SpeakingQuestion {
  text: string
  /** Authored recording of an examiner reading this question aloud (storage
   *  path or URL). When absent the browser speaks `text` instead. Custom
   *  questions can never have one, which is why the fallback is not optional. */
  audio?: string
  /** Per-question clock overrides. The exam's timings are rigid but NOT uniform
   *  inside a part — Part 1.2 gives 10s/45s to look at the photos and compare
   *  them, then 5s/30s for each follow-up. Absent = inherit the task's values. */
  prepSec?: number
  speakSec?: number
}

export interface SpeakingTask {
  id: string
  partType: SpeakingPartType
  /** Short display label, e.g. "Part 1.1", "Part 3". */
  label: string
  prompt: SpeakingPrompt
  /** The questions asked in this task, answered ONE AT A TIME — each gets its
   *  own recording. Parts with a single long turn carry exactly one entry (or
   *  none, in which case the prompt itself is the question). */
  questions?: (string | SpeakingQuestion)[]
  /** OPTIONAL photos — required in spirit for Part 1.2 (compare two). */
  images?: SpeakingImage[]
  /** Default silent preparation window before EACH question's recording starts
   *  (0 = record at once). A question may override it. */
  prepSec: number
  /** Default speaking window for EACH question, in seconds. Hard: the recorder
   *  stops itself when it runs out. A question may override it. */
  speakSec: number
  /** Author pick — renders the brand "Recommended" badge on the card. */
  recommended?: boolean
  /** SERVER-ONLY (future grader) — never delivered to the browser. */
  rubric?: string
  modelAnswer?: string[]
}

export interface SpeakingTest {
  id: string
  skill: 'speaking'
  title: string
  targetLevels: CefrLevel[]
  /** Author-set total; drives the countdown on the speaking screen. */
  durationSec: number
  /** 'full' = the Mock Test (4 parts); 'part' = a single-part drill. */
  scope?: TestScope
  /** iff scope='part': 1→Part 1.1, 2→Part 1.2, 3→Part 2, 4→Part 3. */
  partNumber?: 1 | 2 | 3 | 4 | null
  /** full = ordered parts (1.1, 1.2, 2, 3); part = exactly one. */
  tasks: SpeakingTask[]
}

/** Either skill's full test (server-side). */
export type AnyTest = ReadingTest | ListeningTest

// ---------------------------------------------------------------------------
// Sanitized shapes — what the get-test edge function returns to the browser.
// `answer` and `explanation` are stripped from every item; for listening the
// per-part `transcript` is stripped too.
// ---------------------------------------------------------------------------

export type SanitizedGapItem = Omit<GapItem, 'answer' | 'explanation'>
export type SanitizedMatchItem = Omit<MatchItem, 'answer' | 'explanation'>
export type SanitizedMcqItem = Omit<McqItem, 'answer' | 'explanation'>
export type SanitizedTfngItem = Omit<TfngItem, 'answer' | 'explanation'>

export type SanitizedItem =
  | SanitizedGapItem
  | SanitizedMatchItem
  | SanitizedMcqItem
  | SanitizedTfngItem

export interface SanitizedGroup {
  id: string
  context: string
  items: SanitizedItem[]
}

export interface SanitizedPart extends Omit<Part, 'items'> {
  items: SanitizedItem[]
}

export interface SanitizedListeningPart
  extends Omit<ListeningPart, 'items' | 'groups' | 'transcript'> {
  items?: SanitizedItem[]
  groups?: SanitizedGroup[]
}

/** How a session runs: the real exam, or self-paced practice. */
export type TestMode = 'simulation' | 'practice'

/** Server-side attempt timing, created/reused by the edge functions.
 *  `serverNow` is the server's clock at response time — the Timer measures the
 *  offset from the device clock so a wrong local clock can't skew the count.
 *  `pausedAt` is set only while a practice timer is frozen. */
export interface TestSession {
  id: string
  startedAt: string
  expiresAt: string
  serverNow: string
  mode: TestMode
  durationSec: number | null
  pausedAt: string | null
}

/** Read-only peek returned by the session-status edge function: test metadata
 *  plus the user's open session (or null when they haven't started yet). */
export interface SessionStatus {
  skill: Skill
  title: string
  durationSec: number
  /** Older function payloads omit these; treat missing as a full mock. */
  scope?: TestScope
  partNumber?: number | null
  serverNow: string
  session: TestSession | null
}

export interface SanitizedReadingTest extends Omit<ReadingTest, 'parts'> {
  parts: SanitizedPart[]
  session: TestSession
  scope?: TestScope
  partNumber?: number | null
}

export interface SanitizedListeningTest extends Omit<ListeningTest, 'parts'> {
  parts: SanitizedListeningPart[]
  session: TestSession
  scope?: TestScope
  partNumber?: number | null
}

/** What the browser receives from get-test — discriminated by `skill`. */
export type SanitizedTest = SanitizedReadingTest | SanitizedListeningTest

/** get-test's response when the user has NO open attempt: the picker metadata
 *  only (no paper, and — critically — no session is created). Lets get-test
 *  double as the old read-only session peek so a page load is ONE round-trip. */
export interface NoOpenAttempt {
  session: null
  skill: Skill
  title: string
  durationSec: number
  /** Older payloads omit these; treat missing as a full mock. */
  scope?: TestScope
  partNumber?: number | null
  serverNow: string
  /** An attempt whose clock ran out while the student was away, still inside
   *  the late-hand-in window. The answers are in this browser's draft, so the
   *  exam offers to submit them instead of losing the work. */
  expired?: ExpiredAttempt | null
}

/** An attempt still open on some test, as listed for the catalog. */
export interface OpenSession {
  testId: string
  startedAt: string
  expiresAt: string
  mode: TestMode
  durationSec: number | null
  pausedAt: string | null
}

/** The ran-out-while-you-were-away attempt offered for a late hand-in. */
export interface ExpiredAttempt {
  id: string
  expiresAt: string
  mode: TestMode
  /** After this moment the answers can no longer be handed in. */
  lateUntil: string
}

/** The full get-test result: the sanitized paper when an attempt is open, or
 *  the picker metadata when none is. Discriminate on `session === null`. */
export type TestState = SanitizedTest | NoOpenAttempt

/** Ordered items of a part, flattening multi_extract_mcq groups (listening
 *  Part 5). Works on full and sanitized parts, reading or listening. */
export function partItems(part: SanitizedPart | SanitizedListeningPart): SanitizedItem[]
export function partItems(part: Part | ListeningPart): Item[]
export function partItems<I>(part: { items?: I[]; groups?: { items: I[] }[] }): I[] {
  if (part.groups && part.groups.length > 0) return part.groups.flatMap((g) => g.items)
  return part.items ?? []
}
