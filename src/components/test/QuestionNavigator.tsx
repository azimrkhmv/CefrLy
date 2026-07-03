import { useAnswersStore } from '../../store/answers'
import type { SanitizedReadingTest } from '../../types/test'

interface QuestionNavigatorProps {
  test: SanitizedReadingTest
  numbering: Record<string, number>
  onJump: (itemId: string) => void
}

// Numbered 1–35 grid: filled = answered, outline = unanswered, amber dot =
// marked for review. Clicking a number jumps to that question.
export function QuestionNavigator({ test, numbering, onJump }: QuestionNavigatorProps) {
  const answers = useAnswersStore((s) => s.answers)
  const marked = useAnswersStore((s) => s.marked)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
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
                className={`relative flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                  answered
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100'
                }`}
              >
                {number}
                {isMarked && (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
                )}
              </button>
            )
          }),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-indigo-600" /> answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-white ring-1 ring-slate-300" /> not
          answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> marked for review
        </span>
      </div>
    </div>
  )
}
