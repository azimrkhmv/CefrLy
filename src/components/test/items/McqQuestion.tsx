import type { SanitizedMcqItem } from '../../../types/test'
import { useAnswersStore } from '../../../store/answers'
import { MarkButton } from './MarkButton'

export function McqQuestion({ item, number }: { item: SanitizedMcqItem; number: number }) {
  const value = useAnswersStore((s) => s.answers[item.id] ?? '')
  const setAnswer = useAnswersStore((s) => s.setAnswer)

  return (
    <fieldset id={`q-${item.id}`} className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <legend className="sr-only">Question {number}</legend>
      <div className="mb-3 flex items-start gap-2">
        <span className="q-badge">{number}</span>
        <p className="flex-1 text-sm font-semibold leading-relaxed">{item.prompt}</p>
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
