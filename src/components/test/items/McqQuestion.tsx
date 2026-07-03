import type { SanitizedMcqItem } from '../../../types/test'
import { useAnswersStore } from '../../../store/answers'

export function McqQuestion({ item, number }: { item: SanitizedMcqItem; number: number }) {
  const value = useAnswersStore((s) => s.answers[item.id] ?? '')
  const setAnswer = useAnswersStore((s) => s.setAnswer)

  return (
    <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
      <legend className="sr-only">Question {number}</legend>
      <div className="mb-3 flex items-start gap-2">
        <span className="q-badge">{number}</span>
        <p className="text-sm font-medium leading-relaxed">{item.prompt}</p>
      </div>
      <div className="space-y-1.5">
        {item.options.map((option) => (
          <label
            key={option.key}
            className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              value === option.key
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name={item.id}
              value={option.key}
              checked={value === option.key}
              onChange={() => setAnswer(item.id, option.key)}
              className="mt-0.5 accent-indigo-600"
            />
            <span>
              <span className="font-semibold">{option.key}.</span> {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
