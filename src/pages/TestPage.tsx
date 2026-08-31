import { useEffect, useMemo, useRef, useState, type ReactNode, type SVGProps } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  cancelSession,
  controlSession,
  fetchSavedAnswers,
  fetchTestState,
  pauseSessionOnLeave,
  PlanLimitError,
  saveAnswers,
  startSession,
  submitTest,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { ACTION_LABEL_ONE } from '../lib/plans'
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
  type TestState,
} from '../types/test'
import { PartRenderer } from '../components/test/PartRenderer'
import { ListeningPartRenderer } from '../components/test/listening/ListeningPartRenderer'
import { ListeningAudio } from '../components/test/ListeningAudio'
import { QuestionNavigator } from '../components/test/QuestionNavigator'
import { Timer } from '../components/test/Timer'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ModePicker } from '../components/test/ModePicker'
import { ExamSkeleton } from '../components/test/ExamSkeleton'
import { CloseIcon, PenIcon } from '../components/icons'

const draftKey = (sessionId: string) => `cefrly-draft-${sessionId}`

// What we persist per session so a refresh/resume loses nothing: typed answers,
// marked-for-review flags, and passage highlights (offset ranges per container).
interface DraftShape {
  answers?: Record<string, string>
  marked?: Record<string, boolean>
  marks?: Record<string, { start: number; end: number }[]>
  /** Listening only: which recordings have played out, and which previews are
   *  over. Simulation gates Submit on `done`, so without this a refresh locked
   *  the student out of submitting until the whole recording played AGAIN —
   *  with no timer to rescue them. `plays` is deliberately NOT persisted: a
   *  refresh mid-recording would burn the single allowed play and leave the
   *  student unable to listen or submit. */
  audio?: {
    done?: Record<string, boolean>
    previewed?: Record<string, boolean>
  }
  /** When this draft was last written (epoch ms). Drives the housekeeping
   *  below — old drafts age out instead of every other test's work being wiped
   *  the moment a different test opens. */
  savedAt?: number
}

/** When this browser's draft for a session was last written (0 when there is
 *  none). Decides whether the server's copy is newer and should replace it. */
function readDraftSavedAt(sessionId: string): number {
  try {
    const raw = localStorage.getItem(draftKey(sessionId))
    if (!raw) return 0
    const draft = JSON.parse(raw) as DraftShape
    return typeof draft.savedAt === 'number' ? draft.savedAt : 0
  } catch {
    return 0
  }
}

/** Drafts older than this are cleaned up on the next exam open. Long enough
 *  that a student juggling several unfinished papers never loses one. */
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000

/** How long a burst of typing is coalesced before the server copy is updated.
 *  Short enough that almost nothing is lost, long enough that a fast typist
 *  produces a handful of writes per attempt rather than hundreds. */
const SERVER_SAVE_MS = 5000

// Housekeeping for OTHER sessions' drafts. It used to delete every draft that
// was not the current one — so opening Reading Mock 3 silently erased the
// answers of an unfinished Reading Mock 2, whose clock was still running. Now a
// draft only goes when it has aged out; ones written before `savedAt` existed
// are stamped on first sight rather than thrown away.
function pruneOldDrafts(keepKey: string) {
  const now = Date.now()
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (!key?.startsWith('cefrly-draft-') || key === keepKey) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const draft = JSON.parse(raw) as DraftShape
        if (typeof draft.savedAt !== 'number') {
          localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: now }))
        } else if (now - draft.savedAt > DRAFT_TTL_MS) {
          localStorage.removeItem(key)
        }
      } catch {
        localStorage.removeItem(key) // unreadable — nothing to preserve
      }
    }
  } catch {
    /* storage unavailable */
  }
}

/** The answers still stored for a session, ignoring blanks. Used by the rescue
 *  screen: an attempt whose clock ran out is only worth offering back when the
 *  student actually wrote something. */
function readDraftAnswers(sessionId: string | undefined): Record<string, string> {
  if (!sessionId) return {}
  try {
    const raw = localStorage.getItem(draftKey(sessionId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as DraftShape | Record<string, string>
    const answers =
      parsed && typeof parsed === 'object' && 'answers' in parsed
        ? ((parsed as DraftShape).answers ?? {})
        : (parsed as Record<string, string>)
    return Object.fromEntries(
      Object.entries(answers).filter(([, v]) => typeof v === 'string' && v.trim() !== ''),
    )
  } catch {
    return {}
  }
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
  // Needed for the auto-pause below: it fires as the page unloads, too late for
  // the normal client, so it carries the access token on a raw keepalive fetch.
  const { session } = useAuth()
  const [partIndex, setPartIndex] = useState(0)
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

  // ONE call per page load: get-test returns the sanitized paper when an attempt
  // is open (resume straight in — the common refresh case), or the picker
  // metadata with `session:null` when none is. No session is ever created here,
  // so this doubles as the old read-only peek without a second round-trip.
  const {
    data: attempt,
    isLoading: attemptLoading,
    error: attemptError,
  } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => fetchTestState(testId!),
    enabled: !!testId,
    // A fresh page load has an empty cache so it always fetches; within a live
    // attempt we never want a spontaneous refetch (it would disrupt the timer),
    // so keep it fresh. start-session / abandon invalidate explicitly.
    staleTime: Infinity,
    retry: 1,
  })

  // An open attempt carries the paper (session present); no session => picker.
  const hasPaper = !!attempt && attempt.session !== null
  const test = hasPaper ? (attempt as SanitizedTest) : undefined
  // Single-part drills have no mode choice: they auto-start practice with the
  // author-set duration, so the picker never shows for them.
  const isPartTest = (attempt?.scope ?? 'full') === 'part'
  const catalogPath = attempt?.skill === 'listening' ? '/listening' : '/reading'
  const sessionId = test?.session.id

  // RESCUE: the clock ran out while the student was away (tab closed, laptop
  // shut). The attempt is over as far as the server is concerned, but this
  // browser still holds the answers — offering them back beats losing an hour
  // of work in silence. Restarting instead is a deliberate choice below.
  const expired = attempt && attempt.session === null ? (attempt.expired ?? null) : null
  const [restartAfterExpiry, setRestartAfterExpiry] = useState(false)
  const rescued = useMemo(() => readDraftAnswers(expired?.id), [expired?.id])
  const rescuedCount = Object.keys(rescued).length
  const showRescue = !!expired && rescuedCount > 0 && !restartAfterExpiry

  // Begin a session in the chosen mode, then reload the paper. start-session
  // closes any session still open for this test first, so choosing a mode is a
  // REAL restart. Invalidating ['test'] refetches get-test, which now returns
  // the freshly-started paper.
  const start = useMutation({
    mutationFn: ({ mode, durationSec }: { mode: TestMode; durationSec: number }) =>
      startSession(testId!, mode, durationSec),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test', testId] })
    },
  })

  // Part drills have no picker: when none is open, auto-start a fresh practice
  // session (the server pins the duration to the test's own). Full tests with no
  // open session fall through to the mode picker below; an open attempt (either
  // scope) already rendered its paper, so this effect no-ops there.
  useEffect(() => {
    if (!attempt || attempt.session !== null) return
    // Never auto-start over a rescue: a new session closes the expired one, and
    // the answers waiting to be handed in would be lost for good.
    if (showRescue) return
    if (isPartTest && !start.isPending && !start.isError) {
      start.mutate({ mode: 'practice', durationSec: attempt.durationSec })
    }
    // `start` is stable per mount (useMutation); depending on attempt is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, isPartTest, showRescue])

  // Pause / resume the practice timer (server-authoritative). The response
  // carries the fresh session (shifted deadline, cleared/set pausedAt) which we
  // patch straight into the cached test so the Timer reacts immediately.
  const isPaused = !!test?.session.pausedAt
  const control = useMutation({
    mutationFn: (action: 'pause' | 'resume') => controlSession(test!.session.id, action),
    onSuccess: ({ session }) => {
      queryClient.setQueryData<TestState>(['test', testId], (old) =>
        old && old.session !== null ? { ...old, session } : old,
      )
    },
  })

  // ---- Practice auto-pause ---------------------------------------------------
  // Practice is meant to be pausable, so a student who closes the tab to eat
  // lunch should not lose 20 minutes to a clock they never asked to run. When a
  // practice attempt's page goes away WITHOUT the student pressing Pause, we
  // pause it for them; arriving back on the exam resumes it, so a refresh feels
  // like nothing happened while a two-hour absence costs nothing.
  //
  // SIMULATION IS DELIBERATELY EXCLUDED: its clock running down while you are
  // gone is the whole point of a mock exam. Listening has no clock in either
  // mode, so there is nothing to pause there either.
  const autoPauseKey = sessionId ? `cefrly-autopause-${sessionId}` : null
  const finishedRef = useRef(false)
  const accessToken = session?.access_token ?? null
  const canAutoPause =
    !!test && test.session.mode === 'practice' && test.skill !== 'listening' && !!accessToken

  useEffect(() => {
    if (!canAutoPause || !sessionId || !accessToken || !autoPauseKey) return
    const pauseNow = () => {
      // Submitted or cancelled attempts are finished — nothing to pause.
      if (finishedRef.current) return
      // Already paused by hand: leave the student's own pause alone (and do not
      // claim it as ours, or coming back would auto-resume a deliberate pause).
      if (isPausedRightNow()) return
      try {
        localStorage.setItem(autoPauseKey, '1')
      } catch {
        /* storage unavailable — the pause still happens, it just won't auto-resume */
      }
      pauseSessionOnLeave(sessionId, accessToken)
    }
    // Reads the CURRENT pausedAt at fire time, not the value captured when this
    // effect ran — the student may have paused by hand since.
    function isPausedRightNow(): boolean {
      const cached = queryClient.getQueryData<TestState>(['test', testId])
      return !!(cached && cached.session !== null && cached.session.pausedAt)
    }
    // pagehide covers tab close, navigation away and refresh (bfcache included);
    // the unmount cleanup covers leaving to another page inside the app.
    window.addEventListener('pagehide', pauseNow)
    return () => {
      window.removeEventListener('pagehide', pauseNow)
      pauseNow()
    }
  }, [canAutoPause, sessionId, accessToken, autoPauseKey, queryClient, testId])

  // Coming back: an attempt WE paused resumes itself, so "continue" is just
  // opening the test again. A pause the student pressed stays paused.
  useEffect(() => {
    if (!test || !sessionId || !autoPauseKey) return
    if (!test.session.pausedAt) return
    let ours = false
    try {
      ours = localStorage.getItem(autoPauseKey) === '1'
    } catch {
      /* storage unavailable */
    }
    if (!ours || control.isPending) return
    try {
      localStorage.removeItem(autoPauseKey)
    } catch {
      /* storage unavailable */
    }
    control.mutate('resume')
    // `control` is stable per mount (useMutation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test?.session.pausedAt, sessionId, autoPauseKey])

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
    pruneOldDrafts(draftKey(sessionId))
    try {
      const saved = localStorage.getItem(draftKey(sessionId))
      if (saved) {
        const parsed = JSON.parse(saved) as DraftShape | Record<string, string>
        if (parsed && typeof parsed === 'object' && 'answers' in parsed) {
          const draft = parsed as DraftShape
          useAnswersStore.getState().hydrate(draft.answers ?? {}, draft.marked ?? {})
          useHighlightsStore.getState().hydrate(draft.marks ?? {})
          useAudioStore.getState().hydrate(draft.audio?.done ?? {}, draft.audio?.previewed ?? {})
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

    // Then the SERVER copy, which may be newer — a cleared cache, a different
    // browser, or another device. Whichever was written last wins, so the usual
    // same-device refresh keeps exactly what is already on screen.
    let cancelled = false
    const localSavedAt = readDraftSavedAt(sessionId)
    fetchSavedAnswers(sessionId)
      .then((remote) => {
        if (cancelled || !remote) return
        if (new Date(remote.updatedAt).getTime() <= localSavedAt) return
        useAnswersStore.getState().hydrate(remote.answers, remote.marked)
      })
      .catch(() => {
        // Offline or blocked: the local copy stands. Never disturb the exam.
      })
    return () => {
      cancelled = true
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
        const audio = useAudioStore.getState()
        localStorage.setItem(
          draftKey(sessionId),
          JSON.stringify({
            answers: answers.answers,
            marked: answers.marked,
            marks: useHighlightsStore.getState().marks,
            audio: { done: audio.done, previewed: audio.previewed },
            savedAt: Date.now(),
          } satisfies DraftShape),
        )
      } catch {
        // Storage full/blocked: state stays in memory; submitting still works.
      }
      queueServerSave()
    }

    // The server copy: same answers, a few seconds behind. It is what makes an
    // attempt survive a cleared cache or a change of device, and what the expiry
    // sweep grades when a simulation's clock runs out with the tab closed.
    // Coalesced so a burst of typing is ONE write, and silent on failure — the
    // student's exam must never stall on a sync.
    let timer: ReturnType<typeof setTimeout> | null = null
    let dirty = false
    const pushNow = () => {
      timer = null
      if (!dirty) return
      dirty = false
      const { answers, marked } = useAnswersStore.getState()
      saveAnswers(sessionId, answers, marked).catch(() => {
        dirty = true // try again on the next change
      })
    }
    const queueServerSave = () => {
      dirty = true
      if (timer === null) timer = setTimeout(pushNow, SERVER_SAVE_MS)
    }
    // Leaving the page is the moment the server copy matters most.
    const flush = () => {
      if (timer !== null) clearTimeout(timer)
      pushNow()
    }
    window.addEventListener('pagehide', flush)

    const unsubAnswers = useAnswersStore.subscribe(persist)
    const unsubMarks = useHighlightsStore.subscribe(persist)
    const unsubAudio = useAudioStore.subscribe(persist)
    return () => {
      // ORDER MATTERS: stop persisting BEFORE clearing the stores, so leaving
      // the exam can never write an empty draft over the student's work. The
      // final server push happens here too, while the stores still hold them.
      unsubAnswers()
      unsubMarks()
      unsubAudio()
      window.removeEventListener('pagehide', flush)
      flush()
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
    // The argument carries the rescue path: the clock ran out while the student
    // was away, so the answers come from that session's stored draft rather than
    // from the live store (there is no paper on screen to read them from).
    mutationFn: (opts: { answers: Record<string, string>; late: true } | null) =>
      submitTest(testId!, opts?.answers ?? useAnswersStore.getState().answers, opts?.late ?? false),
    onSuccess: (result) => {
      // Graded — the unmount that follows must not try to pause this attempt.
      finishedRef.current = true
      // reset() BEFORE removing the draft: the saver subscription reacts to
      // the reset by writing {} — deleting afterwards leaves no orphan key.
      reset()
      useAudioStore.getState().reset()
      useHighlightsStore.getState().reset()
      try {
        // The rescue path has no live session, so clear the expired one's draft.
        const done = sessionId ?? expired?.id
        if (done) localStorage.removeItem(draftKey(done))
        if (autoPauseKey) localStorage.removeItem(autoPauseKey)
      } catch {
        /* storage unavailable */
      }
      queryClient.removeQueries({ queryKey: ['test', testId] })
      // The catalog's "Resume · N min left" card must stop saying that now.
      queryClient.invalidateQueries({ queryKey: ['open-sessions'] })
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
    mutationFn: () => {
      // Cancelled on purpose — never auto-pause it on the way out.
      finishedRef.current = true
      return cancelSession(sessionId!)
    },
    onSettled: () => {
      // Navigate away FIRST so TestPage unmounts and drops its ['test'] observer;
      // removing the query then can't trigger a stray refetch. (Even if one did,
      // get-test no longer auto-creates a session — it returns session:null — so
      // the just-cancelled attempt can't be resurrected.)
      reset()
      useAudioStore.getState().reset()
      useHighlightsStore.getState().reset()
      try {
        if (sessionId) localStorage.removeItem(draftKey(sessionId))
      } catch {
        /* storage unavailable */
      }
      navigate(catalogPath)
      queryClient.removeQueries({ queryKey: ['test', testId] })
      // The catalog's "Resume · N min left" card must stop saying that now.
      queryClient.invalidateQueries({ queryKey: ['open-sessions'] })
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
    submission.mutate(null)
  }

  // ---- Pre-exam states ------------------------------------------------------

  if (attemptError) {
    return (
      <ExamScreen center>
        <div className="space-y-4">
          <p className="text-sm text-rose-700">
            Could not load the test. {attemptError instanceof Error ? attemptError.message : ''}
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

  // Initial load — the exam skeleton reads as the paper arriving.
  if (attemptLoading || !attempt)
    return (
      <ExamScreen>
        <ExamSkeleton />
      </ExamScreen>
    )

  // No open attempt: part drills auto-start (skeleton while starting, error if
  // that fails); full tests show the "Choose a mode" picker.
  if (attempt.session === null) {
    // Plan cap reached (either path — auto-started drill or picked mode): show a
    // friendly upgrade prompt rather than a raw error. Takes priority over both
    // the drill-error and picker branches below.
    if (start.error instanceof PlanLimitError) {
      const limitErr = start.error
      const isPremiumOnly = limitErr.code === 'premium_only'
      return (
        <ExamScreen center>
          <div className="mx-auto max-w-md space-y-5">
            <img
              src="/cat-surprised.png"
              alt=""
              aria-hidden
              className="mx-auto h-40 w-auto object-contain"
            />
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-heading">
                {isPremiumOnly
                  ? 'This is a Premium test'
                  : `You’ve used this month’s premium ${ACTION_LABEL_ONE[limitErr.action]} limit`}
              </h2>
              <p className="text-sm text-ink-soft">{limitErr.message}</p>
              <p className="text-xs text-ink-faint">
                {isPremiumOnly
                  ? 'Free practice tests are always open — no upgrade needed for those.'
                  : 'Your premium allowance refreshes next month, or go Premium for unlimited.'}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
              <Link
                to="/pricing"
                className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-deep sm:w-auto"
              >
                See plans
              </Link>
              <Link
                to={catalogPath}
                className="w-full rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink transition-colors hover:border-ink-faint sm:w-auto"
              >
                Back to tests
              </Link>
            </div>
          </div>
        </ExamScreen>
      )
    }
    // Time ran out while the student was away — offer the answers back before
    // anything else. Restarting from here is a deliberate choice, and it is the
    // only path that throws them away.
    if (showRescue && expired) {
      const ranOut = new Date(expired.expiresAt)
      return (
        <ExamScreen center>
          <div className="mx-auto max-w-md space-y-5">
            <img
              src="/cat-surprised.png"
              alt=""
              aria-hidden
              className="mx-auto h-40 w-auto object-contain"
            />
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-heading">Your time ran out</h2>
              <p className="text-sm text-ink-soft">
                The clock finished at{' '}
                <span className="font-bold text-ink">
                  {ranOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>{' '}
                while this test was closed. We still have the{' '}
                <span className="font-bold text-ink">
                  {rescuedCount} answer{rescuedCount === 1 ? '' : 's'}
                </span>{' '}
                you had written — hand them in now to get your score.
              </p>
              <p className="text-xs text-ink-faint">
                Saved as a late hand-in. Starting again instead clears these answers.
              </p>
            </div>
            {submission.isError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
                {submission.error instanceof Error
                  ? submission.error.message
                  : 'Could not submit those answers.'}
              </p>
            )}
            <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
              <button
                onClick={() => submission.mutate({ answers: rescued, late: true })}
                disabled={submission.isPending}
                className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-50 sm:w-auto"
              >
                {submission.isPending ? 'Submitting…' : 'Submit my answers'}
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem(draftKey(expired.id))
                  } catch {
                    /* storage unavailable */
                  }
                  setRestartAfterExpiry(true)
                }}
                className="w-full rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink transition-colors hover:border-ink-faint sm:w-auto"
              >
                Start again
              </button>
            </div>
            <Link
              to={catalogPath}
              className="inline-block text-sm font-bold text-brand hover:underline"
            >
              Back to tests
            </Link>
          </div>
        </ExamScreen>
      )
    }

    if (isPartTest) {
      if (start.isError) {
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
      return (
        <ExamScreen>
          <ExamSkeleton />
        </ExamScreen>
      )
    }

    // A mode was picked — show the skeleton while start-session swaps in the
    // fresh paper, rather than flashing the picker again mid-transition.
    if (start.isPending || start.isSuccess) {
      return (
        <ExamScreen>
          <ExamSkeleton />
        </ExamScreen>
      )
    }

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
            <ModePicker
              title={attempt.title}
              skill={attempt.skill}
              simulationDurationSec={attempt.durationSec}
              onStart={(mode, durationSec) => start.mutate({ mode, durationSec })}
              starting={start.isPending}
              error={start.error instanceof Error ? start.error.message : null}
            />
          </div>
        </div>
      </ExamScreen>
    )
  }

  // Open attempt: the paper is loaded (narrows `test` for the exam below).
  if (!test)
    return (
      <ExamScreen>
        <ExamSkeleton />
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
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
          {submission.isError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
              <span className="min-w-0">
                {submission.error instanceof Error ? submission.error.message : 'Submission failed.'}
              </span>
              {/* A failed submit must always be recoverable — in reading
                  simulation the Submit button is otherwise locked and the timer
                  won't fire its auto-submit twice, so this is the only retry. */}
              <button
                onClick={() => submission.mutate(null)}
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
          if (action === 'submit') submission.mutate(null)
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
