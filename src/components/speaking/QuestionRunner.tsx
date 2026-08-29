import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckIcon, HeadphonesIcon, MicIcon, PlayIcon } from '../icons'
import { useRecorder } from '../../lib/useRecorder'
import { cancelSpeech, speak } from '../../lib/speech'
import type { SpeakingStep } from '../../lib/speakingQuestions'

// ---------------------------------------------------------------------------
// One question, one recording, on the exam's clock.
//
// The real paper is rigid: the question is read out, a fixed preparation window
// runs, then the student speaks for a fixed number of seconds and is cut off.
// So nothing here waits for a click — prep rolls into recording on its own and
// the recorder stops itself. The only controls are "finish early" and, once the
// turn is over, "record again" (which replays the SAME window, so retaking can
// never buy extra time).
//
// The phases are strictly sequential so the microphone is NEVER live while the
// question is being spoken: on a laptop without headphones an overlapping
// recorder captures the examiner's voice through the speakers.
// ---------------------------------------------------------------------------

type Phase =
  | 'asking' // the question is being read aloud
  | 'prep' // silent preparation countdown
  | 'answering' // recorder live (or opening)
  | 'review' // turn over; play it back, retake, or continue

export interface StepAnswer {
  url: string
  blob: Blob
  durationSec: number
}

const mmss = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function QuestionRunner({
  step,
  stepNumber,
  totalSteps,
  existing,
  onAnswered,
  onNext,
  isLast,
}: {
  step: SpeakingStep
  stepNumber: number
  totalSteps: number
  existing?: StepAnswer
  onAnswered: (answer: StepAnswer) => void
  onNext: () => void
  isLast: boolean
}) {
  // Re-answering a question the student came back to starts in review.
  const [phase, setPhase] = useState<Phase>(existing ? 'review' : 'asking')
  const [prepLeft, setPrepLeft] = useState(step.prepSec)
  const [speaking, setSpeaking] = useState(false)
  const [playingBack, setPlayingBack] = useState(false)
  const playbackRef = useRef<HTMLAudioElement | null>(null)

  const recorder = useRecorder()
  const { status, recording, start, stop, reset, level, elapsed, error } = recorder

  const answer = recording ?? existing
  const speakLeft = step.speakSec - elapsed

  /** Read the question aloud. Also the "replay" button's action. */
  const askAloud = useCallback(() => {
    setSpeaking(true)
    const handle = speak(step.question.text)
    void handle.done.then(() => setSpeaking(false))
    return handle
  }, [step.question.text])

  // Ask the question when the step opens. Cancelling on unmount matters: without
  // it, leaving the exam leaves the browser talking to an empty room.
  useEffect(() => {
    if (phase !== 'asking') return
    const handle = askAloud()
    void handle.done.then(() => setPhase(step.prepSec > 0 ? 'prep' : 'answering'))
    return () => handle.cancel()
    // Only re-run when the step itself changes; askAloud is derived from it.
  }, [step.id, phase, step.prepSec, askAloud])

  useEffect(() => () => cancelSpeech(), [])

  // Preparation countdown → recording, with no click in between.
  useEffect(() => {
    if (phase !== 'prep') return
    const endsAt = Date.now() + step.prepSec * 1000
    setPrepLeft(step.prepSec)
    const id = window.setInterval(() => {
      const left = (endsAt - Date.now()) / 1000
      if (left <= 0) {
        window.clearInterval(id)
        setPrepLeft(0)
        setPhase('answering')
      } else {
        setPrepLeft(left)
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [phase, step.prepSec])

  // Open the microphone the moment the answering window starts. The recorder
  // owns the cutoff — it is handed this question's own speaking limit.
  useEffect(() => {
    if (phase !== 'answering') return
    if (status !== 'idle') return
    void start(step.speakSec)
  }, [phase, status, start, step.speakSec])

  // The recorder hard-stops itself at speakSec; follow it into review.
  useEffect(() => {
    if (status === 'recorded' && recording) {
      setPhase('review')
      onAnswered(recording)
    }
    // onAnswered is stable enough for this; re-running on every render would
    // re-report the same clip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, recording])

  const playBack = () => {
    if (!answer) return
    const el = playbackRef.current ?? new Audio()
    playbackRef.current = el
    el.src = answer.url
    el.onended = () => setPlayingBack(false)
    setPlayingBack(true)
    void el.play().catch(() => setPlayingBack(false))
  }

  // Retake replays the SAME window from the top — never a longer one.
  const retake = () => {
    playbackRef.current?.pause()
    setPlayingBack(false)
    reset()
    setPhase('answering')
  }

  const live = status === 'recording'

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Stepper current={stepNumber} total={totalSteps} />

      <TaskMaterial step={step} />

      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
            {step.label}
          </span>
          <span className="tnum text-xs text-ink-soft">
            Question {stepNumber} of {totalSteps} · {step.prepSec}s to prepare · {step.speakSec}s to
            speak
          </span>
        </div>

        <p className="mt-3 text-lg font-extrabold leading-snug text-heading">{step.question.text}</p>

        <button
          type="button"
          onClick={() => askAloud()}
          disabled={speaking || phase === 'answering'}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink transition-colors hover:border-ink-faint disabled:cursor-not-allowed disabled:opacity-50"
        >
          <HeadphonesIcon width={15} height={15} />
          {speaking ? 'Reading the question…' : 'Hear it again'}
        </button>
      </section>

      <div className="mt-5 rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        {phase === 'asking' && <Waiting label="Listen to the question…" />}

        {phase === 'prep' && (
          <div>
            <Dial left={prepLeft} total={step.prepSec} tone="brand" />
            <p className="mt-3 text-sm font-bold text-ink">Preparation time</p>
            <p className="mt-1 text-sm text-ink-soft">
              Recording starts automatically when this reaches zero.
            </p>
          </div>
        )}

        {phase === 'answering' && (
          <div>
            {status === 'denied' || status === 'unsupported' ? (
              <div>
                <p className="text-sm font-bold text-rose-700">
                  {error ?? 'This browser cannot record audio. Try Chrome, Edge or Safari.'}
                </p>
                <button
                  type="button"
                  onClick={() => void start(step.speakSec)}
                  className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div>
                <Dial left={live ? speakLeft : step.speakSec} total={step.speakSec} tone="rose" />
                <p className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-ink">
                  {live ? (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                      Recording your answer
                    </>
                  ) : (
                    'Opening your microphone…'
                  )}
                </p>
                {/* The ring grows with the live input level, so a dead mic is obvious. */}
                <LevelBar level={level} active={live} />
                <button
                  type="button"
                  onClick={stop}
                  disabled={!live}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
                >
                  <MicIcon width={15} height={15} />
                  Finish answer early
                </button>
              </div>
            )}
          </div>
        )}

        {phase === 'review' && answer && (
          <div>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-800">
              <CheckIcon width={28} height={28} />
            </span>
            <p className="mt-3 font-extrabold text-heading">Answer recorded</p>
            <p className="tnum mt-1 text-sm text-ink-soft">
              {mmss(answer.durationSec)} of {mmss(step.speakSec)} used
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={playBack}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
              >
                <PlayIcon width={15} height={15} />
                {playingBack ? 'Playing…' : 'Play back'}
              </button>
              <button
                type="button"
                onClick={retake}
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
              >
                Record again
              </button>
              <button
                type="button"
                onClick={onNext}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
              >
                {isLast ? 'Finish' : 'Next question'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** The task's own material — the photos of Part 1.2 and the framing text. The
 *  student needs them in view for every question of the task, not just the first. */
function TaskMaterial({ step }: { step: SpeakingStep }) {
  const { prompt, images } = step.task
  const hasImages = !!images?.length
  if (!hasImages && !prompt.html) return null
  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      {prompt.title && <h2 className="font-extrabold text-heading">{prompt.title}</h2>}
      {prompt.html && (
        <div
          className="mt-1.5 space-y-2 text-sm text-ink-soft [&_strong]:font-bold [&_strong]:text-ink"
          dangerouslySetInnerHTML={{ __html: prompt.html }}
        />
      )}
      {hasImages && (
        <div className={`mt-4 grid gap-3 ${images!.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {images!.map((img) => (
            <figure key={img.src}>
              <img
                src={img.src}
                alt={img.alt}
                className="max-h-72 w-full rounded-xl border border-line object-contain"
              />
              {img.caption && (
                <figcaption className="mt-1 text-center text-xs text-ink-soft">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}

/** The big countdown, with a ring that drains as the window runs out. */
function Dial({ left, total, tone }: { left: number; total: number; tone: 'brand' | 'rose' }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0
  const color = tone === 'rose' ? 'var(--color-accent)' : 'var(--color-brand)'
  return (
    <div
      className="mx-auto grid h-28 w-28 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${pct * 360}deg, var(--color-brand-soft) 0deg)`,
      }}
      role="timer"
      aria-live="off"
    >
      <span className="tnum grid h-[88px] w-[88px] place-items-center rounded-full bg-white text-2xl font-extrabold text-heading">
        {mmss(left)}
      </span>
    </div>
  )
}

/** Live input level — a silent microphone has to be obvious immediately. */
function LevelBar({ level, active }: { level: number; active: boolean }) {
  const lit = active ? Math.round(Math.min(1, level * 1.6) * 16) : 0
  return (
    <div className="mx-auto mt-4 flex max-w-xs gap-1" aria-hidden>
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className={`h-3 flex-1 rounded-full transition-colors ${
            i < lit ? (i > 12 ? 'bg-rose-400' : 'bg-brand') : 'bg-brand-soft'
          }`}
        />
      ))}
    </div>
  )
}

function Waiting({ label }: { label: string }) {
  return (
    <div>
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
        <HeadphonesIcon width={26} height={26} />
      </span>
      <p className="mt-3 text-sm font-bold text-ink">{label}</p>
      <p className="mt-1 text-sm text-ink-soft">Preparation time starts once the question ends.</p>
    </div>
  )
}

/** The 1 … N progress dots. */
function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Questions">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <li key={n} className="flex items-center gap-1.5">
            <span
              aria-current={active ? 'step' : undefined}
              className={`tnum grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                active
                  ? 'bg-brand text-white'
                  : done
                    ? 'bg-brand-soft text-brand'
                    : 'bg-white text-ink-soft ring-1 ring-line'
              }`}
            >
              {n}
            </span>
            {n < total && <span aria-hidden className="h-px w-4 bg-line" />}
          </li>
        )
      })}
    </ol>
  )
}
