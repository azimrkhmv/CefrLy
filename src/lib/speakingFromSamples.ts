import type { Sample, SampleCategory, SpeakingTurn } from '../types/sample'
import type { SpeakingImage, SpeakingPartType, SpeakingTask, SpeakingTest } from '../types/test'
import { imageUrl } from './storage'
import { PART_DEFAULTS, PART_LABEL, PART_1_2_OPENING } from './speakingFixtures'

// ---------------------------------------------------------------------------
// The speaking papers are BUILT FROM THE SAMPLES LIBRARY. The owner's 24 real
// Multilevel tests are already in the `samples` table — prompts, photos and all
// — so the exam reads them rather than carrying a second, drifting copy. One
// sample = one part; four samples sharing a test number = one full mock.
//
// Note the samples library also publishes a MODEL ANSWER for each of these
// prompts, so a student can look up a strong answer to the exact question they
// are about to be asked. That is a fair trade for a practice platform, but it is
// a deliberate choice, not an oversight — a real graded mock would need prompts
// the student cannot read the answer to first.
//
// HOW EACH PART IS SHAPED (from the papers, not invented):
//   1.1 — 3 separate questions. They live in the model dialogue's Examiner
//         turns, which is the only place the source records them.
//   1.2 — 3 separate questions, all packed into one "Questions: …" line that
//         frequently omits the first question mark; `splitQuestions` recovers
//         the boundaries.
//   2   — ONE two-minute turn. The paper lists 3 prompts but the student
//         answers them in a single stretch of speech, so they become bullets
//         under one question, not three recordings.
//   3   — ONE two-minute turn on a for/against statement (usually an image).
// ---------------------------------------------------------------------------

const PART_OF: Partial<Record<SampleCategory, SpeakingPartType>> = {
  speaking1_1: 'part_1_1',
  speaking1_2: 'part_1_2',
  speaking2: 'part_2',
  speaking3: 'part_3',
}

/** Words a follow-up question is allowed to start with. Used to find the
 *  boundary where the source forgot the question mark. */
const STARTERS = [
  'Tell me',
  'Talk about',
  'Compare',
  'Contrast',
  'Describe',
  'Explain',
  'What',
  'Which',
  'Why',
  'How',
  'Who',
  'Where',
  'When',
  'Do you',
  'Did you',
  'Have you',
  'Would you',
  'Should',
  'Are ',
  'Is ',
  'Can ',
  'In your',
].join('|')

const BOUNDARY = new RegExp(`(?<=[a-z)”"])\\s+(?=(?:${STARTERS}))`, 'g')

const words = (s: string) => s.trim().split(/\s+/).length

/**
 * Recover the individual questions from a paper's "Questions: …" line.
 *
 * The source is inconsistent: the first question usually has no question mark
 * ("Compare the two vacation spots Which vacation spot do you prefer…"), and
 * trailing fragments like "Why or why not?" belong to the question before them
 * rather than standing alone. So: cut at every '?', cut again where a new
 * question clearly starts without one, then glue short fragments back on.
 */
export function splitQuestions(line: string): string[] {
  const body = line
    .replace(/^\s*Questions?:\s*/i, '')
    // Some papers separate questions with a hyphen after the mark ("…failure?-What…").
    .replace(/\?\s*-\s*/g, '? ')
    .trim()
  if (!body) return []

  const pieces: string[] = []
  for (const chunk of body.split(/(?<=\?)\s+/)) {
    for (const piece of chunk.split(BOUNDARY)) {
      const text = piece.trim()
      if (text) pieces.push(text)
    }
  }

  // "Why or why not?" / "Why?" are riders on the previous question.
  const merged: string[] = []
  for (const piece of pieces) {
    if (merged.length > 0 && words(piece) <= 4) merged[merged.length - 1] += ` ${piece}`
    else merged.push(piece)
  }

  // Two papers print their whole question set twice (one copy carrying an OCR
  // slip like "oftravelling"), so compare loosely and keep the first copy.
  const seen = new Set<string>()
  return merged.filter((q) => {
    const fingerprint = q.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.has(fingerprint)) return false
    seen.add(fingerprint)
    return true
  })
}

/** Part 1.1's questions are only recorded as the Examiner's turns. */
function examinerQuestions(model: string[] | SpeakingTurn[]): string[] {
  return (model as SpeakingTurn[])
    .filter((t) => typeof t === 'object' && /examiner/i.test(t.speaker))
    .map((t) => t.text.trim())
    .filter(Boolean)
}

const toImages = (sample: Sample): SpeakingImage[] =>
  (sample.content.images ?? []).map((img) => ({
    src: imageUrl(img.assetPath),
    alt: img.alt,
    caption: img.caption,
  }))

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The framing text shown above the question. The "Questions:" line is dropped —
 *  it becomes the questions themselves, and repeating it would double it up. */
function promptHtml(sample: Sample): string {
  return sample.content.task
    .filter((t) => !/^\s*Questions?:/i.test(t))
    .map((t) => `<p>${esc(t)}</p>`)
    .join('')
}

/** One sample → one exam task. */
function toTask(sample: Sample): SpeakingTask | null {
  const partType = PART_OF[sample.category]
  if (!partType) return null
  const d = PART_DEFAULTS[partType]
  const questionLine = sample.content.task.find((t) => /^\s*Questions?:/i.test(t)) ?? ''

  let questions: SpeakingTask['questions']

  if (partType === 'part_1_1') {
    // Three short interview questions, each its own recording.
    questions = examinerQuestions(sample.content.model)
  } else if (partType === 'part_1_2') {
    const parsed = splitQuestions(questionLine)
    // The opening comparison gets the longer look-and-speak window.
    questions = parsed.map((text, i) => (i === 0 ? { text, ...PART_1_2_OPENING } : { text }))
  } else if (partType === 'part_2') {
    // One continuous two-minute turn covering all of the paper's prompts, so
    // they are read out as a single question rather than recorded separately.
    const prompts = splitQuestions(questionLine)
    questions = prompts.length ? [{ text: prompts.join(' ') }] : undefined
  } else {
    // Part 3 keeps its statement in the prompt image, so there is no question
    // line to parse — the title carries the topic.
    questions = [
      { text: `${sample.title}. Give arguments for and against this, then say what you think.` },
    ]
  }

  if (partType === 'part_1_1' && (!questions || questions.length === 0)) return null

  return {
    id: `${sample.slug}-t`,
    partType,
    label: PART_LABEL[partType],
    prompt: { title: sample.title, html: promptHtml(sample) },
    questions,
    images: toImages(sample),
    prepSec: d.prepSec,
    speakSec: d.speakSec,
  }
}

const PART_NUMBER: Record<SpeakingPartType, 1 | 2 | 3 | 4> = {
  part_1_1: 1,
  part_1_2: 2,
  part_2: 3,
  part_3: 4,
}

const durationOf = (tasks: SpeakingTask[]) =>
  tasks.reduce((n, t) => n + PART_DEFAULTS[t.partType].durationSec, 0)

/** Which paper a sample belongs to. `sp-t14-12` → "14"; the four curated
 *  Test 1 samples (`sp11-interview`, `sp12-…`, `sp2-…`, `sp3-…`) → "1". */
function paperKey(slug: string): string {
  const m = /^sp-t(\d+)-/.exec(slug)
  return m ? m[1] : '1'
}

/**
 * Build every speaking paper the samples library can support: one single-part
 * drill per sample, plus a full 4-part mock for each test number that has all
 * four parts. Papers come out in exam order; incomplete sets still yield drills.
 */
export function speakingTestsFromSamples(samples: Sample[]): SpeakingTest[] {
  const drills: SpeakingTest[] = []
  const byPaper = new Map<string, SpeakingTask[]>()

  for (const sample of samples) {
    const task = toTask(sample)
    if (!task) continue

    drills.push({
      id: `speaking-${sample.slug}`,
      skill: 'speaking',
      title: sample.title,
      targetLevels: [PART_DEFAULTS[task.partType].level],
      durationSec: PART_DEFAULTS[task.partType].durationSec,
      scope: 'part',
      partNumber: PART_NUMBER[task.partType],
      tasks: [task],
    })

    const key = paperKey(sample.slug)
    byPaper.set(key, [...(byPaper.get(key) ?? []), task])
  }

  const mocks: { order: number; test: SpeakingTest }[] = []
  for (const [key, tasks] of byPaper) {
    if (tasks.length < 4) continue // an incomplete paper is not a mock
    const ordered = [...tasks].sort((a, b) => PART_NUMBER[a.partType] - PART_NUMBER[b.partType])
    mocks.push({
      order: Number(key),
      test: {
        id: `speaking-mock-${key}`,
        skill: 'speaking',
        title: `CEFR Speaking Mock ${key}`,
        targetLevels: ['B1', 'B2', 'C1'],
        durationSec: durationOf(ordered),
        scope: 'full',
        // Each part of a mock keeps its own id, so drills and mocks never collide.
        tasks: ordered.map((t) => ({ ...t, id: `mock-${key}-${t.id}` })),
      },
    })
  }

  return [...mocks.sort((a, b) => a.order - b.order).map((m) => m.test), ...drills]
}
