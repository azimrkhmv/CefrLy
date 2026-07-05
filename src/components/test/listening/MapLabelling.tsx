import { useAnswersStore } from '../../../store/answers'
import type { SanitizedListeningPart } from '../../../types/test'
import { imageUrl } from '../../../lib/storage'
import { MarkButton } from '../items/MarkButton'

// Part 4 — map_labelling: show the map/plan image, then label each place with a
// letter from the pool (with extras). The image is required for this layout.
export function MapLabelling({
  part,
  numbering,
}: {
  part: SanitizedListeningPart
  numbering: Record<string, number>
}) {
  const answers = useAnswersStore((s) => s.answers)
  const setAnswer = useAnswersStore((s) => s.setAnswer)
  const pool = part.optionPool ?? []
  const items = part.items ?? []

  return (
    <div className="space-y-5">
      {part.image && (
        <figure className="rounded-2xl border border-line bg-white p-3">
          <img
            src={imageUrl(part.image.assetPath)}
            alt={part.image.alt}
            className="mx-auto max-h-[440px] w-full max-w-2xl object-contain"
          />
        </figure>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(
          (item) =>
            item.type === 'match' && (
              <div
                key={item.id}
                id={`q-${item.id}`}
                className="flex items-center gap-2 rounded-2xl border border-line bg-white p-4 shadow-card"
              >
                <span className="q-badge">{numbering[item.id]}</span>
                <p className="min-w-0 flex-1 text-sm font-semibold">{item.prompt}</p>
                <select
                  value={answers[item.id] ?? ''}
                  onChange={(e) => setAnswer(item.id, e.target.value)}
                  className="w-24 shrink-0 rounded-xl border border-line bg-white px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft"
                  aria-label={`Question ${numbering[item.id]}: choose a letter for ${item.prompt}`}
                >
                  <option value="">—</option>
                  {pool.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.key}
                    </option>
                  ))}
                </select>
                <MarkButton itemId={item.id} />
              </div>
            ),
        )}
      </div>
    </div>
  )
}
