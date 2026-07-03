import { useAnswersStore } from '../../store/answers'
import type { PartProps } from './PartRenderer'
import { PassageHtml } from './PassageHtml'

// Part 3: paragraphs I–VI each get a heading dropdown from the optionPool.
// Items align with passage.paragraphs by order. Reusing a heading is not
// blocked; it is simply marked wrong on results.
export function MatchHeadings({ part, numbering }: PartProps) {
  const answers = useAnswersStore((s) => s.answers)
  const setAnswer = useAnswersStore((s) => s.setAnswer)
  const pool = part.optionPool ?? []
  const paragraphs = part.passage?.paragraphs ?? []

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          List of headings
        </h3>
        <ul className="space-y-1 text-sm">
          {pool.map((option) => (
            <li key={option.key}>
              <span className="font-semibold">{option.key}.</span> {option.label}
            </li>
          ))}
        </ul>
      </div>

      {part.passage?.title && (
        <h3 className="text-base font-semibold">{part.passage.title}</h3>
      )}

      <div className="space-y-5">
        {paragraphs.map((paragraph, index) => {
          const item = part.items[index]
          return (
            <div key={paragraph.label} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="font-bold text-slate-700">Paragraph {paragraph.label}</span>
                {item && (
                  <>
                    <span className="q-badge">{numbering[item.id]}</span>
                    <select
                      value={answers[item.id] ?? ''}
                      onChange={(e) => setAnswer(item.id, e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                      aria-label={`Heading for paragraph ${paragraph.label}`}
                    >
                      <option value="">— Choose a heading —</option>
                      {pool.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.key}. {option.label}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              <div className="passage text-sm text-slate-700">
                <PassageHtml html={paragraph.html} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
