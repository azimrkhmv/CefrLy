import type { SanitizedTfngItem } from '../../../types/test'
import { useAnswersStore } from '../../../store/answers'
import { MarkButton } from './MarkButton'

export function TfngQuestion({ item, number }: { item: SanitizedTfngItem; number: number }) {
  const value = useAnswersStore((s) => s.answers[item.id] ?? '')
  const setAnswer = useAnswersStore((s) => s.setAnswer)

  const choices = [
    { value: 'true', label: 'True' },
    { value: 'false', label: 'False' },
    { value: 'not_given', label: item.thirdOptionLabel },
  ] as const

  return (
    <div id={`q-${item.id}`} className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="mb-3 flex items-start gap-2">
        <span className="q-badge">{number}</span>
        <p className="flex-1 text-sm font-semibold leading-relaxed">{item.prompt}</p>
        <MarkButton itemId={item.id} />
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Question ${number}`}>
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={value === choice.value}
            onClick={() => setAnswer(item.id, choice.value)}
            className={`rounded-xl border px-4 py-1.5 text-sm transition-colors ${
              value === choice.value
                ? 'border-brand bg-brand-soft font-bold text-brand'
                : 'border-line bg-white font-semibold text-ink hover:bg-page'
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  )
}
