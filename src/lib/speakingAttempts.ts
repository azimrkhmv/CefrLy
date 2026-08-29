import { useSyncExternalStore } from 'react'
import type { SpeakingPartType } from '../types/test'

// ---------------------------------------------------------------------------
// Submitted speaking attempts (Phase 5, UI-first) — the mirror of
// writingAttempts. Client-side only; there is no grader (and no recorder) yet,
// so an attempt just records that the part was completed so the card can show
// "Completed" and it can appear in My Results. When the recorder + backend land,
// `recordings` carries the stored clip references; the shape already allows it.
// ---------------------------------------------------------------------------

const KEY = 'cefrly-speaking-attempts'

/** ONE recording, for ONE question. A card with three questions produces three
 *  of these — the student answers them one at a time, as in the real exam. */
export interface SpeakingAnswer {
  taskId: string
  taskLabel: string
  partType: SpeakingPartType
  /** Position within the task, so the answers can be replayed in order. */
  questionIndex: number
  /** The question as asked — kept with the answer so a result page (and later
   *  the grader) does not have to re-resolve the paper. */
  questionText: string
  /** Seconds actually spoken. */
  durationSec: number
  /** Object URL of the clip. IN-MEMORY ONLY — it dies with the page. Uploading
   *  to storage and keeping a durable path is the backend's job. */
  recordingSrc?: string
}

export interface SpeakingAttempt {
  id: string
  testId: string
  title: string
  scope: 'full' | 'part'
  /** Set for single-part drills/custom; undefined for a full Mock paper. */
  partType?: SpeakingPartType
  answers: SpeakingAnswer[]
  submittedAt: string
}

let cache: SpeakingAttempt[] | null = null
const listeners = new Set<() => void>()

function read(): SpeakingAttempt[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as SpeakingAttempt[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: SpeakingAttempt[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Blocked/full storage must not crash the exam.
  }
  listeners.forEach((l) => l())
}

export function addSpeakingAttempt(
  input: Omit<SpeakingAttempt, 'id' | 'submittedAt'>,
): SpeakingAttempt {
  const attempt: SpeakingAttempt = {
    ...input,
    id: `sa-${read().length}-${Date.now().toString(36)}`,
    submittedAt: new Date().toISOString(),
  }
  write([attempt, ...read()])
  return attempt
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useSpeakingAttempts(): SpeakingAttempt[] {
  return useSyncExternalStore(subscribe, read, read)
}

/** How many times a given speaking test has been submitted. */
export function countAttempts(attempts: SpeakingAttempt[], testId: string): number {
  return attempts.filter((a) => a.testId === testId).length
}
