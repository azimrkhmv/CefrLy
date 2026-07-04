import { useAnswersStore } from '../../../store/answers'
import { MarkButton } from './MarkButton'

export function GapInput({ itemId, number }: { itemId: string; number?: number }) {
  const value = useAnswersStore((s) => s.answers[itemId] ?? '')
  const setAnswer = useAnswersStore((s) => s.setAnswer)

  return (
    <span id={`q-${itemId}`} className="inline-flex items-baseline gap-1 align-baseline">
      {number != null && <span className="q-badge">{number}</span>}
      <input
        type="text"
        value={value}
        onChange={(e) => setAnswer(itemId, e.target.value)}
        className="w-32 rounded-xl border border-line bg-white px-2 py-0.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={number != null ? `Question ${number}` : 'Gap answer'}
      />
      <MarkButton itemId={itemId} className="self-center" />
    </span>
  )
}
