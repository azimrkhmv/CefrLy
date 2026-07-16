// ---------------------------------------------------------------------------
// In-progress writing drafts (Phase 4). Persists the student's typed answers +
// the clock start so a refresh or an accidental exit resumes exactly where they
// left off (the writing analogue of the reading draft, `cefrly-draft-<id>`).
// All localStorage access is try/catch-guarded — blocked/full storage must
// never crash the exam. Client-side only this phase.
// ---------------------------------------------------------------------------

export interface WritingDraft {
  /** Epoch ms when the attempt's clock started — the countdown derives from this. */
  startedAt: number
  /** taskId → the text written so far. */
  answers: Record<string, string>
  /** Which task the student is currently on (full mock stepper). */
  taskIndex: number
}

const key = (testId: string) => `cefrly-writing-draft-${testId}`

export function readWritingDraft(testId: string): WritingDraft | null {
  try {
    const raw = localStorage.getItem(key(testId))
    return raw ? (JSON.parse(raw) as WritingDraft) : null
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
