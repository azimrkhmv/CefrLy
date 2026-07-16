import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Timer } from '../components/test/Timer'
import { ConfirmDialog } from '../components/ConfirmDialog'
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
import type { WritingTask, WritingTest } from '../types/test'

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
  const tasks = test.tasks
  const isFull = (test.scope ?? 'full') === 'full'

  // Resume an in-progress draft, or start a fresh one. The draft carries the
  // clock start, every task's text, and which task the student is on.
  const [draft, setDraft] = useState<WritingDraft>(() => {
    const existing = readWritingDraft(test.id)
    return existing ?? { startedAt: Date.now(), answers: {}, taskIndex: 0 }
  })
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [submitted, setSubmitted] = useState(false)

  // Autosave every change so a refresh / accidental exit loses nothing. Guarded
  // inside saveWritingDraft — blocked/full storage must never crash the exam.
  useEffect(() => {
    if (submitted) return
    saveWritingDraft(test.id, draft)
  }, [test.id, draft, submitted])

  const expiresAt = useMemo(
    () => new Date(draft.startedAt + test.durationSec * 1000).toISOString(),
    [draft.startedAt, test.durationSec],
  )

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

  const submit = () => {
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
    addWritingAttempt({
      testId: test.id,
      title: test.title,
      scope: test.scope ?? 'full',
      taskType: isFull ? undefined : tasks[0]?.taskType,
      answers,
    })
    clearWritingDraft(test.id)
    setSubmitted(true)
  }

  // Auto-submit when the clock runs out (saves whatever is written so far).
  const onExpire = () => {
    if (!submitted) submit()
  }

  const handleSubmitClick = () => {
    if (anyUnderMin) setConfirm('submit')
    else submit()
  }

  const leave = () => {
    clearWritingDraft(test.id)
    onLeave()
  }

  if (submitted) return <SubmittedScreen onLeave={onLeave} />

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
              <h1 className="truncate text-base font-extrabold text-heading">{test.title}</h1>
              <p className="hidden text-xs text-ink-soft sm:block">
                {task.label} · {wordGuidance(task)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Timer expiresAt={expiresAt} onExpire={onExpire} />
            <button
              type="button"
              onClick={handleSubmitClick}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              Submit
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
              placeholder="Write your answer here…"
              className="min-h-[24rem] flex-1 resize-y rounded-xl border border-line bg-page px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <p className="mt-2 text-xs text-ink-soft">
              {metMin
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
          submit()
        }}
        onCancel={() => setConfirm(null)}
      />
    </ExamScreen>
  )
}

/** Calm post-submit confirmation — no grader yet, so no score/celebration. */
function SubmittedScreen({ onLeave }: { onLeave: () => void }) {
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
          <h1 className="text-xl font-extrabold text-heading">Submitted ✓</h1>
          <p className="text-sm text-ink-soft">
            Your writing is saved. Detailed feedback is coming soon — we&rsquo;ll let you know when
            grading is ready.
          </p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          Back to Writing
        </button>
      </div>
    </ExamScreen>
  )
}
