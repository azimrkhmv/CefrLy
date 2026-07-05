import type { SanitizedListeningPart } from '../../../types/test'
import { PassageHtml } from '../PassageHtml'
import { GapInput } from '../items/GapInput'

// Parts 2 (form_completion) & 6 (note_completion): render stem.html and replace
// each {{itemId}} marker with an inline text input. Plain UI font (NOT the
// reading serif — that .passage style is reserved for reading passages).
export function StemCompletion({
  part,
  numbering,
}: {
  part: SanitizedListeningPart
  numbering: Record<string, number>
}) {
  const stem = part.stem
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      {stem?.title && (
        <h3 className="mb-4 text-base font-extrabold text-heading">{stem.title}</h3>
      )}
      <div className="space-y-1.5 text-sm leading-loose text-ink">
        <PassageHtml
          html={stem?.html ?? ''}
          renderGap={(itemId) => <GapInput itemId={itemId} number={numbering[itemId]} />}
        />
      </div>
    </div>
  )
}
