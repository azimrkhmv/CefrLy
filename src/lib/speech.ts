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
// speechSynthesis is far less reliable than it looks, and two of its failures
// are silent — the question simply never gets read while the exam carries on:
//
//   * Chrome refuses to speak until the page has had a real user gesture. An
//     auto-played question fails; the same question read from a button works.
//     primeSpeech() spends the mic-check click on unlocking it.
//   * cancel() immediately followed by speak() drops the new utterance on
//     Chrome. We only cancel when something is actually speaking, and leave a
//     gap before starting.
//
// So `speak()` also reports whether sound ACTUALLY started, and the caller
// must not move on when it did not — see QuestionRunner's "Play the question".
// ---------------------------------------------------------------------------

export type SpeechHandle = {
  /** Resolves when speaking finished (or failed — never rejects). */
  done: Promise<void>
  /**
   * Resolves true once the utterance really started making sound, false if the
   * browser silently refused. Never rejects.
   */
  started: Promise<boolean>
  /** Stop immediately. Safe to call after it already finished. */
  cancel: () => void
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Unlock speech using a real user gesture — call from a click handler.
 *
 * Chrome treats speech like audio playback: the first utterance must belong to
 * a gesture, and everything after inherits that permission. Without this the
 * exam's first auto-read question is silently dropped. Speaking a single space
 * at zero volume is inaudible but counts.
 */
export function primeSpeech(): void {
  if (!isSpeechSupported()) return
  try {
    const utter = new SpeechSynthesisUtterance(' ')
    utter.volume = 0
    window.speechSynthesis.speak(utter)
  } catch {
    // Nothing to do — the question is on screen as text regardless.
  }
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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** How long to give the browser to actually make a sound before retrying. */
const START_TIMEOUT_MS = 1400

/**
 * Speak `text`. Returns immediately with a handle; await `.started` to know
 * whether it is really being read, and `.done` to know when the student may
 * answer.
 *
 * Never throws and never rejects.
 */
export function speak(text: string, opts: { rate?: number } = {}): SpeechHandle {
  if (!isSpeechSupported() || !text.trim()) {
    return { done: Promise.resolve(), started: Promise.resolve(false), cancel: () => {} }
  }

  let cancelled = false
  let keepAlive: number | undefined
  let resolveDone: () => void = () => {}
  let resolveStarted: (ok: boolean) => void = () => {}
  let settledStart = false

  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })
  const started = new Promise<boolean>((resolve) => {
    resolveStarted = resolve
  })

  const markStarted = (ok: boolean) => {
    if (settledStart) return
    settledStart = true
    resolveStarted(ok)
  }

  const cleanup = () => {
    if (keepAlive !== undefined) clearInterval(keepAlive)
    keepAlive = undefined
    markStarted(false) // no-op if it already started
    resolveDone()
  }

  const cancel = () => {
    cancelled = true
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* ignore */
    }
    cleanup()
  }

  /** One attempt. Resolves true if the browser reported it started speaking. */
  const attempt = (voice: SpeechSynthesisVoice | null): Promise<boolean> =>
    new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text)
      if (voice) utter.voice = voice
      utter.lang = voice?.lang ?? 'en-GB'
      utter.rate = opts.rate ?? 0.95 // a touch slower than default: this is a test

      let began = false
      utter.onstart = () => {
        began = true
        markStarted(true)
        resolve(true)
      }
      utter.onend = cleanup
      utter.onerror = () => {
        // 'not-allowed' (no gesture) and 'interrupted' both land here.
        if (!began) resolve(false)
        else cleanup()
      }

      try {
        window.speechSynthesis.speak(utter)
      } catch {
        resolve(false)
        return
      }

      // onstart is the only trustworthy signal that sound is happening; a
      // silently-refused utterance fires nothing at all.
      setTimeout(() => {
        if (!began) resolve(false)
      }, START_TIMEOUT_MS)
    })

  void (async () => {
    const voices = await voicesReady()
    if (cancelled) return
    const voice = pickVoice(voices)

    // Only cancel if something is actually speaking. Cancelling an idle queue
    // and speaking in the same tick is the Chrome bug that eats the utterance.
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* ignore */
      }
      await wait(150)
      if (cancelled) return
    }

    let ok = await attempt(voice)

    // One retry: a first utterance right after a cancel, or right after a route
    // change, is the case that silently fails most often.
    if (!ok && !cancelled) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* ignore */
      }
      await wait(250)
      if (cancelled) return
      ok = await attempt(voice)
    }

    if (cancelled) return
    if (!ok) {
      // Give up quietly and tell the caller, which must offer a manual button
      // rather than marching the student past a question they never heard.
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

  return { done, started, cancel }
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
