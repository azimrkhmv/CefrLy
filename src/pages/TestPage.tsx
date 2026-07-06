import { useEffect, useMemo, useState, type ReactNode, type SVGProps } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  controlSession,
  fetchSanitizedTest,
  fetchSessionStatus,
  startSession,
  submitTest,
} from '../lib/api'
import { useAnswersStore } from '../store/answers'
import { useAudioStore } from '../store/audio'
import {
  partItems,
  type SanitizedListeningPart,
  type SanitizedPart,
  type SanitizedTest,
  type TestMode,
} from '../types/test'
import { PartRenderer } from '../components/test/PartRenderer'
import { ListeningPartRenderer } from '../components/test/listening/ListeningPartRenderer'
import { ListeningAudio } from '../components/test/ListeningAudio'
import { QuestionNavigator } from '../components/test/QuestionNavigator'
import { Timer } from '../components/test/Timer'
import { ModePicker } from '../components/test/ModePicker'
import { CloseIcon } from '../components/icons'

const draftKey = (sessionId: string) => `cefrly-draft-${sessionId}`

// The exam takes over the whole viewport — no app sidebar/header — so students
// can concentrate on the paper. It renders through a portal to <body> because
// the app shell wraps every route in a `transform`-animated <main>, and a
// transformed ancestor would otherwise re-anchor `position: fixed` to itself
// instead of the viewport, breaking the full-screen overlay.
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

export function TestPage() {
  const { testId } = useParams<{ testId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [partIndex, setPartIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const reset = useAnswersStore((s) => s.reset)
  const answeredCount = useAnswersStore(
    (s) => Object.values(s.answers).filter((v) => v.trim() !== '').length,
  )

  // Step 1 — a read-only peek: does the student already have an open session,
  // and what skill is this? This never starts a clock, so the "Choose a mode"
  // picker can appear first for a fresh reading attempt.
  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: ['session-status', testId],
    queryFn: () => fetchSessionStatus(testId!),
    enabled: !!testId,
    // Always re-peek on mount: a cached "no session" / "session open" answer
    // goes stale the moment an attempt starts, ends or is abandoned.
    staleTime: 0,
    retry: 1,
  })

  // The picker is the landing screen for EVERY attempt: it always shows until
  // the student picks a mode or hits Resume (`started`). It never silently drops
  // into a stale leftover session — that was the bug. If an attempt is already
  // open, the picker offers a Resume button (see below); get-test then reuses
  // that session. Both Reading and Listening use the picker; Practice unlocks
  // audio controls (ListeningAudio).
  const hasOpenSession = !!status?.session
  const showPicker = !!status && !started
  const readyToLoad = !!status && started
  const catalogPath = status?.skill === 'listening' ? '/listening' : '/reading'

  const {
    data: test,
    isLoading: testLoading,
    error: testError,
  } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => fetchSanitizedTest(testId!),
    enabled: !!testId && readyToLoad,
    staleTime: Infinity,
    retry: 1,
  })

  const sessionId = test?.session.id

  // Begin a session in the chosen mode, then load the paper. start-session
  // closes any session still open for this test first, so choosing a mode is a
  // REAL restart — the picker's "start over" promise is true. (Resume bypasses
  // this and goes straight to get-test, which reuses the open session.)
  const start = useMutation({
    mutationFn: ({ mode, durationSec }: { mode: TestMode; durationSec: number }) =>
      startSession(testId!, mode, durationSec),
    onSuccess: () => {
      setStarted(true)
      queryClient.invalidateQueries({ queryKey: ['session-status', testId] })
    },
  })

  // Pause / resume the practice timer (server-authoritative). The response
  // carries the fresh session (shifted deadline, cleared/set pausedAt) which we
  // patch straight into the cached test so the Timer reacts immediately.
  const isPaused = !!test?.session.pausedAt
  const control = useMutation({
    mutationFn: (action: 'pause' | 'resume') => controlSession(test!.session.id, action),
    onSuccess: ({ session }) => {
      queryClient.setQueryData<SanitizedTest>(['test', testId], (old) =>
        old ? { ...old, session } : old,
      )
    },
  })

  // Restore the saved draft for this session (survives page refreshes);
  // drop drafts from older sessions.
  useEffect(() => {
    if (!sessionId) return
    reset()
    useAudioStore.getState().reset()
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('cefrly-draft-') && key !== draftKey(sessionId)) {
        localStorage.removeItem(key)
      }
    }
    const saved = localStorage.getItem(draftKey(sessionId))
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as
          | { answers?: Record<string, string>; marked?: Record<string, boolean> }
          | Record<string, string>
        if (parsed && typeof parsed === 'object' && 'answers' in parsed) {
          const draft = parsed as { answers?: Record<string, string>; marked?: Record<string, boolean> }
          useAnswersStore.getState().hydrate(draft.answers ?? {}, draft.marked ?? {})
        } else {
          useAnswersStore.getState().hydrate(parsed as Record<string, string>)
        }
      } catch {
        localStorage.removeItem(draftKey(sessionId))
      }
    }
    return () => reset()
  }, [sessionId, reset])

  // Save every answer/mark change so nothing is lost on refresh.
  useEffect(() => {
    if (!sessionId) return
    return useAnswersStore.subscribe((state) => {
      localStorage.setItem(
        draftKey(sessionId),
        JSON.stringify({ answers: state.answers, marked: state.marked }),
      )
    })
  }, [sessionId])

  const numbering = useMemo(() => {
    const map: Record<string, number> = {}
    let n = 1
    test?.parts.forEach((part) => partItems(part).forEach((item) => (map[item.id] = n++)))
    return map
  }, [test])

  const totalItems = test?.parts.reduce((sum, part) => sum + partItems(part).length, 0) ?? 0

  const submission = useMutation({
    mutationFn: () => submitTest(testId!, useAnswersStore.getState().answers),
    onSuccess: (result) => {
      if (sessionId) localStorage.removeItem(draftKey(sessionId))
      queryClient.removeQueries({ queryKey: ['test', testId] })
      queryClient.removeQueries({ queryKey: ['session-status', testId] })
      reset()
      useAudioStore.getState().reset()
      navigate(`/results/${result.attemptId}`, { state: result, replace: true })
    },
  })

  function jumpToQuestion(itemId: string) {
    if (!test) return
    const index = test.parts.findIndex((part) =>
      partItems(part).some((item) => item.id === itemId),
    )
    if (index === -1) return
    setPartIndex(index)
    // wait for the part to render before scrolling to the question
    setTimeout(() => {
      document.getElementById(`q-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }

  function handleSubmit(auto = false) {
    if (submission.isPending) return
    if (!auto && answeredCount < totalItems) {
      const confirmed = window.confirm(
        `You have answered ${answeredCount} of ${totalItems} questions. Submit anyway?`,
      )
      if (!confirmed) return
    }
    submission.mutate()
  }

  // ---- Pre-exam states ------------------------------------------------------

  if (statusLoading)
    return (
      <ExamScreen center>
        <p className="text-ink-soft">Loading test…</p>
      </ExamScreen>
    )

  if (statusError) {
    return (
      <ExamScreen center>
        <div className="space-y-4">
          <p className="text-sm text-rose-700">
            Could not load the test. {statusError instanceof Error ? statusError.message : ''}
          </p>
          <Link
            to={catalogPath}
            className="inline-block rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Back to tests
          </Link>
        </div>
      </ExamScreen>
    )
  }

  // "Choose a mode" — shown on Start (and whenever there's no open session).
  if (showPicker && status) {
    return (
      <ExamScreen>
        <header className="shrink-0 border-b border-line bg-white">
          <div className="mx-auto flex max-w-4xl items-center px-4 py-3 sm:px-8">
            <Link
              to={catalogPath}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold text-ink-soft transition-colors hover:bg-page hover:text-ink"
            >
              <CloseIcon width={18} height={18} />
              <span>Back to tests</span>
            </Link>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-8">
          <div className="w-full max-w-4xl space-y-6">
            {/* An attempt is still open — offer to resume it rather than lose it. */}
            {hasOpenSession && (
              <div className="flex flex-col gap-4 rounded-2xl border border-brand/30 bg-brand-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-base font-extrabold text-heading">
                    You have an attempt in progress
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    Pick up where you left off — or start over below (your current progress will
                    be cleared).
                  </p>
                </div>
                <button
                  onClick={() => setStarted(true)}
                  className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
                >
                  Resume attempt
                </button>
              </div>
            )}
            <ModePicker
              title={status.title}
              skill={status.skill}
              simulationDurationSec={status.durationSec}
              onStart={(mode, durationSec) => start.mutate({ mode, durationSec })}
              starting={start.isPending}
              error={start.error instanceof Error ? start.error.message : null}
            />
          </div>
        </div>
      </ExamScreen>
    )
  }

  if (testLoading || !test)
    return (
      <ExamScreen center>
        {testError ? (
          <div className="space-y-4">
            <p className="text-sm text-rose-700">
              Could not load the test. {testError instanceof Error ? testError.message : ''}
            </p>
            <Link
              to={catalogPath}
              className="inline-block rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
            >
              Back to tests
            </Link>
          </div>
        ) : (
          <p className="text-ink-soft">Loading test…</p>
        )}
      </ExamScreen>
    )

  // ---- The exam ------------------------------------------------------------

  const part = test.parts[partIndex]
  const isListening = test.skill === 'listening'
  const skillLabel = isListening ? 'Listening' : 'Reading'
  const backTo = catalogPath
  const isPractice = test.session.mode === 'practice'
  // Listening has NO wall clock in either mode — the recordings set the pace
  // (simulation locks them; practice frees them). So no timer and nothing to
  // pause: the pause button is the READING-practice timer control only.
  const canPause = isPractice && !isListening

  return (
    <ExamScreen>
      {/* Slim exam top bar — replaces the app shell. Fixed height so the paper
          below scrolls independently and the timer/submit stay in reach. */}
      <header className="shrink-0 border-b border-line bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link
              to={backTo}
              onClick={(e) => {
                // Never drop out of a live attempt silently — same guard
                // spirit as the incomplete-submit confirm in handleSubmit.
                const message = isListening
                  ? 'Leave the test? Your answers are saved and you can resume this attempt later.'
                  : 'Leave the test? Your answers are saved, but the timer keeps running.'
                if (!window.confirm(message)) e.preventDefault()
              }}
              title={
                isListening
                  ? 'Leave the test — your answers are saved.'
                  : 'Leave the test — your answers are saved and the timer keeps running.'
              }
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              <CloseIcon width={18} height={18} />
              <span className="hidden sm:inline">Exit</span>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold text-heading">{test.title}</h1>
              <p className="hidden text-xs text-ink-soft sm:block">
                {/* Listening is audio-paced — never advertise minutes. */}
                {isListening
                  ? `${skillLabel} · ${totalItems} questions · ${test.parts.length} parts`
                  : `${skillLabel} · ${totalItems} questions · ${Math.round(test.durationSec / 60)} minutes`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="tnum hidden text-sm text-ink-soft sm:inline">
              {answeredCount}/{totalItems} answered
            </span>
            {/* Listening shows no countdown in either mode — audio is the clock.
                Practice gets a reassurance chip in the timer's place. */}
            {isListening ? (
              isPractice && (
                <span className="rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand">
                  No time limit
                </span>
              )
            ) : (
              <Timer
                expiresAt={test.session.expiresAt}
                serverNow={test.session.serverNow}
                pausedAt={test.session.pausedAt}
                onExpire={() => handleSubmit(true)}
              />
            )}
            {canPause && (
              <button
                onClick={() => control.mutate(isPaused ? 'resume' : 'pause')}
                disabled={control.isPending}
                title={isPaused ? 'Resume the timer' : 'Pause the timer'}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${
                  isPaused
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-line bg-white text-ink hover:border-ink-faint'
                }`}
              >
                {isPaused ? <PlayGlyph /> : <PauseGlyph />}
                <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
              </button>
            )}
            <button
              onClick={() => handleSubmit()}
              disabled={submission.isPending}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
            >
              {submission.isPending ? 'Submitting…' : 'Submit test'}
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable paper */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8">
          {submission.isError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
              {submission.error instanceof Error ? submission.error.message : 'Submission failed.'}
            </p>
          )}

          {isPaused && !isListening && (
            <p className="rounded-xl border border-brand/30 bg-brand-soft px-3.5 py-2.5 text-sm font-bold text-brand">
              Timer paused — take your time. Press Resume when you’re ready to continue.
            </p>
          )}

          {/* One solid recording for the whole section — pinned while the
              student scrolls and navigates parts, like a real exam player. */}
          {isListening && test.audioMode === 'single' && test.singleAudio && (
            <div className="sticky top-0 z-20 -mx-4 bg-page px-4 pb-1 pt-2 sm:-mx-8 sm:px-8">
              <ListeningAudio
                audio={test.singleAudio}
                label="Section recording"
                practice={isPractice}
              />
            </div>
          )}

          <div className="max-w-full overflow-x-auto">
            <nav
              className="inline-flex whitespace-nowrap rounded-xl border border-line bg-white p-1"
              aria-label="Test parts"
            >
              {test.parts.map((p, index) => (
                <button
                  key={p.id}
                  onClick={() => setPartIndex(index)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                    index === partIndex ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  Part {p.number}
                </button>
              ))}
            </nav>
          </div>

          <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
            {isListening ? (
              <ListeningPartRenderer
                part={part as SanitizedListeningPart}
                numbering={numbering}
                audioMode={test.audioMode}
                practice={isPractice}
              />
            ) : (
              <PartRenderer part={part as SanitizedPart} numbering={numbering} />
            )}
          </section>

          {/* Question map lives at the bottom, next to the part controls —
              review/jump is an end-of-part action, not a header one. */}
          <QuestionNavigator test={test} numbering={numbering} onJump={jumpToQuestion} />

          <div className="flex justify-between">
            <button
              onClick={() => setPartIndex((i) => Math.max(0, i - 1))}
              disabled={partIndex === 0}
              className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
            >
              Previous part
            </button>
            <button
              onClick={() => setPartIndex((i) => Math.min(test.parts.length - 1, i + 1))}
              disabled={partIndex === test.parts.length - 1}
              className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
            >
              Next part
            </button>
          </div>
        </div>
      </div>
    </ExamScreen>
  )
}

// Local timer-control glyphs (kept here so the shared icon set isn't touched).
function PauseGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16} aria-hidden {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

function PlayGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16} aria-hidden {...props}>
      <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" />
    </svg>
  )
}
