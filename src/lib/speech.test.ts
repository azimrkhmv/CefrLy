// Run with:  node --test src/lib/speech.test.ts
//
// speechSynthesis is the least trustworthy API in this app and the exam depends
// on it: `started === false` strands the student on "your browser blocked the
// audio" with no preparation countdown. A real user hit exactly that while the
// question was being read out loud — see docs/SPEAKING-DEFECTS.md #34.
//
// These cases are the browser behaviours that caused it. No DOM, no network.
import test from 'node:test'
import assert from 'node:assert/strict'

// --- a fake speechSynthesis whose misbehaviour we control -------------------
type Behaviour = {
  /** ms until onstart fires, or null for "never fires onstart". */
  startAfter: number | null
  /** ms until onend fires, or null for "never ends". */
  endAfter: number | null
  /** ms until onerror fires. */
  errorAfter?: number
  /** What `speaking` reports once the utterance is accepted. */
  reportsSpeaking: boolean
}

function install(behaviour: Behaviour) {
  const timers: NodeJS.Timeout[] = []
  let speaking = false
  let pending = false

  class FakeUtterance {
    text: string
    voice: unknown = null
    lang = ''
    rate = 1
    volume = 1
    onstart: (() => void) | null = null
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor(text: string) {
      this.text = text
    }
  }

  const synth = {
    get speaking() {
      return speaking
    },
    get pending() {
      return pending
    },
    getVoices: () => [{ name: 'Test EN', lang: 'en-GB' }],
    onvoiceschanged: null as null | (() => void),
    speak(u: FakeUtterance) {
      if (u.volume === 0) return // primeSpeech's silent unlock
      pending = true
      if (behaviour.startAfter !== null) {
        timers.push(
          setTimeout(() => {
            pending = false
            speaking = behaviour.reportsSpeaking
            u.onstart?.()
          }, behaviour.startAfter),
        )
      } else if (behaviour.reportsSpeaking) {
        // Engine says it is working even though onstart never comes.
        timers.push(
          setTimeout(() => {
            pending = false
            speaking = true
          }, 200),
        )
      }
      if (behaviour.endAfter !== null) {
        timers.push(
          setTimeout(() => {
            speaking = false
            pending = false
            u.onend?.()
          }, behaviour.endAfter),
        )
      }
      if (behaviour.errorAfter !== undefined) {
        timers.push(
          setTimeout(() => {
            speaking = false
            pending = false
            u.onerror?.()
          }, behaviour.errorAfter),
        )
      }
    },
    cancel() {
      speaking = false
      pending = false
    },
    pause() {},
    resume() {},
  }

  const win = {
    speechSynthesis: synth,
    setInterval: (...a: Parameters<typeof setInterval>) => setInterval(...a),
    clearInterval: (id: number) => clearInterval(id),
    setTimeout: (...a: Parameters<typeof setTimeout>) => setTimeout(...a),
  }
  ;(globalThis as Record<string, unknown>).window = win
  ;(globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance
  return () => timers.forEach(clearTimeout)
}

// The real waits are seconds long by design (Windows voices are slow). The
// suite shortens them so it stays fast enough that people actually run it.
const FAST = { timings: { startMs: 300, capMs: 900, pollMs: 20 } }

const load = async () => {
  const { speak } = await import(`./speech.ts?t=${Math.random()}`)
  return (text: string) => speak(text, FAST)
}

// ---------------------------------------------------------------------------

test('onend without onstart counts as SPOKEN, not as refused', async () => {
  // THE REPORTED BUG. Windows voices read the question aloud but never fire
  // onstart. Reaching onend is proof sound happened — a refusal fires onerror.
  const stop = install({ startAfter: null, endAfter: 300, reportsSpeaking: false })
  const speak = await load()
  const h = speak('Tell me about a critical decision you have made.')
  assert.equal(await h.started, true, 'a spoken question must never report refused')
  await h.done
  stop()
})

test('a slow voice is slow, not refused', async () => {
  // Windows SAPI can take >2s to make its first sound. The old 1400ms stopwatch
  // called that a refusal while the audio was on its way. Scaled to FAST above:
  // 500ms is past the 300ms stopwatch but inside the 900ms cap, which is the
  // same shape as 4s against the real 3000/8000.
  const stop = install({ startAfter: 500, endAfter: 900, reportsSpeaking: true })
  const speak = await load()
  const h = speak('How has this decision influenced you and your life?')
  assert.equal(await h.started, true)
  await h.done
  stop()
})

test('the engine reporting `speaking` is accepted as a start on its own', async () => {
  const stop = install({ startAfter: null, endAfter: 2500, reportsSpeaking: true })
  const speak = await load()
  const h = speak('What factors have the highest impact?')
  assert.equal(await h.started, true)
  stop()
})

test('a genuine refusal still reports false', async () => {
  // Nothing fires, the engine is idle: this is Chrome refusing for want of a
  // user gesture, and the screen MUST offer the play button.
  const stop = install({ startAfter: null, endAfter: null, reportsSpeaking: false })
  const speak = await load()
  const h = speak('A question nobody will hear.')
  assert.equal(await h.started, false)
  stop()
})

test('an error before any sound reports false', async () => {
  const stop = install({ startAfter: null, endAfter: null, errorAfter: 100, reportsSpeaking: false })
  const speak = await load()
  const h = speak('Blocked by the browser.')
  assert.equal(await h.started, false)
  stop()
})

test('done never resolves before the question has been read', async () => {
  // If `done` resolves early the exam advances mid-sentence and the microphone
  // opens over the examiner's voice — the thing the phase order exists to stop.
  const stop = install({ startAfter: 100, endAfter: 900, reportsSpeaking: true })
  const speak = await load()
  const began = Date.now()
  const h = speak('Compare these two photographs.')
  await h.done
  assert.ok(Date.now() - began >= 850, `done resolved after ${Date.now() - began}ms, too early`)
  stop()
})
