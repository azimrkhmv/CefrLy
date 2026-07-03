import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAttempt } from '../lib/api'
import type { AttemptResult, ItemResult } from '../types/attempt'
import type { Band } from '../types/test'

const BAND_INFO: Record<Band, { label: string; className: string; range: string }> = {
  C1: { label: 'C1', className: 'bg-emerald-100 text-emerald-800', range: '28–35' },
  B2: { label: 'B2', className: 'bg-sky-100 text-sky-800', range: '18–27' },
  B1: { label: 'B1', className: 'bg-amber-100 text-amber-800', range: '10–17' },
  below_B1: { label: 'Below B1', className: 'bg-rose-100 text-rose-800', range: '0–9' },
}

export function ResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const location = useLocation()
  const stateResult = (location.state as AttemptResult | null) ?? null

  const query = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => fetchAttempt(attemptId!),
    enabled: !stateResult && !!attemptId,
  })

  const result = stateResult ?? query.data

  if (!result) {
    if (query.isLoading) return <p className="py-24 text-center text-slate-400">Loading results…</p>
    return (
      <p className="py-24 text-center text-rose-600">
        Could not load this attempt.{' '}
        {query.error instanceof Error ? query.error.message : ''}
      </p>
    )
  }

  const band = BAND_INFO[result.band]
  const byPart = new Map<number, ItemResult[]>()
  for (const item of result.items) {
    const list = byPart.get(item.partNumber) ?? []
    list.push(item)
    byPart.set(item.partNumber, list)
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-8">
        <p className="text-sm text-slate-500">{result.testTitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <span className={`rounded-xl px-5 py-3 text-3xl font-bold ${band.className}`}>
            {band.label}
          </span>
          <div>
            <p className="text-2xl font-bold">
              {result.rawScore} / {result.total} correct
            </p>
            <p className="text-sm text-slate-500">
              Indicative READING band only — the full 4-skill result comes from a complete mock
              exam.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-1 text-center text-xs font-medium">
          {(Object.keys(BAND_INFO) as Band[]).reverse().map((key) => (
            <div
              key={key}
              className={`rounded-md py-2 ${
                key === result.band ? BAND_INFO[key].className : 'bg-slate-100 text-slate-400'
              }`}
            >
              {BAND_INFO[key].label}
              <span className="block font-normal">{BAND_INFO[key].range}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold">Answer review</h2>
        {[...byPart.entries()]
          .sort(([a], [b]) => a - b)
          .map(([partNumber, items]) => (
            <div key={partNumber} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 font-semibold">
                Part {partNumber}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {items.filter((i) => i.correct).length}/{items.length} correct
                </span>
              </h3>
              <ol className="space-y-3">
                {items.map((item, index) => (
                  <ItemReview key={item.id} item={item} fallbackNumber={index + 1} />
                ))}
              </ol>
            </div>
          ))}
      </section>

      <div>
        <Link
          to="/"
          className="inline-block rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Take another test
        </Link>
      </div>
    </div>
  )
}

function ItemReview({ item, fallbackNumber }: { item: ItemResult; fallbackNumber: number }) {
  const numberMatch = item.id.match(/q(\d+)$/)
  const questionNumber = numberMatch ? Number(numberMatch[1]) : fallbackNumber

  return (
    <li
      className={`rounded-lg border p-4 ${
        item.correct ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`q-badge ${item.correct ? '!bg-emerald-600' : '!bg-rose-600'}`}>
          {questionNumber}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {item.prompt && <p className="mb-2 font-medium text-slate-700">{item.prompt}</p>}
          <p>
            <span className="text-slate-500">Your answer: </span>
            <span className={item.correct ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
              {item.userAnswerLabel ?? '— no answer —'}
            </span>
          </p>
          {!item.correct && (
            <p>
              <span className="text-slate-500">Correct answer: </span>
              <span className="font-semibold text-slate-800">{item.correctAnswerLabel}</span>
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-indigo-600 hover:underline">
              Explanation
            </summary>
            <div className="mt-2 space-y-1 rounded-md bg-white p-3 text-slate-700 ring-1 ring-slate-200">
              <p>
                <span className="font-semibold">Where: </span>
                {item.explanation.location}
              </p>
              <p className="italic text-slate-600">“{item.explanation.quote}”</p>
              <p>{item.explanation.reasoning}</p>
            </div>
          </details>
        </div>
      </div>
    </li>
  )
}
