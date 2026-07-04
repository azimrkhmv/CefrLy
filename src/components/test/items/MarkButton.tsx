import { useAnswersStore } from '../../../store/answers'
import { FlagIcon } from '../../icons'

// Flag a question for review; flagged questions get an accent dot in the
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
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-xl px-1 text-xs font-bold leading-none transition-colors ${
        marked ? 'text-accent-deep' : 'text-ink-soft hover:text-ink'
      } ${className}`}
    >
      <FlagIcon width={14} height={14} />
      {marked ? 'Marked' : 'Mark'}
    </button>
  )
}
