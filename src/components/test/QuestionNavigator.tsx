import { useAnswersStore } from '../../store/answers'
import type { SanitizedReadingTest } from '../../types/test'

interface QuestionNavigatorProps {
  test: SanitizedReadingTest
  numbering: Record<string, number>
  onJump: (itemId: string) => void
}

// Numbered 1–35 grid: brand wash = answered, outline = unanswered, accent dot =
// marked for review. Clicking a number jumps to that question.
export function QuestionNavigator({ test, numbering, onJump }: QuestionNavigatorProps) {
  const answers = useAnswersStore((s) => s.answers)
  const marked = useAnswersStore((s) => s.marked)

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap gap-1.5">
        {test.parts.flatMap((part) =>
          part.items.map((item) => {
            const answered = (answers[item.id] ?? '').trim() !== ''
            const isMarked = !!marked[item.id]
            const number = numbering[item.id]
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onJump(item.id)}
                aria-label={`Go to question ${number} (Part ${part.number})${
                  answered ? ', answered' : ', not answered'
                }${isMarked ? ', marked for review' : ''}`}
                className={`tnum relative flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors ${
                  answered
                    ? 'border-brand/40 bg-brand-soft font-bold text-brand hover:border-brand'
                    : 'border-line bg-white font-semibold text-ink-soft hover:border-ink-faint'
                }`}
              >
                {number}
                {isMarked && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" />
                )}
              </button>
            )
          }),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-md border border-brand/40 bg-brand-soft" />{' '}
          answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-md border border-line bg-white" /> not
          answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" /> marked for review
        </span>
      </div>
    </div>
  )
}
