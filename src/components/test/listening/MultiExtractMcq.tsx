import type { SanitizedListeningPart, SanitizedMcqItem } from '../../../types/test'
import { McqQuestion } from '../items/McqQuestion'

// Part 5 — multi_extract_mcq: three extracts, each rendered as a block with its
// context line followed by its two MCQs.
export function MultiExtractMcq({
  part,
  numbering,
}: {
  part: SanitizedListeningPart
  numbering: Record<string, number>
}) {
  const groups = part.groups ?? []
  return (
    <div className="space-y-6">
      {groups.map((group, index) => (
        <div key={group.id} className="rounded-2xl border border-line bg-page/60 p-4 sm:p-5">
          <p className="mb-3 flex items-start gap-2 text-sm font-semibold leading-relaxed text-heading">
            <span className="mt-0.5 shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
              Extract {index + 1}
            </span>
            <span>{group.context}</span>
          </p>
          <div className="space-y-4">
            {group.items.map(
              (item) =>
                item.type === 'mcq' && (
                  <McqQuestion
                    key={item.id}
                    item={item as SanitizedMcqItem}
                    number={numbering[item.id]}
                  />
                ),
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
