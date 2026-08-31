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
// THE AUDIO IS NOT HERE, AND THAT IS WHY A DRAFT CANNOT BE RESUMED. Blobs
// cannot live in localStorage, so a "resumed" attempt would come back with the
// student parked on question 4 and questions 1-3 silently empty — they would
// submit, those questions would score zero, and a paid check would be spent on
// a band that is not theirs.
//
// So this draft exists ONLY to detect that an attempt was interrupted. The exam
// screen restarts it from question 1 and says so. Resuming for real needs the
// clips to survive the reload, which means uploading each answer as it is
// recorded — a backend change, not a storage trick.
// ---------------------------------------------------------------------------

export interface SpeakingDraft {
  /** Epoch ms the attempt began (used for ordering, not for a countdown). */
  startedAt: number
  /** stepId ("<taskId>-q<n>") → seconds recorded for that question. */
  recorded: Record<string, number>
  /** How far the student had got when the page went away. Used to TELL them
   *  what was lost, never to skip back to that question. */
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
