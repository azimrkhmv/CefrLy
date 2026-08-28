// ---------------------------------------------------------------------------
// In-progress speaking drafts (Phase 5) — the mirror of writingDraft. Persists
// which part the student reached + the clock start so a refresh or an accidental
// exit resumes exactly where they left off. All localStorage access is
// try/catch-guarded — blocked/full storage must never crash the exam.
// Client-side only this phase (recordings are NOT stored here; the recorder
// lands with the exam screen).
//
// The draft carries the chosen mode + the absolute deadline so a refresh resumes
// into the same mode/clock without re-showing the picker. Practice mode can pause
// (pausedAt freezes the countdown); simulation never sets it.
// ---------------------------------------------------------------------------

import type { TestMode } from '../types/test'

export interface SpeakingDraft {
  /** simulation (fixed clock, no pause) or practice (own limit, pausable). */
  mode: TestMode
  /** Epoch ms when the attempt's clock started. */
  startedAt: number
  /** Epoch ms deadline — the countdown derives from this (shifts on resume). */
  expiresAt: number
  /** Epoch ms the practice timer was paused, or null while running. */
  pausedAt: number | null
  /** taskId → seconds already recorded (the recorder fills this in later). */
  recorded: Record<string, number>
  /** Which part the student is currently on (full mock stepper). */
  taskIndex: number
}

const key = (testId: string) => `cefrly-speaking-draft-${testId}`

export function readSpeakingDraft(testId: string): SpeakingDraft | null {
  try {
    const raw = localStorage.getItem(key(testId))
    if (!raw) return null
    const draft = JSON.parse(raw) as SpeakingDraft
    // Guard against pre-mode legacy drafts — force the picker rather than
    // resuming into an attempt with no mode/deadline.
    if (draft.mode !== 'simulation' && draft.mode !== 'practice') return null
    if (typeof draft.expiresAt !== 'number') return null
    return draft
  } catch {
    return null
  }
}

export function saveSpeakingDraft(testId: string, draft: SpeakingDraft) {
  try {
    localStorage.setItem(key(testId), JSON.stringify(draft))
  } catch {
    // Blocked/full storage must not crash the exam.
  }
}

export function clearSpeakingDraft(testId: string) {
  try {
    localStorage.removeItem(key(testId))
  } catch {
    // ignore
  }
}

/** True when an unsubmitted draft exists — the card shows "Resume" instead of "Start". */
export function hasSpeakingDraft(testId: string): boolean {
  return readSpeakingDraft(testId) !== null
}
