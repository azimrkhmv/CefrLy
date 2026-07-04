import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchSanitizedTest, submitTest } from '../lib/api'
import { useAnswersStore } from '../store/answers'
import { PartRenderer } from '../components/test/PartRenderer'
import { QuestionNavigator } from '../components/test/QuestionNavigator'
import { Timer } from '../components/test/Timer'

const draftKey = (sessionId: string) => `cefrly-draft-${sessionId}`

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
    test?.parts.forEach((part) => part.items.forEach((item) => (map[item.id] = n++)))
    return map
  }, [test])

  const totalItems = test?.parts.reduce((sum, part) => sum + part.items.length, 0) ?? 0

  const submission = useMutation({
    mutationFn: () => submitTest(testId!, useAnswersStore.getState().answers),
    onSuccess: (result) => {
      if (sessionId) localStorage.removeItem(draftKey(sessionId))
      queryClient.removeQueries({ queryKey: ['test', testId] })
      reset()
      navigate(`/results/${result.attemptId}`, { state: result, replace: true })
    },
  })

  function jumpToQuestion(itemId: string) {
    if (!test) return
    const index = test.parts.findIndex((part) => part.items.some((item) => item.id === itemId))
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

  if (isLoading) return <p className="py-24 text-center text-ink-soft">Loading test…</p>
  if (error || !test) {
    return (
      <p className="py-24 text-center text-sm text-rose-700">
        Could not load the test. {error instanceof Error ? error.message : ''}
      </p>
    )
  }

  const part = test.parts[partIndex]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-heading">{test.title}</h1>
          <p className="text-sm text-ink-soft">
            Reading · {totalItems} questions · {Math.round(test.durationSec / 60)} minutes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="tnum text-sm text-ink-soft">
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

      {submission.isError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {submission.error instanceof Error ? submission.error.message : 'Submission failed.'}
        </p>
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
        <PartRenderer part={part} numbering={numbering} />
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
  )
}
