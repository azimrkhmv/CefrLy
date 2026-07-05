import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchSanitizedTest, submitTest } from '../lib/api'
import { useAnswersStore } from '../store/answers'
import { useAudioStore } from '../store/audio'
import { partItems, type SanitizedListeningPart, type SanitizedPart } from '../types/test'
import { PartRenderer } from '../components/test/PartRenderer'
import { ListeningPartRenderer } from '../components/test/listening/ListeningPartRenderer'
import { AudioPlayer } from '../components/test/AudioPlayer'
import { QuestionNavigator } from '../components/test/QuestionNavigator'
import { Timer } from '../components/test/Timer'
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
  const reset = useAnswersStore((s) => s.reset)
  const answeredCount = useAnswersStore(
    (s) => Object.values(s.answers).filter((v) => v.trim() !== '').length,
  )

  const {
    data: test,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => fetchSanitizedTest(testId!),
    enabled: !!testId,
    staleTime: Infinity,
    retry: 1,
  })

  const sessionId = test?.session.id

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

  if (isLoading)
    return (
      <ExamScreen center>
        <p className="text-ink-soft">Loading test…</p>
      </ExamScreen>
    )
  if (error || !test) {
    return (
      <ExamScreen center>
        <div className="space-y-4">
          <p className="text-sm text-rose-700">
            Could not load the test. {error instanceof Error ? error.message : ''}
          </p>
          <Link
            to="/reading"
            className="inline-block rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Back to tests
          </Link>
        </div>
      </ExamScreen>
    )
  }

  const part = test.parts[partIndex]
  const isListening = test.skill === 'listening'
  const skillLabel = isListening ? 'Listening' : 'Reading'
  const backTo = isListening ? '/' : '/reading'

  return (
    <ExamScreen>
      {/* Slim exam top bar — replaces the app shell. Fixed height so the paper
          below scrolls independently and the timer/submit stay in reach. */}
      <header className="shrink-0 border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link
              to={backTo}
              title="Leave the test — your answers are saved and the timer keeps running."
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold text-ink-soft transition-colors hover:bg-page hover:text-ink"
            >
              <CloseIcon width={18} height={18} />
              <span className="hidden sm:inline">Exit</span>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold text-heading">{test.title}</h1>
              <p className="hidden text-xs text-ink-soft sm:block">
                {skillLabel} · {totalItems} questions · {Math.round(test.durationSec / 60)} minutes
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="tnum hidden text-sm text-ink-soft sm:inline">
              {answeredCount}/{totalItems} answered
            </span>
            <Timer expiresAt={test.session.expiresAt} onExpire={() => handleSubmit(true)} />
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

          {isListening && test.audioMode === 'single' && test.singleAudio && (
            <AudioPlayer audio={test.singleAudio} label="Section recording" />
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

          <QuestionNavigator test={test} numbering={numbering} onJump={jumpToQuestion} />

          <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
            {isListening ? (
              <ListeningPartRenderer
                part={part as SanitizedListeningPart}
                numbering={numbering}
                audioMode={test.audioMode}
              />
            ) : (
              <PartRenderer part={part as SanitizedPart} numbering={numbering} />
            )}
          </section>

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
