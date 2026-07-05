import { useAnswersStore } from '../../../store/answers'
import type { SanitizedListeningPart } from '../../../types/test'
import { MarkButton } from '../items/MarkButton'

// Part 3 — matching: match each speaker to an option from the pool (with extras,
// each used once — but reuse isn't blocked; wrong picks are marked on results).
export function ListeningMatch({
  part,
  numbering,
}: {
  part: SanitizedListeningPart
  numbering: Record<string, number>
}) {
  const answers = useAnswersStore((s) => s.answers)
  const setAnswer = useAnswersStore((s) => s.setAnswer)
  const pool = part.optionPool ?? []
  const items = part.items ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="self-start rounded-xl bg-page p-4 lg:sticky lg:top-4">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
          Options
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
        {items.map(
          (item) =>
            item.type === 'match' && (
              <div
                key={item.id}
                id={`q-${item.id}`}
                className="rounded-2xl border border-line bg-white p-5 shadow-card"
              >
                <div className="mb-3 flex items-start gap-2">
                  <span className="q-badge">{numbering[item.id]}</span>
                  <p className="flex-1 text-sm font-semibold leading-relaxed">{item.prompt}</p>
                  <MarkButton itemId={item.id} />
                </div>
                <select
                  value={answers[item.id] ?? ''}
                  onChange={(e) => setAnswer(item.id, e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft"
                  aria-label={`Question ${numbering[item.id]}: choose an option`}
                >
                  <option value="">Choose an option</option>
                  {pool.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label && option.label !== option.key
                        ? `${option.key} — ${option.label}`
                        : option.key}
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
