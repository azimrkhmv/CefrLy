import type { SanitizedItem } from '../../types/test'
import type { PartProps } from './PartRenderer'
import { PassageHtml } from './PassageHtml'
import { GapInput } from './items/GapInput'
import { McqQuestion } from './items/McqQuestion'
import { TfngQuestion } from './items/TfngQuestion'

// Parts 4 & 5: split-pane. Passage left ({{itemId}} markers become numbered
// blanks), questions right in list order, each rendered per its own type.
export function PassageQuestions({ part, numbering }: PartProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="self-start rounded-2xl border border-line bg-white p-5 shadow-card lg:sticky lg:top-4 lg:max-h-[75vh] lg:overflow-y-auto">
        {part.passage?.title && (
          <h3 className="mb-3 text-base font-extrabold text-heading">{part.passage.title}</h3>
        )}
        <div className="passage">
          <PassageHtml
            html={part.passage?.html ?? ''}
            renderGap={(itemId) => (
              <span className="gap-marker">{numbering[itemId] ?? '?'} ________</span>
            )}
          />
        </div>
      </div>

      <div className="space-y-4">
        {part.items.map((item) => (
          <QuestionItem key={item.id} item={item} number={numbering[item.id]} />
        ))}
      </div>
    </div>
  )
}

function QuestionItem({ item, number }: { item: SanitizedItem; number: number }) {
  switch (item.type) {
    case 'mcq':
      return <McqQuestion item={item} number={number} />
    case 'tfng':
      return <TfngQuestion item={item} number={number} />
    case 'gap':
      return (
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="mb-2 text-sm font-semibold text-ink-soft">
            Complete gap {number} in the summary (one word from the text).
          </p>
          <GapInput itemId={item.id} number={number} />
        </div>
      )
    case 'match':
      // match items never appear in passage_questions layouts
      return null
  }
}
