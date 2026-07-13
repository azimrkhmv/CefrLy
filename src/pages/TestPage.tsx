import { useEffect, useMemo, useState, type ReactNode, type SVGProps } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  cancelSession,
  controlSession,
  fetchSanitizedTest,
  fetchSessionStatus,
  startSession,
  submitTest,
} from '../lib/api'
import { useAnswersStore } from '../store/answers'
import { useAudioStore } from '../store/audio'
import { useHighlightsStore } from '../store/highlights'
import { highlightsSupported } from '../lib/textHighlight'
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
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ModePicker } from '../components/test/ModePicker'
import { CloseIcon, PenIcon } from '../components/icons'

const draftKey = (sessionId: string) => `cefrly-draft-${sessionId}`

// What we persist per session so a refresh/resume loses nothing: typed answers,
// marked-for-review flags, and passage highlights (offset ranges per container).
interface DraftShape {
  answers?: Record<string, string>
  marked?: Record<string, boolean>
  marks?: Record<string, { start: number; end: number }[]>
}

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
  // Which recordings have played out — listening simulation's "clock" (see
  // submitLocked below).
  const audioDone = useAudioStore((s) => s.done)

  // Reading passage highlighter (marker mode + a running count of marks so the
  // "Clear" affordance only shows when there is something to clear).
  const markerMode = useHighlightsStore((s) => s.markerMode)
  const toggleMarkerMode = useHighlightsStore((s) => s.toggleMarkerMode)
  const clearMarks = useHighlightsStore((s) => s.clearAll)
  const markCount = useHighlightsStore((s) =>
    Object.values(s.marks).reduce((n, arr) => n + arr.length, 0),
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
  // Single-part drills have no mode choice: they auto-start (or auto-resume)
  // in practice with the author-set duration, so the picker never shows.
  const isPartTest = status?.scope === 'part'
  // The mode picker is the landing ONLY for a FRESH full attempt (no open
  // session). If a session is already open — the common case being a page
  // refresh mid-test — we resume straight into the paper instead of bouncing
  // through the picker (see the auto-resume effect below).
  const showPicker = !!status && !started && !isPartTest && !hasOpenSession
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

  // Auto-resume an OPEN attempt so a page refresh (or any re-entry) mid-test
  // goes straight back into the paper — no detour through the mode picker. This
  // covers BOTH full tests and part drills. A part drill with no open session
  // additionally auto-STARTS a fresh practice session (it has no picker); a full
  // test with no open session falls through to the picker below.
  useEffect(() => {
    if (started || !status) return
    if (status.session) {
      setStarted(true)
    } else if (isPartTest && !start.isPending && !start.isError) {
      start.mutate({ mode: 'practice', durationSec: status.durationSec })
    }
    // `start` is stable per mount (useMutation); depending on status/started is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPartTest, started, status])

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
  // drop drafts from older sessions. NO cleanup here: clearing the store on
  // unmount belongs to the SAVER effect below, after it unsubscribes — a
  // cleanup reset() in this effect runs first (React executes cleanups in
  // declaration order) while the saver is still subscribed, and zustand
  // notifies synchronously, so it overwrote the draft with {} on every in-app
  // exit — silently losing all answers despite the Exit dialog's promise.
  // (Refresh never triggered it — no cleanups run on unload — which is why
  // "refresh keeps answers" testing missed the bug.)
  useEffect(() => {
    if (!sessionId) return
    reset()
    useAudioStore.getState().reset()
    useHighlightsStore.getState().reset()
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key?.startsWith('cefrly-draft-') && key !== draftKey(sessionId)) {
          localStorage.removeItem(key)
        }
      }
      const saved = localStorage.getItem(draftKey(sessionId))
      if (saved) {
        const parsed = JSON.parse(saved) as DraftShape | Record<string, string>
        if (parsed && typeof parsed === 'object' && 'answers' in parsed) {
          const draft = parsed as DraftShape
          useAnswersStore.getState().hydrate(draft.answers ?? {}, draft.marked ?? {})
          useHighlightsStore.getState().hydrate(draft.marks ?? {})
        } else {
          useAnswersStore.getState().hydrate(parsed as Record<string, string>)
        }
      }
    } catch {
      // Corrupt draft or blocked storage — start clean rather than crash the exam.
      try {
        localStorage.removeItem(draftKey(sessionId))
      } catch {
        /* storage unavailable */
      }
    }
  }, [sessionId, reset])

  // Save every answer/mark/highlight change so nothing is lost on refresh. Both
  // stores write the SAME combined draft (answers + marked-for-review + passage
  // highlights) through one persist().
  useEffect(() => {
    if (!sessionId) return
    const persist = () => {
      try {
        const answers = useAnswersStore.getState()
        localStorage.setItem(
          draftKey(sessionId),
          JSON.stringify({
            answers: answers.answers,
            marked: answers.marked,
            marks: useHighlightsStore.getState().marks,
          } satisfies DraftShape),
        )
      } catch {
        // Storage full/blocked: state stays in memory; submitting still works.
      }
    }
    const unsubAnswers = useAnswersStore.subscribe(persist)
    const unsubMarks = useHighlightsStore.subscribe(persist)
    return () => {
      // ORDER MATTERS: stop persisting BEFORE clearing the stores, so leaving
      // the exam can never write an empty draft over the student's work.
      unsubAnswers()
      unsubMarks()
      reset()
      useHighlightsStore.getState().reset()
    }
  }, [sessionId, reset])

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
      // reset() BEFORE removing the draft: the saver subscription reacts to
      // the reset by writing {} — deleting afterwards leaves no orphan key.
      reset()
      useAudioStore.getState().reset()
      useHighlightsStore.getState().reset()
      if (sessionId) localStorage.removeItem(draftKey(sessionId))
      queryClient.removeQueries({ queryKey: ['test', testId] })
      queryClient.removeQueries({ queryKey: ['session-status', testId] })
      // Reading opens its Analysis page directly; listening keeps the score
      // page (which carries the audio/transcript review link).
      navigate(
        result.skill === 'listening'
          ? `/results/${result.attemptId}`
          : `/analyze/${result.attemptId}`,
        { state: result, replace: true },
      )
    },
  })

  // Which in-app confirmation (ConfirmDialog) is open — replaces the native
  // window.confirm popups with the startled-cat alert.
  const [confirmAction, setConfirmAction] = useState<'exit' | 'submit' | null>(null)

  // Leaving the exam CANCELS the attempt (user decision 2026-07-06): the
  // session is closed server-side without grading and the local draft is
  // discarded — nothing is saved, nothing to resume. Local cleanup happens
  // even if the server call fails (the stranded session then dies at
  // restart/expiry). Order: reset() first so the saver's reaction is the {}
  // write, THEN remove the key — leaving no orphan draft behind.
  const abandon = useMutation({
    mutationFn: () => cancelSession(sessionId!),
    onSettled: () => {
      // Disable the get-test query BEFORE removing it from the cache — with an
      // active observer, removal triggers an instant refetch, and get-test used
      // to auto-create a fresh session on that refetch, resurrecting the very
      // attempt we just cancelled.
      setStarted(false)
      reset()
      useAudioStore.getState().reset()
      useHighlightsStore.getState().reset()
      try {
        if (sessionId) localStorage.removeItem(draftKey(sessionId))
      } catch {
        /* storage unavailable */
      }
      queryClient.removeQueries({ queryKey: ['test', testId] })
      queryClient.invalidateQueries({ queryKey: ['session-status', testId] })
      navigate(catalogPath)
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

  // SIMULATION is exam-real about when submission opens: reading stays locked
  // until the clock runs out (the timer then auto-submits); listening unlocks
  // the moment every recording has played out — the audio IS the clock.
  // Practice can submit any time.
  const requiredAudio: string[] =
    test && test.skill === 'listening'
      ? test.audioMode === 'single'
        ? test.singleAudio
          ? [test.singleAudio.assetPath]
          : []
        : test.parts.flatMap((p) => (p.audio ? [p.audio.assetPath] : []))
      : []
  const submitLocked =
    !!test &&
    test.session.mode === 'simulation' &&
    (test.skill === 'listening' ? requiredAudio.some((path) => !audioDone[path]) : true)

  function handleSubmit(auto = false) {
    if (submission.isPending) return
    if (!auto && submitLocked) return
    if (!auto && answeredCount < totalItems) {
      setConfirmAction('submit')
      return
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
          <div className="flex items-center px-4 py-3 sm:px-6">
            <Link
              to={catalogPath}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
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

  // A part drill that failed to auto-start needs a way out (no picker exists).
  if (isPartTest && start.isError) {
    return (
      <ExamScreen center>
        <div className="space-y-4">
          <p className="text-sm text-rose-700">
            Could not start the practice.{' '}
            {start.error instanceof Error ? start.error.message : ''}
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
  // The passage highlighter is a reading aid; listening has no passage. Hidden
  // when the browser can't paint custom highlights, so there's no dead button.
  const canHighlight = !isListening && highlightsSupported()
  const skillLabel = isListening ? 'Listening' : 'Reading'
  const backTo = catalogPath
  const isPractice = test.session.mode === 'practice'
  // Show the DURATION OF THIS ATTEMPT, not the test's default: reading practice
  // runs for the student's chosen 20–90 min, so `test.durationSec` (the fixed
  // simulation length) would mislabel it. The session carries the real figure.
  const shownDurationMin = Math.round((test.session.durationSec ?? test.durationSec) / 60)
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
                // Never drop out of a live attempt silently — the in-app
                // startled-cat dialog asks first, then navigates on confirm.
                e.preventDefault()
                setConfirmAction('exit')
              }}
              title="Leave the test — this attempt will be cancelled."
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              <CloseIcon width={18} height={18} />
              <span className="hidden sm:inline">Exit</span>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold text-heading">{test.title}</h1>
              <p className="hidden text-xs text-ink-soft sm:block">
                {/* Listening is audio-paced — never advertise minutes. */}
                {test.scope === 'part'
                  ? isListening
                    ? `${skillLabel} · Part ${test.partNumber} practice · ${totalItems} questions`
                    : `${skillLabel} · Part ${test.partNumber} practice · ${totalItems} questions · ${shownDurationMin} minutes`
                  : isListening
                    ? `${skillLabel} · ${totalItems} questions · ${test.parts.length} parts`
                    : `${skillLabel} · ${totalItems} questions · ${shownDurationMin} minutes`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="tnum hidden text-sm text-ink-soft sm:inline">
              {answeredCount}/{totalItems} answered
            </span>
            {/* Reading highlighter: toggle marker mode, then select passage text
                to mark it (click a mark to remove it). Brand-violet wash. */}
            {canHighlight && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toggleMarkerMode()}
                  aria-pressed={markerMode}
                  title={
                    markerMode
                      ? 'Highlighter on — select passage text to mark it, click a mark to remove it'
                      : 'Highlighter — select passage text to mark it'
                  }
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                    markerMode
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line bg-white text-ink hover:border-ink-faint'
                  }`}
                >
                  <PenIcon width={16} height={16} />
                  <span className="hidden sm:inline">Highlight</span>
                </button>
                {markerMode && markCount > 0 && (
                  <button
                    onClick={() => clearMarks()}
                    title="Remove all highlights"
                    className="rounded-xl border border-line bg-white px-2.5 py-2 text-xs font-bold text-ink-soft transition-colors hover:border-rose-200 hover:text-rose-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
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
              disabled={submission.isPending || submitLocked}
              title={
                submitLocked
                  ? isListening
                    ? 'Submitting unlocks when the recording has finished.'
                    : 'Simulation submits itself when time is up.'
                  : undefined
              }
              className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
              <span className="min-w-0">
                {submission.error instanceof Error ? submission.error.message : 'Submission failed.'}
              </span>
              {/* A failed submit must always be recoverable — in reading
                  simulation the Submit button is otherwise locked and the timer
                  won't fire its auto-submit twice, so this is the only retry. */}
              <button
                onClick={() => submission.mutate()}
                disabled={submission.isPending}
                className="shrink-0 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
              >
                {submission.isPending ? 'Submitting…' : 'Try again'}
              </button>
            </div>
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

          {/* A single-part drill has nothing to navigate between. */}
          {test.parts.length > 1 && (
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
          )}

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

          {test.parts.length > 1 && (
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
          )}
        </div>
      </div>

      {/* Cefrly's own alert — no native browser popups inside the exam. */}
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === 'submit' ? 'Submit with unanswered questions?' : 'Leave the test?'}
        message={
          confirmAction === 'submit'
            ? `You’ve answered ${answeredCount} of ${totalItems} questions — unanswered ones count as incorrect.`
            : 'This attempt will be cancelled and your answers will be discarded.'
        }
        confirmLabel={confirmAction === 'submit' ? 'Submit anyway' : 'Leave & cancel'}
        cancelLabel={confirmAction === 'submit' ? 'Keep working' : 'Stay'}
        tone={confirmAction === 'submit' ? 'brand' : 'rose'}
        onConfirm={() => {
          const action = confirmAction
          setConfirmAction(null)
          if (action === 'submit') submission.mutate()
          else abandon.mutate()
        }}
        onCancel={() => setConfirmAction(null)}
      />
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
