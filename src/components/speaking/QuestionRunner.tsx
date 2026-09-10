import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckIcon, HeadphonesIcon, MicIcon, PlayIcon } from '../icons'
import { useRecorder } from '../../lib/useRecorder'
import { cancelSpeech, speak } from '../../lib/speech'
import { playSignal, warningAt } from '../../lib/tone'
import type { SpeakingStep } from '../../lib/speakingQuestions'
import type { SpeakingDebate } from '../../types/test'
import { SpeakingNotes } from './SpeakingNotes'
import { fieldsFor } from '../../lib/speakingNotes'

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
  /** Object URL for playback. ABSENT on an answer restored after a reload: the
   *  clip is safe on the server, but this page never held the audio itself. */
  url?: string
  /** The recording as made here. Absent once only the server copy survives. */
  blob?: Blob
  durationSec: number
  /** Where the clip lives in the `speaking-temp` bucket, once uploaded. Its
   *  presence is what makes an answer survive a reload. */
  path?: string
  mimeType?: string
  /** Identifies THIS take, so a slow upload from a discarded take cannot
   *  overwrite the answer the student actually kept. */
  takeId?: string
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
  testId,
}: {
  step: SpeakingStep
  stepNumber: number
  totalSteps: number
  existing?: StepAnswer
  /** Scopes the note sheet's storage to this paper. */
  testId: string
  onAnswered: (answer: StepAnswer) => void
  onNext: () => void
  isLast: boolean
}) {
  // Re-answering a question the student came back to starts in review.
  const [phase, setPhase] = useState<Phase>(existing ? 'review' : 'asking')
  const [prepLeft, setPrepLeft] = useState(step.prepSec)
  const [speaking, setSpeaking] = useState(false)
  // The browser refused to make a sound (no gesture yet, or Chrome dropped the
  // utterance). The student must be able to play it themselves — marching them
  // into a recording for a question they never heard is the worst thing this
  // screen could do.
  const [needsTap, setNeedsTap] = useState(false)
  const [playingBack, setPlayingBack] = useState(false)
  const playbackRef = useRef<HTMLAudioElement | null>(null)

  // Read inside the prep interval without restarting it on every tick.
  const speakingRef = useRef(false)
  const prepLeftRef = useRef(step.prepSec)
  speakingRef.current = speaking
  prepLeftRef.current = prepLeft

  // Exam signals fire once each per question (see lib/tone). Reset when the
  // step changes, so a re-answered question signals again.
  const signalled = useRef({ prepEnding: false, start: false, warning: false })
  useEffect(() => {
    signalled.current = { prepEnding: false, start: false, warning: false }
  }, [step.id])

  const recorder = useRecorder()
  const { status, recording, start, stop, reset, level, elapsed, error } = recorder

  const answer = recording ?? existing
  const speakLeft = step.speakSec - elapsed

  /** Read the question aloud. Also the "replay" button's action. */
  const askAloud = useCallback(() => {
    setSpeaking(true)
    setNeedsTap(false)
    const handle = speak(step.question.text)
    void handle.started.then((ok) => {
      if (!ok) setNeedsTap(true)
    })
    void handle.done.then(() => setSpeaking(false))
    return handle
  }, [step.question.text])

  // Ask the question when the step opens. Cancelling on unmount matters: without
  // it, leaving the exam leaves the browser talking to an empty room.
  useEffect(() => {
    if (phase !== 'asking') return
    const handle = askAloud()
    void handle.started.then((ok) => {
      // Silently refused: hold here with a play button instead of starting the
      // clock on a question the student has not heard.
      if (!ok) return
      void handle.done.then(() => setPhase(step.prepSec > 0 ? 'prep' : 'answering'))
    })
    return () => handle.cancel()
    // Only re-run when the step itself changes; askAloud is derived from it.
  }, [step.id, phase, step.prepSec, askAloud])

  useEffect(() => () => cancelSpeech(), [])

  // Preparation countdown → recording, with no click in between.
  useEffect(() => {
    if (phase !== 'prep') return
    let endsAt = Date.now() + step.prepSec * 1000
    setPrepLeft(step.prepSec)
    const id = window.setInterval(() => {
      // Replaying the question FREEZES preparation. Otherwise the countdown
      // runs out mid-sentence, the microphone opens while the browser is still
      // talking, and the recording captures the question off the speakers —
      // exactly what the phase order exists to prevent.
      if (speakingRef.current) {
        endsAt = Date.now() + prepLeftRef.current * 1000
        return
      }
      const left = (endsAt - Date.now()) / 1000
      // "Nearly done preparing", then the rising start pair while the mic is
      // still closed — so neither is inside the graded clip.
      if (left <= 3.2 && left > 1 && !signalled.current.prepEnding) {
        signalled.current.prepEnding = true
        playSignal('prep-ending')
      }
      if (left <= 0.9 && !signalled.current.start) {
        signalled.current.start = true
        playSignal('start')
      }
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
    // Steps with no preparation window (prepSec 0) never ran the countdown, so
    // they signal here instead.
    if (!signalled.current.start) {
      signalled.current.start = true
      playSignal('start')
    }
    void start(step.speakSec)
  }, [phase, status, start, step.speakSec])

  // "Time is nearly up" while the student is still talking. Long turns get 10s,
  // short ones 5s, and the shortest none at all (see warningAt).
  useEffect(() => {
    if (phase !== 'answering' || status !== 'recording') return
    const at = warningAt(step.speakSec)
    if (at === null || signalled.current.warning) return
    if (speakLeft <= at) {
      signalled.current.warning = true
      playSignal('warning')
    }
  }, [phase, status, speakLeft, step.speakSec])

  // The recorder hard-stops itself at speakSec; follow it into review.
  useEffect(() => {
    if (status === 'recorded' && recording) {
      // After the recorder stopped, so the falling pair is never on the clip.
      playSignal('end')
      setPhase('review')
      onAnswered(recording)
    }
    // onAnswered is stable enough for this; re-running on every render would
    // re-report the same clip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, recording])

  const playBack = () => {
    // No url = an answer restored after a reload. It is safely on the server and
    // will be graded; this page simply has nothing to play.
    if (!answer?.url) return
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

  // With a debate card above, the question card would repeat the statement word
  // for word. Show only what is being ASKED of it; the spoken question keeps
  // both halves, because the examiner reads the statement out.
  const debate = step.task.debate
  const shownQuestion =
    debate && step.question.text.startsWith(debate.statement)
      ? step.question.text.slice(debate.statement.length).trim() || step.question.text
      : step.question.text

  // Only the long turns get a note sheet, and only they get the second column.
  // Parts 1.1 and 1.2 have none: reserving the column for them would push the
  // exam off-centre behind an empty gap for five of the mock's eight questions.
  const hasNotes = fieldsFor(step) !== null

  // Multi-prompt turns carry their prompts as newline-separated lines (see the
  // part_2 builder in speakingFromSamples.ts). A student's own custom question
  // can be typed the same way, so this is not Part-2-only.
  const questionLines = shownQuestion.split('\n').map((l) => l.trim()).filter(Boolean)

  return (
    // THE EXAM STAYS IN THE MIDDLE OF THE PAGE; the note sheet lives in the
    // gutter beside it.
    //
    // Three columns, with EQUAL 1fr gutters either side of a fixed 42rem centre.
    // That is what keeps the photo, the question and the clock dead centre on
    // the screen — a two-column grid centres the PAIR, which pushed the exam
    // visibly off to the left and read as a layout bug. The sheet sits in the
    // left gutter, right-aligned so it hugs the exam rather than drifting to
    // the edge of a wide monitor, and sticky so it holds through preparation
    // AND through the recording, which is the moment it is actually for.
    //
    // Below xl there is no room for a gutter, and the source order gives the
    // stacked layout the reading it should have: question, notes, clock.
    <div
      className={
        hasNotes
          ? 'mx-auto grid w-full max-w-2xl grid-cols-1 gap-5 xl:max-w-[80rem] xl:grid-cols-[minmax(0,1fr)_minmax(0,42rem)_minmax(0,1fr)] xl:items-start xl:gap-6'
          : 'mx-auto grid w-full max-w-2xl grid-cols-1 gap-5'
      }
    >
      <div className="min-w-0 xl:col-start-2 xl:row-start-1">
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

        {/* A Part 2 turn asks THREE things in one recording, and the paper prints
            them as a list. Run together as one paragraph they read as a wall of
            text and the later prompts get missed — which costs a mark, since the
            block is scored on how many were addressed. One row each, numbered
            when there is more than one. */}
        <div className="mt-3 space-y-2">
          {questionLines.map((line, i) => (
            <p
              key={i}
              className="flex gap-2 text-lg font-extrabold leading-snug text-heading"
            >
              {questionLines.length > 1 && (
                <span aria-hidden className="tnum shrink-0 text-brand">
                  {i + 1}.
                </span>
              )}
              <span>{line}</span>
            </p>
          ))}
        </div>

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

      </div>

      {/* The note sheet, for the long turns only. Second column on a wide screen
          (sticky, so it survives scrolling); between the question and the clock
          when stacked. */}
      {hasNotes && (
        <aside className="min-w-0 xl:col-start-1 xl:row-start-1 xl:row-span-2 xl:sticky xl:top-4 xl:w-full xl:max-w-[17rem] xl:justify-self-end">
          <SpeakingNotes step={step} testId={testId} />
        </aside>
      )}

      <div className="min-w-0 xl:col-start-2 xl:row-start-2">
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        {phase === 'asking' &&
          (needsTap ? (
            <div>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
                <HeadphonesIcon width={26} height={26} />
              </span>
              <p className="mt-3 text-sm font-bold text-ink">Your browser blocked the audio</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
                Press play to hear the question. Preparation starts after it finishes — you have
                not lost any time.
              </p>
              <button
                type="button"
                onClick={() => {
                  const handle = askAloud()
                  void handle.started.then((ok) => {
                    if (ok) {
                      void handle.done.then(() =>
                        setPhase(step.prepSec > 0 ? 'prep' : 'answering'),
                      )
                    }
                  })
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
              >
                <PlayIcon width={15} height={15} />
                Play the question
              </button>
              <button
                type="button"
                onClick={() => setPhase(step.prepSec > 0 ? 'prep' : 'answering')}
                className="mt-3 block w-full text-xs font-bold text-ink-soft hover:text-brand"
              >
                Skip the audio — I have read it
              </button>
            </div>
          ) : (
            <Waiting label="Listen to the question…" />
          ))}

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
            <p className="mt-3 font-extrabold text-heading">
              {answer.url ? 'Answer recorded' : 'Answer saved'}
            </p>
            <p className="tnum mt-1 text-sm text-ink-soft">
              {mmss(answer.durationSec)} of {mmss(step.speakSec)} used
            </p>
            {!answer.url && (
              <p className="mx-auto mt-1 max-w-xs text-xs text-ink-soft">
                Recorded before the page reloaded. It is safe with us and will be marked — it just
                cannot be played back here.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {answer.url && (
                <button
                  type="button"
                  onClick={playBack}
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
                >
                  <PlayIcon width={15} height={15} />
                  {playingBack ? 'Playing…' : 'Play back'}
                </button>
              )}
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
    </div>
  )
}

/** The task's own material — the photos of Part 1.2 and the framing text. The
 *  student needs them in view for every question of the task, not just the first. */
function TaskMaterial({ step }: { step: SpeakingStep }) {
  const { prompt, images, debate } = step.task
  const hasImages = !!images?.length
  if (!hasImages && !prompt.html && !debate) return null
  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      {prompt.title && <h2 className="font-extrabold text-heading">{prompt.title}</h2>}
      {prompt.html && (
        <div
          className="mt-1.5 space-y-2 text-sm text-ink-soft [&_strong]:font-bold [&_strong]:text-ink"
          dangerouslySetInnerHTML={{ __html: prompt.html }}
        />
      )}
      {debate && <DebateCard debate={debate} hasImage={hasImages} />}
      {hasImages && (
        <div className={`mt-4 grid grid-cols-1 gap-3 ${images!.length > 1 ? 'sm:grid-cols-2' : ''}`}>
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


/**
 * Part 3's prompt, in the shape the paper prints it: the proposition on its own,
 * highlighted, then the suggested arguments in two columns. Running these
 * together as a paragraph — which is how the samples library stores them — hid
 * the one line the student has to argue, which is what students reported.
 *
 * Most papers keep their points inside the prompt IMAGE, so the columns are
 * rendered only when we actually have them; the statement alone is still worth
 * pulling out.
 */
function DebateCard({ debate, hasImage }: { debate: SpeakingDebate; hasImage: boolean }) {
  const hasPoints = debate.for.length > 0 || debate.against.length > 0
  return (
    <div className="mt-4">
      <div className="rounded-xl border border-brand/25 bg-brand-soft p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">Main question</p>
        <p className="mt-1.5 text-lg font-extrabold leading-snug text-heading">
          {debate.statement}
        </p>
      </div>

      {hasPoints ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PointList tone="for" points={debate.for} />
          <PointList tone="against" points={debate.against} />
        </div>
      ) : (
        hasImage && (
          <p className="mt-3 text-sm text-ink-soft">
            The points for and against are on the prompt below.
          </p>
        )
      )}
    </div>
  )
}

function PointList({ tone, points }: { tone: 'for' | 'against'; points: string[] }) {
  if (points.length === 0) return null
  const isFor = tone === 'for'
  return (
    <div
      className={`rounded-xl border p-4 ${
        isFor ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
      }`}
    >
      <p
        className={`text-[11px] font-bold uppercase tracking-[0.08em] ${
          isFor ? 'text-emerald-800' : 'text-rose-800'
        }`}
      >
        {isFor ? 'For' : 'Against'}
      </p>
      <ul className="mt-2 space-y-1.5">
        {points.map((point) => (
          <li key={point} className="flex gap-2 text-sm text-ink">
            <span aria-hidden className={isFor ? 'text-emerald-700' : 'text-rose-700'}>
              •
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
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
