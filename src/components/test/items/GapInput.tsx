import { useAnswersStore } from '../../../store/answers'

export function GapInput({ itemId, number }: { itemId: string; number?: number }) {
  const value = useAnswersStore((s) => s.answers[itemId] ?? '')
  const setAnswer = useAnswersStore((s) => s.setAnswer)

  return (
    <span className="inline-flex items-baseline gap-1 align-baseline">
      {number != null && <span className="q-badge">{number}</span>}
      <input
        type="text"
        value={value}
        onChange={(e) => setAnswer(itemId, e.target.value)}
        className="w-32 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-sm focus:border-indigo-500 focus:outline-none"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={number != null ? `Question ${number}` : 'Gap answer'}
      />
    </span>
  )
}
