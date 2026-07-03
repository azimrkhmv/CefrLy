import { useAnswersStore } from '../../store/answers'
import type { PartProps } from './PartRenderer'
import { MarkButton } from './items/MarkButton'

// Part 2: each item.prompt is a short text; the shared optionPool (A–J) holds
// the statements. Reusing a letter is allowed — wrong picks are marked on results.
export function MatchTexts({ part, numbering }: PartProps) {
  const answers = useAnswersStore((s) => s.answers)
  const setAnswer = useAnswersStore((s) => s.setAnswer)
  const pool = part.optionPool ?? []
  const lastKey = pool.length > 0 ? pool[pool.length - 1].key : ''

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="self-start rounded-lg border border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Statements A–{lastKey}
        </h3>
        <ul className="space-y-1.5 text-sm leading-relaxed">
          {pool.map((option) => (
            <li key={option.key}>
              <span className="font-semibold">{option.key}.</span> {option.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        {part.items.map(
          (item) =>
            item.type === 'match' && (
              <div
                key={item.id}
                id={`q-${item.id}`}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="mb-3 flex items-start gap-2">
                  <span className="q-badge">{numbering[item.id]}</span>
                  <p className="flex-1 text-sm leading-relaxed">{item.prompt}</p>
                  <MarkButton itemId={item.id} />
                </div>
                <select
                  value={answers[item.id] ?? ''}
                  onChange={(e) => setAnswer(item.id, e.target.value)}
                  className="w-full max-w-xs rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                  aria-label={`Question ${numbering[item.id]}: choose a statement`}
                >
                  <option value="">— Choose a statement —</option>
                  {pool.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.key}
                    </option>
                  ))}
                </select>
              </div>
            ),
        )}
      </div>
    </div>
  )
}
