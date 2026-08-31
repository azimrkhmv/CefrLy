// ---------------------------------------------------------------------------
// In-progress speaking drafts.
//
// THE AUDIO GOES TO THE SERVER AS IT IS RECORDED. Each answer is uploaded to the
// private `speaking-temp` bucket the moment the student finishes speaking it,
// and this draft remembers WHERE each clip landed. That is what lets a reload,
// a crash or a closed tab resume for real instead of throwing the paper away —
// the recordings were never only in the page's memory.
//
// (It used to work the other way: blobs lived in the page, the draft held
// nothing but progress, and a refresh meant starting again from question 1. The
// draft explained why. The answer, in the end, was to stop keeping the audio
// here at all.)
//
// A clip is swept from the bucket an hour after it is written, so a draft older
// than RESUMABLE_MS can no longer be resumed with its audio — it falls back to
// the restart screen rather than resuming into silently empty questions.
//
// All localStorage access is try/catch-guarded — blocked/full storage must never
// crash the exam. NO CLOCK: a speaking attempt is not timed, so there is no
// deadline to persist.
// ---------------------------------------------------------------------------

/** One answer already safe in the bucket. */
export interface UploadedClip {
  path: string
  mimeType: string
  durationSec: number
}

export interface SpeakingDraft {
  /** Epoch ms the attempt began (used for ordering and for the resume window). */
  startedAt: number
  /** The id this sitting will be graded under. Fixed at the start so the clips
   *  of a resumed attempt land in the same folder as the ones before it. */
  attemptId?: string
  /** stepId ("<taskId>-q<n>") → seconds recorded for that question. */
  recorded: Record<string, number>
  /** stepId → the clip on the server. The answers that survive a reload. */
  uploaded?: Record<string, UploadedClip>
  /** How far the student had got when the page went away. */
  stepIndex: number
}

/** How long a draft can be resumed for. Deliberately shorter than the bucket's
 *  one-hour sweep, so a resume can never find its own clips already deleted. */
export const RESUMABLE_MS = 45 * 60 * 1000

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

/**
 * Can this draft be picked up where it was left, with its answers intact?
 *
 * Only if the clips are still in the bucket (inside the resume window) and at
 * least one of them made it up there. A draft that fails this restarts the
 * paper — resuming past questions whose audio is gone would submit them empty,
 * score them zero, and spend a paid check on a band that is not the student's.
 */
export function isResumable(draft: SpeakingDraft | null): draft is SpeakingDraft {
  if (!draft?.attemptId) return false
  if (Object.keys(draft.uploaded ?? {}).length === 0) return false
  return Date.now() - draft.startedAt < RESUMABLE_MS
}
