import { useSyncExternalStore } from 'react'
import type { SpeakingPartType, SpeakingTask, SpeakingTest } from '../types/test'
import { PART_DEFAULTS, PART_LABEL } from './speakingFixtures'

// ---------------------------------------------------------------------------
// Student-authored custom speaking questions (Phase 5, UI-first) — the mirror of
// writingCustom. Stored client-side in localStorage (private per browser, no
// backend write) and exposed as a tiny reactive store via useSyncExternalStore
// so the Custom tab re-renders when a question is added or removed.
// ---------------------------------------------------------------------------

const KEY = 'cefrly-speaking-custom'

export interface CustomSpeakingInput {
  partType: SpeakingPartType
  title: string
  question: string
  /** Part 1.1 only — the short interview questions, one per line. */
  questions?: string[]
}

let cache: SpeakingTest[] | null = null
const listeners = new Set<() => void>()

function read(): SpeakingTest[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as SpeakingTest[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: SpeakingTest[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Blocked/full storage must not crash the app; the in-memory cache still works.
  }
  listeners.forEach((l) => l())
}

/** Turn the student's modal input into a full single-part SpeakingTest. */
export function buildCustomTest(input: CustomSpeakingInput, id: string): SpeakingTest {
  const d = PART_DEFAULTS[input.partType]
  const partNumber =
    input.partType === 'part_1_1'
      ? 1
      : input.partType === 'part_1_2'
        ? 2
        : input.partType === 'part_2'
          ? 3
          : 4
  const task: SpeakingTask = {
    id: `${id}-t`,
    partType: input.partType,
    label: PART_LABEL[input.partType],
    prompt: { html: questionToHtml(input.question) },
    questions: input.questions?.length ? input.questions : undefined,
    prepSec: d.prepSec,
    speakSec: d.speakSec,
  }
  return {
    id,
    skill: 'speaking',
    title: input.title,
    targetLevels: [d.level],
    durationSec: d.durationSec,
    scope: 'part',
    partNumber,
    tasks: [task],
  }
}

/** The question arrives as plain text; wrap paragraphs so it renders in .passage. */
function questionToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function addCustomQuestion(input: CustomSpeakingInput): SpeakingTest {
  // Monotonic-ish id without Date.now/Math.random dependence on a single call.
  const id = `sc-${read().length}-${Date.now().toString(36)}`
  const test = buildCustomTest(input, id)
  write([test, ...read()])
  return test
}

export function removeCustomQuestion(id: string) {
  write(read().filter((t) => t.id !== id))
}

/** True for a test that came from the custom store (id convention). */
export function isCustomSpeakingId(id: string): boolean {
  return id.startsWith('sc-')
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Reactive read of the student's saved custom questions. */
export function useCustomSpeakingTests(): SpeakingTest[] {
  return useSyncExternalStore(subscribe, read, read)
}
