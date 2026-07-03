import { useMemo } from 'react'
import type { SanitizedItem } from '../../types/test'
import type { PartProps } from './PartRenderer'
import { GAP_MARKER_RE } from './gapMarkers'
import { GapInput } from './items/GapInput'
import { McqQuestion } from './items/McqQuestion'
import { TfngQuestion } from './items/TfngQuestion'

// Parts 4 & 5: split-pane. Passage left ({{itemId}} markers become numbered
// blanks), questions right in list order, each rendered per its own type.
export function PassageQuestions({ part, numbering }: PartProps) {
  const html = useMemo(
    () =>
      (part.passage?.html ?? '').replace(GAP_MARKER_RE, (_match, id: string) => {
        const number = numbering[id]
        return `<span class="gap-marker">${number ?? '?'} ________</span>`
      }),
    [part, numbering],
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="self-start rounded-lg border border-slate-200 bg-slate-50 p-5 lg:sticky lg:top-4 lg:max-h-[75vh] lg:overflow-y-auto">
        {part.passage?.title && (
          <h3 className="mb-3 text-base font-semibold">{part.passage.title}</h3>
        )}
        <div className="passage text-[15px]" dangerouslySetInnerHTML={{ __html: html }} />
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
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-600">
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
