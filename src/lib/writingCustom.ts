import { useSyncExternalStore } from 'react'
import type { WritingTask, WritingTaskType, WritingTest } from '../types/test'
import { TASK_DEFAULTS, TASK_LABEL } from './writingFixtures'

// ---------------------------------------------------------------------------
// Student-authored custom writing questions (Phase 4, UI-first). Stored
// client-side in localStorage — private per browser, no backend write (keeps
// prod untouched). Exposed as a tiny reactive store via useSyncExternalStore so
// the Custom tab re-renders when a question is added or removed.
// ---------------------------------------------------------------------------

const KEY = 'cefrly-writing-custom'

export interface CustomQuestionInput {
  taskType: WritingTaskType
  title: string
  question: string
  /** OPTIONAL prompt image (object URL / data URL in this UI phase). */
  imageSrc?: string
}

let cache: WritingTest[] | null = null
const listeners = new Set<() => void>()

function read(): WritingTest[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as WritingTest[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: WritingTest[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Blocked/full storage must not crash the app; the in-memory cache still works.
  }
  listeners.forEach((l) => l())
}

/** Turn the student's modal input into a full single-task WritingTest. */
export function buildCustomTest(input: CustomQuestionInput, id: string): WritingTest {
  const d = TASK_DEFAULTS[input.taskType]
  const partNumber = input.taskType === 'task_1_1' ? 1 : input.taskType === 'task_1_2' ? 2 : 3
  const task: WritingTask = {
    id: `${id}-t`,
    taskType: input.taskType,
    label: TASK_LABEL[input.taskType],
    minWords: d.minWords,
    maxWords: d.maxWords,
    prompt: { html: questionToHtml(input.question) },
    image: input.imageSrc ? { src: input.imageSrc, alt: input.title } : undefined,
  }
  return {
    id,
    skill: 'writing',
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

export function addCustomQuestion(input: CustomQuestionInput): WritingTest {
  // Monotonic-ish id without Date.now/Math.random dependence on a single call.
  const id = `wc-${read().length}-${Date.now().toString(36)}`
  const test = buildCustomTest(input, id)
  write([test, ...read()])
  return test
}

export function removeCustomQuestion(id: string) {
  write(read().filter((t) => t.id !== id))
}

/** True for a test that came from the custom store (id convention). */
export function isCustomWritingId(id: string): boolean {
  return id.startsWith('wc-')
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Reactive read of the student's saved custom questions. */
export function useCustomWritingTests(): WritingTest[] {
  return useSyncExternalStore(subscribe, read, read)
}
