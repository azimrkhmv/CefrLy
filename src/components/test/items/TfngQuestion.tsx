import type { SanitizedTfngItem } from '../../../types/test'
import { useAnswersStore } from '../../../store/answers'

export function TfngQuestion({ item, number }: { item: SanitizedTfngItem; number: number }) {
  const value = useAnswersStore((s) => s.answers[item.id] ?? '')
  const setAnswer = useAnswersStore((s) => s.setAnswer)

  const choices = [
    { value: 'true', label: 'True' },
    { value: 'false', label: 'False' },
    { value: 'not_given', label: item.thirdOptionLabel },
  ] as const

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start gap-2">
        <span className="q-badge">{number}</span>
        <p className="text-sm font-medium leading-relaxed">{item.prompt}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Question ${number}`}>
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={value === choice.value}
            onClick={() => setAnswer(item.id, choice.value)}
            className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-colors ${
              value === choice.value
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  )
}
