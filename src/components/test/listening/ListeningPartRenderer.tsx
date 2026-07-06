import type { SanitizedListeningPart } from '../../../types/test'
import { ListeningAudio } from '../ListeningAudio'
import { McqResponse } from './McqResponse'
import { StemCompletion } from './StemCompletion'
import { ListeningMatch } from './ListeningMatch'
import { MapLabelling } from './MapLabelling'
import { MultiExtractMcq } from './MultiExtractMcq'

// Renders one Listening part: its per-part audio player (in per_part mode) then
// the correct layout renderer. In single mode the one player lives at the
// section top (TestPage), so no per-part player is shown here. `practice`
// selects a controllable player (practice) vs the locked exam player (simulation).
export function ListeningPartRenderer({
  part,
  numbering,
  audioMode,
  practice,
}: {
  part: SanitizedListeningPart
  numbering: Record<string, number>
  audioMode: 'per_part' | 'single'
  practice: boolean
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-heading">Part {part.number}</h2>
        <p className="mt-1 text-sm text-ink-soft">{part.instructions}</p>
      </div>

      {audioMode === 'per_part' && part.audio && (
        <ListeningAudio
          audio={part.audio}
          label={`Part ${part.number} recording`}
          practice={practice}
        />
      )}

      {part.layout === 'mcq_response' && <McqResponse part={part} numbering={numbering} />}
      {part.layout === 'form_completion' && <StemCompletion part={part} numbering={numbering} />}
      {part.layout === 'matching' && <ListeningMatch part={part} numbering={numbering} />}
      {part.layout === 'map_labelling' && <MapLabelling part={part} numbering={numbering} />}
      {part.layout === 'multi_extract_mcq' && <MultiExtractMcq part={part} numbering={numbering} />}
      {part.layout === 'note_completion' && <StemCompletion part={part} numbering={numbering} />}
    </div>
  )
}
