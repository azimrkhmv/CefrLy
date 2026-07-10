import type { SanitizedItem } from '../../types/test'
import type { PartProps } from './PartRenderer'
import { PassageHtml } from './PassageHtml'
import { GAP_MARKER_RE } from './gapMarkers'
import { GapInput } from './items/GapInput'
import { McqQuestion } from './items/McqQuestion'
import { TfngQuestion } from './items/TfngQuestion'

// Part 5's summary-completion section is authored inside the passage html: a
// heading (e.g. <h4>How papyrus documents have survived</h4>) followed by a
// paragraph carrying the {{itemId}} gap markers. Split it off the main text so
// the reading passage stays on the LEFT and the summary — with its gaps as real
// inline inputs — renders on the RIGHT, in order with the other questions.
function splitPassage(html: string): { main: string; summary: string } {
  const markerAt = html.indexOf('{{')
  if (markerAt === -1) return { main: html, summary: '' }
  const head = html.slice(0, markerAt)
  // The summary starts at the heading that introduces it (the last <h1-6>
  // before the first gap); if it has no heading, fall back to the block element
  // that directly contains the first gap.
  const headings = [...head.matchAll(/<h[1-6][\s>]/gi)]
  let cut = headings.length ? (headings[headings.length - 1].index ?? -1) : -1
  if (cut === -1) {
    const blocks = [...head.matchAll(/<(?:p|ul|ol|blockquote)[\s>]/gi)]
    cut = blocks.length ? (blocks[blocks.length - 1].index ?? 0) : 0
  }
  return { main: html.slice(0, cut), summary: html.slice(cut) }
}

// Parts 4 & 5: split-pane. Passage left, questions right in list order.
export function PassageQuestions({ part, numbering }: PartProps) {
  const html = part.passage?.html ?? ''
  const { main, summary } = splitPassage(html)

  // Gaps that live in the summary render inline there; keep them out of the
  // right-pane list. Any gap WITHOUT a marker still falls back to a card so it
  // can never become unanswerable.
  const markerIds = new Set<string>()
  for (const m of html.matchAll(GAP_MARKER_RE)) markerIds.add(m[1])
  const sideItems = part.items.filter(
    (item) => !(item.type === 'gap' && markerIds.has(item.id)),
  )

  const renderGap = (itemId: string) => (
    <GapInput itemId={itemId} number={numbering[itemId]} />
  )

  // Passage gets the wider column (~58%) — reading is the hard part; the T/F +
  // short-MCQ controls on the right need far less room.
  return (
    <div className="grid gap-6 lg:grid-cols-[7fr_5fr]">
      <div className="self-start rounded-2xl border border-line bg-white p-5 shadow-card lg:sticky lg:top-4 lg:max-h-[75vh] lg:overflow-y-auto">
        {part.passage?.title && (
          <h3 className="mb-3 text-base font-extrabold text-heading">{part.passage.title}</h3>
        )}
        <div className="passage">
          <PassageHtml html={main} renderGap={renderGap} />
        </div>
      </div>

      <div className="space-y-4">
        {summary.trim() && (
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="passage">
              <PassageHtml html={summary} renderGap={renderGap} />
            </div>
          </div>
        )}
        {sideItems.map((item) => (
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
      // Fallback only: a gap with no {{marker}} in the passage. Marker-backed
      // gaps render inline in the summary above and are filtered out here.
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
