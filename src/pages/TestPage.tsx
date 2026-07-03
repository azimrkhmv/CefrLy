import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchSanitizedTest, submitTest } from '../lib/api'
import { useAnswersStore } from '../store/answers'
import { PartRenderer } from '../components/test/PartRenderer'
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
        useAnswersStore.getState().hydrate(JSON.parse(saved) as Record<string, string>)
      } catch {
        localStorage.removeItem(draftKey(sessionId))
      }
    }
    return () => reset()
  }, [sessionId, reset])

  // Save every answer change so nothing is lost on refresh.
  useEffect(() => {
    if (!sessionId) return
    return useAnswersStore.subscribe((state) => {
      localStorage.setItem(draftKey(sessionId), JSON.stringify(state.answers))
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

  if (isLoading) return <p className="py-24 text-center text-slate-400">Loading test…</p>
  if (error || !test) {
    return (
      <p className="py-24 text-center text-rose-600">
        Could not load the test. {error instanceof Error ? error.message : ''}
      </p>
    )
  }

  const part = test.parts[partIndex]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{test.title}</h1>
          <p className="text-sm text-slate-500">
            Reading · {totalItems} questions · {Math.round(test.durationSec / 60)} minutes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {answeredCount}/{totalItems} answered
          </span>
          <Timer expiresAt={test.session.expiresAt} onExpire={() => handleSubmit(true)} />
          <button
            onClick={() => handleSubmit()}
            disabled={submission.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submission.isPending ? 'Submitting…' : 'Submit test'}
          </button>
        </div>
      </div>

      {submission.isError && (
        <p className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {submission.error instanceof Error ? submission.error.message : 'Submission failed.'}
        </p>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Test parts">
        {test.parts.map((p, index) => (
          <button
            key={p.id}
            onClick={() => setPartIndex(index)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              index === partIndex
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
            }`}
          >
            Part {p.number}
          </button>
        ))}
      </nav>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <PartRenderer part={part} numbering={numbering} />
      </section>

      <div className="flex justify-between">
        <button
          onClick={() => setPartIndex((i) => Math.max(0, i - 1))}
          disabled={partIndex === 0}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          ← Previous part
        </button>
        <button
          onClick={() => setPartIndex((i) => Math.min(test.parts.length - 1, i + 1))}
          disabled={partIndex === test.parts.length - 1}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Next part →
        </button>
      </div>
    </div>
  )
}
