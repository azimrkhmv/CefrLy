import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MicCheck } from '../components/speaking/MicCheck'
import { QuestionRunner, type StepAnswer } from '../components/speaking/QuestionRunner'
import { SpeakingTopBar } from '../components/speaking/SpeakingTopBar'
import { CheckIcon, PlayIcon } from '../components/icons'
import { useSpeakingTest } from '../lib/speakingCatalog'
import { questionCount, speakingSteps, type SpeakingStep } from '../lib/speakingQuestions'
import {
  clearSpeakingDraft,
  readSpeakingDraft,
  saveSpeakingDraft,
  type SpeakingDraft,
} from '../lib/speakingDraft'
import {
  addSpeakingAttempt,
  removeSpeakingAttempt,
  type SpeakingAnswer,
} from '../lib/speakingAttempts'
import { gradeSpeakingAttempt } from '../lib/speakingGrading'
import { PlanLimitError } from '../lib/api'
import { PaidSkillDialog } from '../components/PaidSkillDialog'
import { hasPremiumAccess } from '../lib/plans'
import { useAuth } from '../lib/auth'
import { cancelSpeech } from '../lib/speech'
import type { SpeakingTest } from '../types/test'

// The speaking exam takes over the whole viewport — no app shell — so the
// student concentrates on the paper. Same portal trick as Writing and Reading:
// the shell wraps routes in a transform-animated <main>, which would otherwise
// re-anchor this `fixed` overlay to itself instead of the viewport.
//
// The top bar follows the SAME pattern as every other exam (Exit on the left,
// paper identity beside it, actions on the right) so the four skills feel like
// one product — but it carries NO timer and NO pause: a speaking answer runs as
// long as the student needs it to.
function ExamScreen({ children, center }: { children: ReactNode; center?: boolean }) {
  return createPortal(
    <div
      className={`fixed inset-0 z-50 bg-page ${
        center ? 'flex items-center justify-center px-4 py-10' : 'flex flex-col'
      }`}
    >
      {children}
    </div>,
    document.body,
  )
}

type Confirm = 'exit' | 'submit' | null

export function SpeakingTaskPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { test, isLoading } = useSpeakingTest(id)

  // The papers are fetched from the samples library, so a direct link (or a
  // reload mid-attempt) can land here before they arrive.
  if (isLoading) {
    return (
      <ExamScreen center>
        <div className="space-y-3 text-center">
          <div className="skeleton mx-auto h-6 w-52 rounded-full" />
          <div className="skeleton mx-auto h-4 w-36 rounded-full" />
        </div>
      </ExamScreen>
    )
  }

  if (!test) {
    return (
      <ExamScreen center>
        <div className="space-y-4 text-center">
          <p className="text-sm text-rose-700">This speaking task could not be found.</p>
          <Link
            to="/speaking"
            className="inline-block rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Back to Speaking
          </Link>
        </div>
      </ExamScreen>
    )
  }

  // Keyed on the test id so opening another card always re-runs the mic check.
  return <SpeakingRunner key={test.id} test={test} onLeave={() => navigate('/speaking')} />
}

function SpeakingRunner({ test, onLeave }: { test: SpeakingTest; onLeave: () => void }) {
  // Whether this student's plan can get an AI check is said UP FRONT, on the
  // mic check — finding out after ten minutes of speaking would feel like a trap.
  const { plan } = useAuth()
  const locked = !hasPremiumAccess(plan)
  // A broken microphone discovered mid-exam costs the whole attempt, so every
  // attempt opens on the mic check.
  const [checked, setChecked] = useState(false)
  const [draft, setDraft] = useState<SpeakingDraft>(
    () => readSpeakingDraft(test.id) ?? { startedAt: Date.now(), recorded: {}, stepIndex: 0 },
  )
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [submitted, setSubmitted] = useState(false)
  const [localAttemptId, setLocalAttemptId] = useState<string | null>(null)

  // Recorded audio lives here, NOT in the draft: blobs cannot go in
  // localStorage, so they last only as long as this page does.
  const [answers, setAnswers] = useState<Record<string, StepAnswer>>({})

  const steps = useMemo(() => speakingSteps(test), [test])

  useEffect(() => {
    if (submitted) return
    saveSpeakingDraft(test.id, draft)
  }, [test.id, draft, submitted])

  // Nothing should still be talking once the exam screen goes away.
  useEffect(() => () => cancelSpeech(), [])

  // The catalog blocks locked plans on the Start button, but a bookmark or a
  // pasted link would walk straight past it.
  if (locked) {
    return (
      <ExamScreen center>
        <PaidSkillDialog open skill="Speaking" onClose={onLeave} />
      </ExamScreen>
    )
  }

  if (!checked) {
    return (
      <ExamScreen>
        <SpeakingTopBar
          title={test.title}
          subtitle="Before you start"
          onExit={onLeave}
          exitLabel="Exit"
        />
        <MicCheck
          bullets={instructionsFor(test, hasPremiumAccess(plan))}
          onContinue={() => setChecked(true)}
        />
      </ExamScreen>
    )
  }

  if (submitted) {
    return (
      <Finished
        test={test}
        steps={steps}
        answers={answers}
        localAttemptId={localAttemptId}
        onLeave={onLeave}
      />
    )
  }

  const index = Math.min(draft.stepIndex, steps.length - 1)
  const step = steps[index]
  const isLast = index === steps.length - 1
  const answeredCount = steps.filter((s) => answers[s.id]).length
  const anyUnanswered = answeredCount < steps.length

  const submit = () => {
    const rows: SpeakingAnswer[] = steps.map((s) => {
      const a = answers[s.id]
      return {
        taskId: s.taskId,
        taskLabel: s.label,
        partType: s.task.partType,
        questionIndex: s.questionIndex,
        questionText: s.question.text,
        durationSec: a?.durationSec ?? 0,
        recordingSrc: a?.url,
      }
    })
    // Recorded locally straight away so the attempt survives even if the AI
    // check never happens (Free plan, or a failed grade). It is removed again
    // once the server has a graded record of the same sitting.
    const local = addSpeakingAttempt({
      testId: test.id,
      title: test.title,
      scope: (test.scope ?? 'full') as 'full' | 'part',
      partType: (test.scope ?? 'full') === 'part' ? test.tasks[0].partType : undefined,
      answers: rows,
    })
    setLocalAttemptId(local.id)
    clearSpeakingDraft(test.id)
    cancelSpeech()
    setSubmitted(true)
  }

  const handleSubmitClick = () => {
    if (anyUnanswered) setConfirm('submit')
    else submit()
  }

  const leave = () => {
    clearSpeakingDraft(test.id)
    cancelSpeech()
    onLeave()
  }

  return (
    <ExamScreen>
      <SpeakingTopBar
        title={test.title}
        subtitle={`${step.label} · Question ${index + 1} of ${steps.length}`}
        onExit={() => setConfirm('exit')}
        exitTitle="Leave — this attempt will be cancelled."
      >
        <span className="tnum hidden text-sm font-bold text-ink-soft sm:inline">
          {answeredCount}/{steps.length} answered
        </span>
        <button
          type="button"
          onClick={handleSubmitClick}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          Submit
        </button>
      </SpeakingTopBar>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <QuestionRunner
          // Remount per question: each step re-asks aloud with a clean recorder.
          key={step.id}
          step={step}
          stepNumber={index + 1}
          totalSteps={steps.length}
          existing={answers[step.id]}
          isLast={isLast}
          onAnswered={(a) => {
            setAnswers((prev) => ({ ...prev, [step.id]: a }))
            setDraft((d) => ({ ...d, recorded: { ...d.recorded, [step.id]: a.durationSec } }))
          }}
          onNext={() => {
            if (isLast) handleSubmitClick()
            else setDraft((d) => ({ ...d, stepIndex: Math.min(d.stepIndex + 1, steps.length - 1) }))
          }}
        />
      </div>

      {/* Exit = cancel the attempt (same discard contract as Reading/Writing). */}
      <ConfirmDialog
        open={confirm === 'exit'}
        title="Leave this speaking task?"
        message="This attempt will be cancelled and your recordings will be discarded."
        confirmLabel="Leave & cancel"
        cancelLabel="Keep speaking"
        tone="rose"
        onConfirm={leave}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'submit'}
        title="Submit now?"
        message={`${steps.length - answeredCount} of ${steps.length} question${
          steps.length - answeredCount === 1 ? ' has' : 's have'
        } no recording. You can still submit.`}
        confirmLabel="Submit anyway"
        cancelLabel="Keep speaking"
        tone="brand"
        onConfirm={() => {
          setConfirm(null)
          submit()
        }}
        onCancel={() => setConfirm(null)}
      />
    </ExamScreen>
  )
}

/** The "before you start" bullets, derived from the paper itself. */
function instructionsFor(test: SpeakingTest, canCheck: boolean): string[] {
  const isFull = (test.scope ?? 'full') === 'full'
  const total = questionCount(test)
  const steps = speakingSteps(test)
  // Show the real clock rather than a vague promise: the windows differ inside a
  // part (Part 1.2 gives 45s for the comparison, 30s for each follow-up).
  const windows = [...new Set(steps.map((s) => `${s.prepSec}s + ${s.speakSec}s`))]
  return [
    'Ensure your microphone is enabled',
    isFull
      ? `You will speak on ${test.tasks.length} parts — ${total} questions in total`
      : `${test.tasks[0].label}: ${total} question${total > 1 ? 's' : ''} about familiar topics`,
    'Each question is read aloud, then you get preparation time before recording starts by itself',
    `Preparation + speaking time per question: ${windows.join(', ')}`,
    'Recording stops on its own when the time is up — you cannot speak past it',
    canCheck
      ? 'When you finish, AI checks your answers and gives your band score'
      : 'AI band scoring needs Pro or Premium — on the Free plan you will not get a score for this attempt',
  ]
}

/** Post-attempt: send the recordings for an AI check, then hand over to the
 *  analysis. Free-plan students see the upgrade wall instead — the check is a
 *  Pro/Premium feature, and we make that clear before the exam, not only here. */
function Finished({
  test,
  steps,
  answers,
  localAttemptId,
  onLeave,
}: {
  test: SpeakingTest
  steps: SpeakingStep[]
  answers: Record<string, StepAnswer>
  /** The local record of this sitting, dropped once the server grades it. */
  localAttemptId: string | null
  onLeave: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { plan } = useAuth()
  const canCheck = hasPremiumAccess(plan)

  const spoken = steps.reduce((n, s) => n + (answers[s.id]?.durationSec ?? 0), 0)
  const recorded = steps.filter((s) => answers[s.id]).length

  const [state, setState] = useState<'idle' | 'sending' | 'error'>(canCheck ? 'sending' : 'idle')
  const [message, setMessage] = useState<string | null>(null)
  const [locked, setLocked] = useState<PlanLimitError | null>(null)
  const started = useRef(false)

  const send = useCallback(async () => {
    setState('sending')
    setMessage(null)
    try {
      const attemptId = await gradeSpeakingAttempt({
        test: {
          id: test.id,
          title: test.title,
          scope: (test.scope ?? 'full') as 'full' | 'part',
          partType: test.scope === 'part' ? test.tasks[0].partType : null,
        },
        steps,
        answers,
      })
      // The server now owns this sitting; drop the local copy so My Results and
      // the catalog never count it twice.
      if (localAttemptId) removeSpeakingAttempt(localAttemptId)
      void queryClient.invalidateQueries({ queryKey: ['speaking-attempts'] })
      // replace(): the exam screen is finished, so Back should not return to it.
      navigate(`/speaking/analyze/${attemptId}`, { replace: true })
    } catch (e) {
      if (e instanceof PlanLimitError) {
        setLocked(e)
        setState('idle')
        return
      }
      setMessage(e instanceof Error ? e.message : 'The AI check failed.')
      setState('error')
    }
  }, [test, steps, answers, navigate, localAttemptId, queryClient])

  // Send once, automatically — the recordings only live in this page, so
  // waiting for a click risks losing them to a stray reload.
  useEffect(() => {
    if (!canCheck || started.current) return
    started.current = true
    void send()
  }, [canCheck, send])

  return (
    <ExamScreen>
      <SpeakingTopBar title={test.title} subtitle="Attempt complete" onExit={onLeave}>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
        >
          Back to Speaking
        </button>
      </SpeakingTopBar>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="rounded-2xl border border-line bg-white p-6 text-center shadow-card">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-800">
              <CheckIcon width={26} height={26} />
            </span>
            <h2 className="mt-3 text-xl font-extrabold text-heading">Attempt complete</h2>
            <p className="tnum mt-1 text-sm text-ink-soft">
              {recorded} of {steps.length} answered · {Math.round(spoken)}s spoken
            </p>

            {state === 'sending' && (
              <p className="mt-4 text-sm font-bold text-brand">
                Sending your answers to be checked…
              </p>
            )}

            {state === 'error' && (
              <div className="mt-4">
                <p className="text-sm text-rose-700">{message}</p>
                <button
                  type="button"
                  onClick={() => void send()}
                  className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
                >
                  Try again
                </button>
                <p className="mt-2 text-xs text-ink-soft">
                  Keep this page open — your recordings are only held here.
                </p>
              </div>
            )}

            {!canCheck && !locked && (
              <UpgradeWall
                title="Get your CEFR band for this attempt"
                body="An AI check gives you a band score, your transcript, your mistakes and a stronger version of every answer. It is part of Pro and Premium."
              />
            )}

            {locked && (
              <UpgradeWall
                title={locked.code === 'premium_only' ? 'AI checks are a paid feature' : 'Monthly checks used up'}
                body={locked.message}
              />
            )}
          </div>

          <ol className="space-y-3">
            {steps.map((s, i) => (
              <AnswerRow key={s.id} n={i + 1} text={s.question.text} answer={answers[s.id]} />
            ))}
          </ol>

          <p className="text-center text-xs text-ink-soft">
            Your recordings are not saved. After the check they are deleted — only the transcript
            and feedback are kept.
          </p>
        </div>
      </div>
    </ExamScreen>
  )
}

function UpgradeWall({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-5 rounded-2xl bg-brand-soft p-5 text-left">
      <h3 className="font-extrabold text-heading">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
      <Link
        to="/pricing"
        className="mt-3 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
      >
        See plans
      </Link>
    </div>
  )
}

function AnswerRow({ n, text, answer }: { n: number; text: string; answer?: StepAnswer }) {
  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex gap-3">
        <span className="tnum shrink-0 font-bold text-brand">{n}.</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{text}</p>
          {answer ? (
            <div className="mt-2.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void new Audio(answer.url).play().catch(() => {})}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink transition-colors hover:border-ink-faint"
              >
                <PlayIcon width={14} height={14} />
                Play
              </button>
              <span className="tnum text-xs text-ink-soft">{Math.round(answer.durationSec)}s</span>
            </div>
          ) : (
            <p className="mt-1.5 text-xs font-bold text-ink-soft">Not answered</p>
          )}
        </div>
      </div>
    </li>
  )
}
