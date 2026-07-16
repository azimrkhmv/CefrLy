import { useSyncExternalStore } from 'react'
import type { WritingTaskType } from '../types/test'

// ---------------------------------------------------------------------------
// Submitted writing attempts (Phase 4, UI-first). Client-side only — there is
// no grader yet, so an attempt just records what the student wrote so it can
// show as "Completed" on the card and appear in My Results. Reactive via
// useSyncExternalStore. When the backend grader lands, this is replaced by real
// attempts rows; the shape mirrors what a writing attempt will store.
// ---------------------------------------------------------------------------

const KEY = 'cefrly-writing-attempts'

export interface WritingAnswer {
  taskId: string
  taskLabel: string
  taskType: WritingTaskType
  text: string
  wordCount: number
}

export interface WritingAttempt {
  id: string
  testId: string
  title: string
  scope: 'full' | 'part'
  /** Set for single-task drills/custom; undefined for a full Mock paper. */
  taskType?: WritingTaskType
  answers: WritingAnswer[]
  submittedAt: string
}

let cache: WritingAttempt[] | null = null
const listeners = new Set<() => void>()

function read(): WritingAttempt[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as WritingAttempt[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: WritingAttempt[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Blocked/full storage must not crash the exam.
  }
  listeners.forEach((l) => l())
}

export function addWritingAttempt(input: Omit<WritingAttempt, 'id' | 'submittedAt'>): WritingAttempt {
  const attempt: WritingAttempt = {
    ...input,
    id: `wa-${read().length}-${Date.now().toString(36)}`,
    submittedAt: new Date().toISOString(),
  }
  write([attempt, ...read()])
  return attempt
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useWritingAttempts(): WritingAttempt[] {
  return useSyncExternalStore(subscribe, read, read)
}

/** How many times a given writing test has been submitted. */
export function countAttempts(attempts: WritingAttempt[], testId: string): number {
  return attempts.filter((a) => a.testId === testId).length
}
