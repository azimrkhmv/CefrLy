// ---------------------------------------------------------------------------
// In-progress writing drafts (Phase 4). Persists the student's typed answers +
// the clock start so a refresh or an accidental exit resumes exactly where they
// left off (the writing analogue of the reading draft, `cefrly-draft-<id>`).
// All localStorage access is try/catch-guarded — blocked/full storage must
// never crash the exam. Client-side only this phase.
//
// The draft ALSO carries the chosen mode + the absolute deadline so a refresh
// resumes into the same mode/clock without re-showing the picker. Practice mode
// can pause (pausedAt freezes the countdown); simulation never sets it.
// ---------------------------------------------------------------------------

import type { TestMode } from '../types/test'

export interface WritingDraft {
  /** simulation (fixed clock, no pause) or practice (own limit, pausable). */
  mode: TestMode
  /** The id this sitting will be MARKED under. Fixed when the attempt starts and
   *  kept here, so a reload submits the same attempt rather than opening a
   *  second one — and so a check that was already paid for is never bought
   *  twice. Older drafts predate it; the runner mints one on submit. */
  attemptId?: string
  /** Epoch ms when the attempt's clock started. */
  startedAt: number
  /** Epoch ms deadline — the countdown derives from this (shifts on resume). */
  expiresAt: number
  /** Epoch ms the practice timer was paused, or null while running. */
  pausedAt: number | null
  /** taskId → the text written so far. */
  answers: Record<string, string>
  /** Which task the student is currently on (full mock stepper). */
  taskIndex: number
}

const key = (testId: string) => `cefrly-writing-draft-${testId}`

export function readWritingDraft(testId: string): WritingDraft | null {
  try {
    const raw = localStorage.getItem(key(testId))
    if (!raw) return null
    const draft = JSON.parse(raw) as WritingDraft
    // Guard against pre-mode legacy drafts — force the picker rather than
    // resuming into an attempt with no mode/deadline.
    if (draft.mode !== 'simulation' && draft.mode !== 'practice') return null
    if (typeof draft.expiresAt !== 'number') return null
    return draft
  } catch {
    return null
  }
}

export function saveWritingDraft(testId: string, draft: WritingDraft) {
  try {
    localStorage.setItem(key(testId), JSON.stringify(draft))
  } catch {
    // Blocked/full storage must not crash the exam.
  }
}

export function clearWritingDraft(testId: string) {
  try {
    localStorage.removeItem(key(testId))
  } catch {
    // ignore
  }
}

/** True when an unsubmitted draft exists — the card shows "Resume" instead of "Start". */
export function hasWritingDraft(testId: string): boolean {
  return readWritingDraft(testId) !== null
}
