import { useSyncExternalStore } from 'react'
import type { SpeakingPartType } from '../types/test'

// ---------------------------------------------------------------------------
// Locally-recorded speaking attempts — the UNGRADED ones, and only those.
//
// There are two records of a speaking attempt and they do not overlap:
//   · this file  — every submitted attempt, written immediately, so the catalog
//                  can show "Completed" even when no AI check was run (a Free
//                  student, or a check that failed).
//   · the `speaking_attempts` table — attempts that were actually graded, with
//                  the band, transcript and feedback.
// An attempt is REMOVED from here the moment grading succeeds (see
// removeSpeakingAttempt), so a graded attempt lives in exactly one place and
// nothing is ever counted twice.
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

/** Drop a local attempt once the server has a graded record of it, so the two
 *  stores never both describe the same sitting. */
export function removeSpeakingAttempt(id: string) {
  write(read().filter((a) => a.id !== id))
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
