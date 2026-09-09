// ---------------------------------------------------------------------------
// Exam signals for the Speaking runner.
//
// Students asked for what a real examiner gives them: a sound when the
// preparation window is nearly over, one when recording actually opens, and one
// when the time is up — so they are not staring at a dial to know where they
// are. The Dial alone fails the moment a student looks away to think, which is
// exactly when preparation time matters.
//
// Short WebAudio sine blips rather than audio files: nothing to download, no
// storage, and they can't fail the way an autoplayed <audio> element does.
//
// TIMING MATTERS AROUND THE MICROPHONE. The 'start' signal is played BEFORE the
// recorder opens and 'end' AFTER it has stopped, so neither lands inside the
// clip that gets graded. Only the mid-answer warning is audible on the
// recording — a real exam signals over the candidate too, and a chime is not
// speech, so it does not disturb the transcript the grader works from.
// ---------------------------------------------------------------------------

export type Signal =
  | 'prep-ending' // preparation is nearly over
  | 'start' // the microphone is about to open
  | 'warning' // the answer window is nearly over
  | 'end' // time is up, recording stopped

type Note = {
  freq: number
  /** Seconds from the start of the signal. */
  at: number
  /** How long the note rings out. Chimes decay; they are not gated. */
  ms: number
  gain: number
}

/**
 * Bell notes, not buzzers. The square-wave alarm the previous version made was
 * loud enough but unpleasant to sit an exam next to — and a sound a student
 * dreads is one they turn off. These are struck chimes: a fast attack so they
 * still cut through, a long natural decay so they are pleasant, and clear
 * musical intervals so each signal is recognisable as itself.
 */
const PATTERNS: Record<Signal, Note[]> = {
  // Preparation is nearly over: one soft chime.
  'prep-ending': [{ freq: 784, at: 0, ms: 700, gain: 0.4 }],
  // The microphone is opening: a rising third, the "ready" figure.
  start: [
    { freq: 659, at: 0, ms: 450, gain: 0.5 },
    { freq: 988, at: 0.16, ms: 900, gain: 0.55 },
  ],
  // Time is nearly up: three chimes on one note — a doorbell figure. Insistent
  // through repetition rather than through harshness, because the student is
  // talking over it.
  warning: [
    { freq: 1047, at: 0, ms: 420, gain: 0.55 },
    { freq: 1047, at: 0.28, ms: 420, gain: 0.55 },
    { freq: 1047, at: 0.56, ms: 800, gain: 0.55 },
  ],
  // Time is up: a falling third that settles and rings out.
  end: [
    { freq: 784, at: 0, ms: 450, gain: 0.5 },
    { freq: 523, at: 0.18, ms: 1200, gain: 0.55 },
  ],
}

/** Phones live in pockets and hands; a buzz lands where a chime does not. */
const VIBRATION: Record<Signal, number | number[]> = {
  'prep-ending': [90],
  start: [110, 80, 200],
  warning: [110, 110, 110, 110, 220],
  end: [300],
}

// A struck bell is a fundamental plus a few quieter partials above it; the
// higher ones fade first. Three is enough to stop it sounding like a test tone.
const PARTIALS: { ratio: number; gain: number; decay: number }[] = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 2, gain: 0.3, decay: 0.6 },
  { ratio: 3.01, gain: 0.12, decay: 0.4 },
]

let ctx: AudioContext | null = null
let bus: AudioNode | null = null

/** A compressor between the chimes and the speakers: overlapping partials and
 *  overlapping notes would otherwise sum past full scale and crackle. Gentle
 *  ratio, so the strike at the front of each note survives. */
function output(ac: AudioContext): AudioNode {
  if (bus) return bus
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 6
  comp.attack.value = 0.005
  comp.release.value = 0.25
  const master = ac.createGain()
  master.gain.value = 0.85
  comp.connect(master).connect(ac.destination)
  bus = comp
  return bus
}

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  return ctx
}

/**
 * Unlock the audio context on a user gesture — the mic-check click spends one
 * on this, the same way primeSpeech() unlocks speechSynthesis. Without it the
 * first signal of the exam is silently dropped.
 */
export function primeSignals(): void {
  const ac = audioContext()
  if (ac && ac.state === 'suspended') void ac.resume()
}

/** Play one signal. Never throws — a missing or blocked AudioContext is silent,
 *  and the exam carries on without it. */
export function playSignal(signal: Signal): void {
  try {
    const ac = audioContext()
    if (!ac) return
    if (ac.state === 'suspended') void ac.resume()
    const now = ac.currentTime
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(VIBRATION[signal])
    }
    for (const note of PATTERNS[signal]) {
      const from = now + note.at
      for (const p of PARTIALS) {
        const osc = ac.createOscillator()
        const gain = ac.createGain()
        osc.type = 'sine'
        osc.frequency.value = note.freq * p.ratio
        const peak = note.gain * p.gain
        const ring = (note.ms / 1000) * p.decay
        // Struck, then left to ring: near-instant attack, exponential decay.
        gain.gain.setValueAtTime(0.0001, from)
        gain.gain.exponentialRampToValueAtTime(peak, from + 0.006)
        gain.gain.exponentialRampToValueAtTime(0.0001, from + ring)
        osc.connect(gain)
        gain.connect(output(ac))
        osc.start(from)
        osc.stop(from + ring + 0.02)
      }
    }
  } catch {
    // An exam is not worth crashing over a beep.
  }
}

/** How much warning a given answer window deserves — 10s of a two-minute turn,
 *  but a 30s turn would spend a third of itself in "nearly over". */
export function warningAt(speakSec: number): number | null {
  if (speakSec >= 60) return 10
  if (speakSec >= 25) return 5
  return null
}
