import { useAnswersStore } from '../../../store/answers'
import type { SanitizedListeningPart, SanitizedMcqItem } from '../../../types/test'
import { MarkButton } from '../items/MarkButton'

// Part 1 — mcq_response: hear a short utterance, choose the best reply. Each
// item has 3 options (A/B/C) and NO written prompt — the audio is the prompt.
export function McqResponse({
  part,
  numbering,
}: {
  part: SanitizedListeningPart
  numbering: Record<string, number>
}) {
  const items = (part.items ?? []).filter((i): i is SanitizedMcqItem => i.type === 'mcq')
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <McqResponseItem key={item.id} item={item} number={numbering[item.id]} />
      ))}
    </div>
  )
}

function McqResponseItem({ item, number }: { item: SanitizedMcqItem; number: number }) {
  const value = useAnswersStore((s) => s.answers[item.id] ?? '')
  const setAnswer = useAnswersStore((s) => s.setAnswer)
  return (
    <fieldset id={`q-${item.id}`} className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <legend className="sr-only">Question {number}</legend>
      <div className="mb-2 flex items-center gap-2">
        <span className="q-badge">{number}</span>
        <span className="flex-1 text-xs font-semibold text-ink-soft">Choose the best reply</span>
        <MarkButton itemId={item.id} />
      </div>
      <div className="space-y-1.5">
        {item.options.map((option) => (
          <label
            key={option.key}
            className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              value === option.key
                ? 'border-brand bg-brand-soft font-bold text-brand'
                : 'border-line hover:bg-page'
            }`}
          >
            <input
              type="radio"
              name={item.id}
              value={option.key}
              checked={value === option.key}
              onChange={() => setAnswer(item.id, option.key)}
              className="mt-0.5 accent-brand"
            />
            <span>
              <span className="font-bold">{option.key}.</span> {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
