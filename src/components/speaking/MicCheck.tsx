import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckIcon, MicIcon, PlayIcon } from '../icons'
import { primeSpeech } from '../../lib/speech'

// ---------------------------------------------------------------------------
// The mic check that gates every speaking task. A student cannot reach the paper
// until they have recorded a short clip AND heard it back — a broken microphone
// discovered mid-exam costs them the attempt. Real getUserMedia + MediaRecorder;
// nothing is uploaded, the clip lives in an object URL and is revoked on unmount.
// ---------------------------------------------------------------------------

type Phase =
  | 'idle' // nothing asked yet — "Test Mic"
  | 'requesting' // waiting on the browser permission prompt
  | 'recording' // capturing
  | 'recorded' // clip ready to play back
  | 'confirmed' // student said it sounded fine → Continue unlocks
  | 'denied' // permission refused / no device
  | 'unsupported' // browser has no MediaRecorder or no secure context

/** Hard cap so a forgotten recorder doesn't run forever. */
const MAX_SEC = 10

export function MicCheck({
  bullets,
  onContinue,
}: {
  bullets: string[]
  onContinue: () => void
}) {
  const [phase, setPhase] = useState<Phase>(
    typeof window !== 'undefined' &&
      (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      ? 'unsupported'
      : 'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState(0) // 0..1 live input level
  const [elapsed, setElapsed] = useState(0)
  const [clipUrl, setClipUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)

  // Release the device + the meter loop. Called on stop and on unmount — leaving
  // a live stream open keeps the browser's recording indicator on.
  const teardown = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLevel(0)
  }, [])

  useEffect(() => {
    return () => {
      teardown()
      if (clipUrl) URL.revokeObjectURL(clipUrl)
    }
  }, [teardown, clipUrl])

  const startRecording = async () => {
    setError(null)
    setPhase('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Live level meter — the fastest way for a student to see the mic is alive
      // before they even play the clip back.
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128
          if (v > peak) peak = v
        }
        setLevel((prev) => Math.max(peak, prev * 0.86)) // decay so it falls smoothly
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()

      const chunks: BlobPart[] = []
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => {
        teardown()
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        setClipUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(blob)
        })
        setPhase('recorded')
      }
      recorder.start()
      setElapsed(0)
      setPhase('recording')
    } catch (e) {
      teardown()
      setPhase('denied')
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser’s address bar, then try again.'
          : 'No microphone was found. Plug one in or check your system settings, then try again.',
      )
    }
  }

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  // Count the recording up and stop it at the cap.
  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => {
      setElapsed((s) => {
        if (s + 1 >= MAX_SEC) stopRecording()
        return s + 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, stopRecording])

  const playClip = () => {
    const el = audioElRef.current
    if (!el) return
    el.currentTime = 0
    void el.play()
  }

  const retry = () => {
    setPhase('idle')
    setPlaying(false)
  }

  const ready = phase === 'confirmed'

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {/* The paper's title and the way out live in the shared exam top bar
            (SpeakingTopBar), so this screen only owns its own content. */}
        <p className="text-sm text-ink-soft">Please read the instructions before you continue.</p>

        <ul className="mt-4 space-y-3 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          {bullets.map((b) => (
            <li key={b} className="flex gap-3 text-sm text-ink">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-2xl bg-brand-soft p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${
                ready ? 'bg-brand text-white' : 'bg-white text-ink-soft'
              }`}
            >
              {ready ? <CheckIcon width={16} height={16} /> : '1'}
            </span>
            <div className="min-w-0">
              <h2 className="font-extrabold text-heading">Quick mic check</h2>
              <p className="mt-0.5 text-sm text-ink-soft">
                Record a short message, then play it back so you know your microphone works.
              </p>
            </div>
          </div>

          <div className="mt-4">
            {phase === 'unsupported' ? (
              <p className="text-sm font-bold text-rose-700">
                This browser can’t record audio. Use a recent Chrome, Edge or Safari.
              </p>
            ) : phase === 'recording' ? (
              <div className="space-y-3">
                <LevelMeter level={level} />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700"
                  >
                    <span className="h-3 w-3 rounded-[3px] bg-white" />
                    Stop recording
                  </button>
                  <span className="tnum text-sm text-ink-soft">
                    {elapsed}s / {MAX_SEC}s — say anything, e.g. “Testing, one two three.”
                  </span>
                </div>
              </div>
            ) : phase === 'recorded' || phase === 'confirmed' ? (
              <div className="space-y-3">
                <audio
                  ref={audioElRef}
                  src={clipUrl ?? undefined}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={playClip}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
                  >
                    <PlayIcon width={14} height={14} />
                    {playing ? 'Playing…' : 'Play my recording'}
                  </button>
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
                  >
                    Record again
                  </button>
                  {phase === 'recorded' ? (
                    <button
                      type="button"
                      onClick={() => setPhase('confirmed')}
                      className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-brand transition-colors hover:border-brand hover:bg-white"
                    >
                      <CheckIcon width={14} height={14} />I could hear it
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                      <CheckIcon width={14} height={14} />
                      Microphone works
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={phase === 'requesting'}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
                >
                  <MicIcon width={15} height={15} />
                  {phase === 'requesting'
                    ? 'Waiting for permission…'
                    : phase === 'denied'
                      ? 'Try again'
                      : 'Test mic'}
                </button>
                {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            // Spend this click on unlocking speech. Chrome will not speak until
            // the page has had a user gesture, and the exam's first question is
            // read automatically — without this it is silently skipped.
            primeSpeech()
            onContinue()
          }}
          disabled={!ready}
          className={`mt-5 w-full rounded-xl px-5 py-3 text-sm font-bold transition-colors ${
            ready
              ? 'bg-brand text-white hover:bg-brand-deep'
              : 'cursor-not-allowed bg-line text-ink-faint'
          }`}
        >
          Continue
        </button>
        {!ready && phase !== 'unsupported' && (
          <p className="mt-2 text-center text-xs text-ink-soft">
            Finish the mic check to continue.
          </p>
        )}
      </div>
    </div>
  )
}

/** Live input level — segmented so a silent mic is obvious at a glance. */
function LevelMeter({ level }: { level: number }) {
  const lit = Math.round(Math.min(1, level * 1.6) * 16)
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <MicIcon width={16} height={16} />
      <div className="flex flex-1 gap-1">
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className={`h-4 flex-1 rounded-full transition-colors ${
              i < lit ? (i > 12 ? 'bg-rose-400' : 'bg-brand') : 'bg-white'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
