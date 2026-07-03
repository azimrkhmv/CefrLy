import { useAnswersStore } from '../../../store/answers'

// Flag a question for review; flagged questions get an amber dot in the
// question navigator.
export function MarkButton({ itemId, className = '' }: { itemId: string; className?: string }) {
  const marked = useAnswersStore((s) => !!s.marked[itemId])
  const toggleMarked = useAnswersStore((s) => s.toggleMarked)

  return (
    <button
      type="button"
      onClick={() => toggleMarked(itemId)}
      aria-pressed={marked}
      aria-label={marked ? 'Remove review mark' : 'Mark for review'}
      title={marked ? 'Remove review mark' : 'Mark for review'}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-base leading-none transition-colors ${
        marked ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-slate-500'
      } ${className}`}
    >
      ⚑
    </button>
  )
}
