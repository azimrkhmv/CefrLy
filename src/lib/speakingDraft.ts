// ---------------------------------------------------------------------------
// In-progress speaking drafts. Persists which question the student reached and
// which ones already have a recording, so a refresh or an accidental exit does
// not restart the paper. All localStorage access is try/catch-guarded —
// blocked/full storage must never crash the exam.
//
// NO CLOCK. Unlike Reading/Listening/Writing, a speaking attempt is not timed:
// answers run as long as the student needs, so there is no deadline to persist
// and no mode to remember. That is why this draft is far smaller than the
// writing one.
//
// The audio itself is NOT here — blobs cannot live in localStorage, so a
// resumed attempt knows what was answered but cannot replay it. Durable clips
// arrive with the upload-to-storage backend.
// ---------------------------------------------------------------------------

export interface SpeakingDraft {
  /** Epoch ms the attempt began (used for ordering, not for a countdown). */
  startedAt: number
  /** stepId ("<taskId>-q<n>") → seconds recorded for that question. */
  recorded: Record<string, number>
  /** Which question the student is on (index into the flattened step list). */
  stepIndex: number
}

const key = (testId: string) => `cefrly-speaking-draft-${testId}`

export function readSpeakingDraft(testId: string): SpeakingDraft | null {
  try {
    const raw = localStorage.getItem(key(testId))
    if (!raw) return null
    const draft = JSON.parse(raw) as SpeakingDraft
    // Drafts written before the clock was removed carry a different shape;
    // ignore them rather than resuming into something inconsistent.
    if (typeof draft.stepIndex !== 'number' || typeof draft.recorded !== 'object') return null
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
