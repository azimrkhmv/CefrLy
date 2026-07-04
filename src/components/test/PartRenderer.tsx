import type { SanitizedPart } from '../../types/test'
import { ClozeFromText } from './ClozeFromText'
import { MatchTexts } from './MatchTexts'
import { MatchHeadings } from './MatchHeadings'
import { PassageQuestions } from './PassageQuestions'

export interface PartProps {
  part: SanitizedPart
  /** itemId -> global question number (1–35). */
  numbering: Record<string, number>
}

export function PartRenderer({ part, numbering }: PartProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-heading">Part {part.number}</h2>
        <p className="mt-1 text-sm text-ink-soft">{part.instructions}</p>
      </div>
      {part.layout === 'cloze_from_text' && <ClozeFromText part={part} numbering={numbering} />}
      {part.layout === 'match_texts' && <MatchTexts part={part} numbering={numbering} />}
      {part.layout === 'match_headings' && <MatchHeadings part={part} numbering={numbering} />}
      {part.layout === 'passage_questions' && (
        <PassageQuestions part={part} numbering={numbering} />
      )}
    </div>
  )
}
