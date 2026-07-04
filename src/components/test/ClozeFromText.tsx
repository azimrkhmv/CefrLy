import type { PartProps } from './PartRenderer'
import { PassageHtml } from './PassageHtml'
import { GapInput } from './items/GapInput'

// Part 1: the passage html contains {{itemId}} markers, each rendered as a
// small inline text input directly in the text.
export function ClozeFromText({ part, numbering }: PartProps) {
  return (
    <div>
      {part.passage?.title && (
        <h3 className="mb-3 text-base font-extrabold text-heading">{part.passage.title}</h3>
      )}
      <div className="passage max-w-3xl">
        <PassageHtml
          html={part.passage?.html ?? ''}
          renderGap={(itemId) => <GapInput itemId={itemId} number={numbering[itemId]} />}
        />
      </div>
    </div>
  )
}
