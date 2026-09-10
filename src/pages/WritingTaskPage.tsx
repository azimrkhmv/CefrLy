import { useEffect, useMemo, useState, type ReactNode, type SVGProps } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Timer } from '../components/test/Timer'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PaidSkillDialog } from '../components/PaidSkillDialog'
import { hasPremiumAccess } from '../lib/plans'
import { useAuth } from '../lib/auth'
import { WritingModePicker } from '../components/writing/WritingModePicker'
import { CloseIcon } from '../components/icons'
import { findWritingTest } from '../lib/writingCatalog'
import { useCustomWritingTests } from '../lib/writingCustom'
import {
  clearWritingDraft,
  readWritingDraft,
  saveWritingDraft,
  type WritingDraft,
} from '../lib/writingDraft'
import { addWritingAttempt, type WritingAnswer } from '../lib/writingAttempts'
import { submitWritingAttempt } from '../lib/writingGrading'
import { PlanLimitError } from '../lib/api'
import type { TestMode, WritingTask, WritingTest } from '../types/test'

// The writing exam takes over the whole viewport — no app shell — so the student
// concentrates on the paper. Portalled to <body> for the same reason TestPage is:
// the shell wraps routes in a transform-animated <main>, which would otherwise
// re-anchor this `fixed` overlay to itself instead of the viewport.
function ExamScreen({ children, center }: { children: ReactNode; center?: boolean }) {
  return createPortal(
    <div
      className={`fixed inset-0 z-50 bg-page ${
        center ? 'flex items-center justify-center px-6 text-center' : 'flex flex-col'
      }`}
    >
      {children}
    </div>,
    document.body,
  )
}

const countWords = (s: string) => {
  const t = s.trim()
  return t ? t.split(/\s+/).length : 0
}

const wordGuidance = (task: WritingTask) =>
  task.maxWords
    ? `Write ${task.minWords}–${task.maxWords} words`
    : `Write at least ${task.minWords} words`

/**
 * The Writing test screen (Phase 4, UI-first — no grader). Reuses the exam-player
 * shell + the reading `Timer`, but runs entirely client-side: the countdown is
 * derived from a `startedAt` stamp in the localStorage draft (no server session
 * yet), and Submit saves a local writing attempt. Single-task drills and custom
 * questions auto-start; the full Mock runs its 3 tasks on ONE combined clock with
 * a task stepper. Refresh / accidental exit resumes the clock AND the typed text.
 */
export function WritingTaskPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const custom = useCustomWritingTests()
  const test = id ? findWritingTest(id, custom) : undefined

  if (!test) {
    return (
      <ExamScreen center>
        <div className="space-y-4">
          <p className="text-sm text-rose-700">This writing task could not be found.</p>
          <Link
            to="/writing"
            className="inline-block rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Back to Writing
          </Link>
        </div>
      </ExamScreen>
    )
  }

  // Keyed on the test id so switching tasks (a fresh route) remounts the runner
  // with its own draft/clock rather than carrying the previous task's state.
  return <WritingRunner key={test.id} test={test} onLeave={() => navigate('/writing')} />
}

type Confirm = 'exit' | 'submit' | null

function WritingRunner({ test, onLeave }: { test: WritingTest; onLeave: () => void }) {
  // The catalog blocks locked plans on the Start button, but a bookmark or a
  // pasted link would walk straight past it.
  const { plan } = useAuth()
  const locked = !hasPremiumAccess(plan)
  const tasks = test.tasks
  const isFull = (test.scope ?? 'full') === 'full'

  // Resume an in-progress draft, or show the mode picker (null draft). Every
  // task AND the full mock starts at the picker — Simulation vs Practice — the
  // same choice Reading and Listening offer. The chosen mode + deadline live in
  // the draft, so a refresh resumes the attempt without re-asking.
  const [draft, setDraft] = useState<WritingDraft | null>(() => readWritingDraft(test.id))
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [submitted, setSubmitted] = useState(false)

  // Autosave every change so a refresh / accidental exit loses nothing. Guarded
  // inside saveWritingDraft — blocked/full storage must never crash the exam.
  useEffect(() => {
    if (submitted || !draft) return
    saveWritingDraft(test.id, draft)
  }, [test.id, draft, submitted])

  // Mode chosen → start the clock. Practice sends the student's own limit,
  // simulation the fixed test duration.
  const startAttempt = (mode: TestMode, durationSec: number) => {
    const now = Date.now()
    setDraft({
      mode,
      // Minted HERE, not at submit: the id has to survive a reload mid-exam so
      // the finished paper is marked once, under one attempt.
      attemptId: crypto.randomUUID(),
      startedAt: now,
      expiresAt: now + durationSec * 1000,
      pausedAt: null,
      answers: {},
      taskIndex: 0,
    })
  }


  if (locked) {
    return (
      <ExamScreen center>
        <PaidSkillDialog open skill="Writing" onClose={onLeave} />
      </ExamScreen>
    )
  }

  if (!draft) {
    return (
      <ExamScreen center>
        <button
          type="button"
          onClick={onLeave}
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint sm:left-6 sm:top-6"
        >
          <BackIcon width={18} height={18} />
          <span className="hidden sm:inline">Back to Writing</span>
        </button>
        <WritingModePicker test={test} onStart={startAttempt} />
      </ExamScreen>
    )
  }

  return (
    <RunningWriting
      test={test}
      tasks={tasks}
      isFull={isFull}
      draft={draft}
      setDraft={setDraft as (fn: (d: WritingDraft) => WritingDraft) => void}
      confirm={confirm}
      setConfirm={setConfirm}
      submitted={submitted}
      setSubmitted={setSubmitted}
      onLeave={onLeave}
    />
  )
}

// The running exam — split out so it only mounts once a mode is chosen (the
// draft is guaranteed non-null here).
function RunningWriting({
  test,
  tasks,
  isFull,
  draft,
  setDraft,
  confirm,
  setConfirm,
  submitted,
  setSubmitted,
  onLeave,
}: {
  test: WritingTest
  tasks: WritingTask[]
  isFull: boolean
  draft: WritingDraft
  setDraft: (fn: (d: WritingDraft) => WritingDraft) => void
  confirm: Confirm
  setConfirm: (c: Confirm) => void
  submitted: boolean
  setSubmitted: (v: boolean) => void
  onLeave: () => void
}) {
  const isPractice = draft.mode === 'practice'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  // A retry after a failed send must not file the paper locally a second time,
  // nor mint a second attempt id — the server upserts by id, so keeping it
  // stable is what makes retrying idempotent instead of opening a new attempt
  // (and, once quotas bite, paying for one).
  const [handedIn, setHandedIn] = useState(false)

  const expiresAt = useMemo(() => new Date(draft.expiresAt).toISOString(), [draft.expiresAt])
  const pausedAtIso = draft.pausedAt ? new Date(draft.pausedAt).toISOString() : null

  // Practice pause/resume — freezing the clock shifts the deadline forward by the
  // paused span on resume, so no time is lost. The Timer reads pausedAt directly.
  const togglePause = () =>
    setDraft((d) => {
      if (d.pausedAt) {
        const paused = Date.now() - d.pausedAt
        return { ...d, expiresAt: d.expiresAt + paused, pausedAt: null }
      }
      return { ...d, pausedAt: Date.now() }
    })

  const taskIndex = Math.min(draft.taskIndex, tasks.length - 1)
  const task = tasks[taskIndex]
  const text = draft.answers[task.id] ?? ''
  const words = countWords(text)
  const metMin = words >= task.minWords

  const setText = (value: string) =>
    setDraft((d) => ({ ...d, answers: { ...d.answers, [task.id]: value } }))
  const goToTask = (i: number) => setDraft((d) => ({ ...d, taskIndex: i }))

  const anyUnderMin = tasks.some(
    (t) => countWords(draft.answers[t.id] ?? '') < t.minWords,
  )

  /**
   * Hand the paper in.
   *
   * The local copy is written FIRST and always. Sending can fail — a dropped
   * connection, a plan wall — and an exam that ate an hour of somebody's
   * afternoon must not be able to vanish because a fetch did. Only then is it
   * sent for marking; the report page polls from there.
   */
  const submit = async () => {
    if (sending || submitted) return
    const answers: WritingAnswer[] = tasks.map((t) => {
      const value = draft.answers[t.id] ?? ''
      return {
        taskId: t.id,
        taskLabel: t.label,
        taskType: t.taskType,
        text: value,
        wordCount: countWords(value),
      }
    })
    if (!handedIn) {
      addWritingAttempt({
        testId: test.id,
        title: test.title,
        scope: test.scope ?? 'full',
        taskType: isFull ? undefined : tasks[0]?.taskType,
        answers,
      })
      setHandedIn(true)
    }

    // Older drafts predate the id; mint one and put it BACK in the draft so a
    // retry — or a reload — sends the same attempt.
    let attemptId = draft.attemptId
    if (!attemptId) {
      attemptId = crypto.randomUUID()
      setDraft((d) => ({ ...d, attemptId }))
    }
    const written = answers.some((a) => a.text.trim())
    setSending(true)
    setSubmitted(true)
    try {
      // A paper with nothing on it is not sent: there is nothing to mark, and
      // it would spend one of the student's monthly checks to be told so.
      if (!written) throw new Error('blank')
      await submitWritingAttempt({ test, answers: draft.answers, attemptId })
      clearWritingDraft(test.id)
      // The catalog's Completed state and My results both read these.
      void queryClient.invalidateQueries({ queryKey: ['writing-attempts'] })
      navigate(`/writing/analyze/${attemptId}`, { replace: true })
    } catch (e) {
      // The draft is deliberately KEPT when sending failed, so "Check again"
      // has something to send and a refresh does not lose the answers.
      setSendError(
        e instanceof PlanLimitError
          ? e.message
          : (e as Error).message === 'blank'
            ? 'There is nothing written to check.'
            : 'Your writing is saved, but the check could not be sent. Try again in a moment.',
      )
    } finally {
      setSending(false)
    }
  }

  // Auto-submit when the clock runs out (hands in whatever is written so far).
  const onExpire = () => {
    if (!submitted) void submit()
  }

  const handleSubmitClick = () => {
    if (anyUnderMin) setConfirm('submit')
    else void submit()
  }

  const leave = () => {
    clearWritingDraft(test.id)
    onLeave()
  }

  if (submitted) {
    return (
      <SubmittedScreen
        sending={sending}
        error={sendError}
        onRetry={() => {
          setSubmitted(false)
          setSendError(null)
        }}
        onLeave={onLeave}
      />
    )
  }

  return (
    <ExamScreen>
      {/* Slim exam top bar — replaces the app shell. */}
      <header className="shrink-0 border-b border-line bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setConfirm('exit')}
              title="Leave — this attempt will be cancelled."
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              <CloseIcon width={18} height={18} />
              <span className="hidden sm:inline">Exit</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-extrabold text-heading">{test.title}</h1>
                <span className="hidden shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand sm:inline">
                  {isPractice ? 'Practice' : 'Simulation'}
                </span>
              </div>
              <p className="hidden text-xs text-ink-soft sm:block">
                {task.label} · {wordGuidance(task)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Timer expiresAt={expiresAt} onExpire={onExpire} pausedAt={pausedAtIso} />
            {isPractice && (
              <button
                type="button"
                onClick={togglePause}
                className="rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
              >
                {draft.pausedAt ? 'Resume' : 'Pause'}
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={sending}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Submit'}
            </button>
          </div>
        </div>

        {/* Full Mock only: a compact task stepper across the one shared clock. */}
        {isFull && tasks.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-t border-line px-4 py-2 sm:px-6">
            {tasks.map((t, i) => {
              const done = countWords(draft.answers[t.id] ?? '') >= t.minWords
              const active = i === taskIndex
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => goToTask(i)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                    active
                      ? 'bg-brand text-white'
                      : 'text-ink-soft hover:bg-brand-soft hover:text-brand'
                  }`}
                >
                  {t.label}
                  {done && (
                    <span
                      aria-hidden
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        active ? 'bg-white' : 'bg-emerald-500'
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </header>

      {/* Split pane: the writing task on the left, the answer on the right. */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-2">
          {/* Writing task */}
          <div className="self-start rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
            <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
              {task.label}
            </span>
            {task.prompt.title && (
              <h2 className="mt-3 text-lg font-extrabold text-heading">{task.prompt.title}</h2>
            )}
            <div
              className="passage mt-2 text-ink"
              dangerouslySetInnerHTML={{ __html: task.prompt.html }}
            />
            {task.image && (
              <figure className="mt-4">
                <img
                  src={task.image.src}
                  alt={task.image.alt}
                  className="max-h-80 w-full rounded-xl border border-line object-contain"
                />
                {task.image.caption && (
                  <figcaption className="mt-1.5 text-center text-xs text-ink-soft">
                    {task.image.caption}
                  </figcaption>
                )}
              </figure>
            )}
          </div>

          {/* Your answer */}
          <div className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-extrabold text-heading">Your answer</h3>
              <span
                className={`tnum text-sm font-bold ${metMin ? 'text-emerald-700' : 'text-ink-soft'}`}
                aria-live="polite"
              >
                Words: {words}
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!!draft.pausedAt}
              placeholder="Write your answer here…"
              className="min-h-[24rem] flex-1 resize-y rounded-xl border border-line bg-page px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-2 text-xs text-ink-soft">
              {draft.pausedAt
                ? 'Paused — resume the timer to keep writing.'
                : metMin
                  ? 'Word target reached — keep going or submit when you are ready.'
                  : wordGuidance(task) + '.'}
            </p>
          </div>
        </div>
      </div>

      {/* Exit = cancel the attempt (same discard contract as Reading). */}
      <ConfirmDialog
        open={confirm === 'exit'}
        title="Leave this writing task?"
        message="This attempt will be cancelled and your answer will be discarded."
        confirmLabel="Leave & cancel"
        cancelLabel="Keep writing"
        tone="rose"
        onConfirm={leave}
        onCancel={() => setConfirm(null)}
      />

      {/* Under the word minimum — confirm before submitting. */}
      <ConfirmDialog
        open={confirm === 'submit'}
        title="Submit now?"
        message={
          isFull
            ? 'One or more tasks are below the suggested word count. You can still submit.'
            : `You have written fewer than ${task.minWords} words. You can still submit.`
        }
        confirmLabel="Submit anyway"
        cancelLabel="Keep writing"
        tone="brand"
        onConfirm={() => {
          setConfirm(null)
          void submit()
        }}
        onCancel={() => setConfirm(null)}
      />
    </ExamScreen>
  )
}

function BackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

/**
 * The moment between handing in and the report.
 *
 * On the happy path this is on screen for a heartbeat — the navigate to the
 * report happens as soon as the server has the paper. It matters when sending
 * FAILED: the student needs to know their work is not lost and be able to try
 * again, which is why the draft is kept until a send succeeds.
 */
function SubmittedScreen({
  sending,
  error,
  onRetry,
  onLeave,
}: {
  sending: boolean
  error: string | null
  onRetry: () => void
  onLeave: () => void
}) {
  return (
    <ExamScreen center>
      <div className="max-w-md space-y-5 rounded-2xl border border-line bg-white p-8 shadow-card">
        <img
          src="/cat-read-grey.png"
          alt=""
          aria-hidden
          draggable={false}
          className="mx-auto block h-24 w-auto select-none"
        />
        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold text-heading">
            {error ? 'Saved, but not sent' : sending ? 'Handing it in…' : 'Submitted ✓'}
          </h1>
          <p className="text-sm text-ink-soft">
            {error ?? 'Sending your writing to the examiner. Your report opens in a moment.'}
          </p>
        </div>
        {error ? (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              Back to the paper
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
            >
              Back to Writing
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Back to Writing
          </button>
        )}
      </div>
    </ExamScreen>
  )
}
