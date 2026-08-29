// ---------------------------------------------------------------------------
// Reading exam questions aloud. The real examiner speaks the question, so the
// practice screen does too: when a question appears it is spoken before the
// student may answer.
//
// Two sources, in priority order:
//   1. `audio` — an authored recording (storage path / URL). Always preferred.
//   2. the browser's speechSynthesis — free, offline, no key, but the voice is
//      whatever the student's OS ships. This is the only option that can ever
//      work for the questions students write themselves, which is why it exists.
//
// A paid TTS service can later be slotted in by giving authored questions an
// `audio` path; nothing calling this file has to change.
// ---------------------------------------------------------------------------

export type SpeechHandle = {
  /** Resolves when speaking finished (or failed — never rejects). */
  done: Promise<void>
  /** Stop immediately. Safe to call after it already finished. */
  cancel: () => void
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Voices load asynchronously in Chrome — getVoices() is empty on first call and
 * fills in later via the voiceschanged event. Resolve either way so a device
 * with no voices at all still continues instead of hanging the exam.
 */
function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices()
    if (existing.length > 0) return resolve(existing)

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.speechSynthesis.onvoiceschanged = null
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.onvoiceschanged = finish
    // Some devices never fire the event. Do not let that stall the question.
    setTimeout(finish, 1000)
  })
}

/** Prefer a natural-sounding English voice; fall back to any English; then any. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'))
  if (english.length === 0) return null

  // Names vary wildly per platform; these are the ones that actually sound like
  // a person on the platforms Uzbek students use (Windows, Android, iOS).
  const preferred = ['natural', 'google uk english female', 'google us english', 'samantha', 'aria']
  for (const want of preferred) {
    const hit = english.find((v) => v.name.toLowerCase().includes(want))
    if (hit) return hit
  }
  const gb = english.find((v) => v.lang.toLowerCase() === 'en-gb')
  return gb ?? english[0]
}

/**
 * Speak `text`. Returns immediately with a handle; await `.done` to know when
 * the student may start answering.
 *
 * Never throws and never rejects: if speech is unavailable, `done` resolves at
 * once and the caller simply proceeds with the question shown as text.
 */
export function speak(text: string, opts: { rate?: number } = {}): SpeechHandle {
  if (!isSpeechSupported() || !text.trim()) {
    return { done: Promise.resolve(), cancel: () => {} }
  }

  let cancelled = false
  let keepAlive: number | undefined
  let resolveDone: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })

  const cleanup = () => {
    if (keepAlive !== undefined) clearInterval(keepAlive)
    keepAlive = undefined
    resolveDone()
  }

  const cancel = () => {
    cancelled = true
    try {
      window.speechSynthesis.cancel()
    } catch {
      // Nothing useful to do — the question is on screen as text regardless.
    }
    cleanup()
  }

  void (async () => {
    const voices = await voicesReady()
    if (cancelled) return

    // A previous question may still be speaking if the student advanced fast.
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* ignore */
    }

    const utter = new SpeechSynthesisUtterance(text)
    const voice = pickVoice(voices)
    if (voice) utter.voice = voice
    utter.lang = voice?.lang ?? 'en-GB'
    utter.rate = opts.rate ?? 0.95 // a touch slower than default: this is a test
    utter.onend = cleanup
    utter.onerror = cleanup

    try {
      window.speechSynthesis.speak(utter)
    } catch {
      cleanup()
      return
    }

    // Chrome stops speaking after ~15s unless nudged. Exam questions are short
    // so this rarely fires, but a long custom question would otherwise cut off.
    keepAlive = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) return
      window.speechSynthesis.pause()
      window.speechSynthesis.resume()
    }, 10000)

    // Safety net: if neither onend nor onerror ever fires (a known quirk on some
    // Android builds), release the student anyway.
    window.setTimeout(cleanup, Math.max(4000, text.length * 120))
  })()

  return { done, cancel }
}

/** Stop anything currently being spoken — used when leaving the exam screen. */
export function cancelSpeech() {
  if (!isSpeechSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
}
