import { Fragment, createElement, type ReactNode } from 'react'
import { GAP_MARKER_RE } from '../components/test/gapMarkers'

// Turns a reading passage into a marked-up "answer map": every question's
// answer location is highlighted and stamped with a Qn badge, WITHOUT any
// manual annotation — the data already exists on each item:
//   * mcq / match / tfng → item.explanation.quote is the exact passage sentence.
//     We locate that quote (fuzzily) and wrap it.
//   * gap (cloze / summary) → the {{itemId}} marker IS the location; we fill it
//     with the correct word and label it.
// If a quote can't be located (rare — a typo in the quote), that question simply
// gets no inline highlight and the review card shows the quote as a citation.

export interface QuoteHighlight {
  n: number
  quote: string
  location?: string
  correct: boolean
}

export interface GapFill {
  n: number
  /** The correct word to show in the gap. */
  answer: string
  correct: boolean
}

// Normalise for matching (curly punctuation → straight, whitespace collapsed,
// lowercased) while keeping `map[i]` = the ORIGINAL index of normalised char i,
// so a match position maps back to a real range in the source text.
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = ''
  const map: number[] = []
  let prevSpace = false
  for (let i = 0; i < s.length; i++) {
    let c = s[i]
    const code = s.charCodeAt(i)
    if (code === 0x2018 || code === 0x2019 || code === 0x02bc || code === 0x2032) c = "'"
    else if (code === 0x201c || code === 0x201d || code === 0x2033) c = '"'
    else if (code === 0x2013 || code === 0x2014 || code === 0x2212) c = '-'
    else if (code === 0x00a0) c = ' '
    if (/\s/.test(c)) {
      if (prevSpace) continue
      prevSpace = true
      norm += ' '
      map.push(i)
      continue
    }
    prevSpace = false
    norm += c.toLowerCase()
    map.push(i)
  }
  return { norm, map }
}

function normalize(s: string): string {
  return normalizeWithMap(s).norm.trim()
}

// Authors elide non-contiguous evidence with … / ... — highlight each fragment.
export function quoteFragments(quote: string): string[] {
  return quote
    .split(/\s*(?:\.\.\.|…|\[…\]|\[\.\.\.\])\s*/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 5)
}

interface Range {
  start: number
  end: number
  n: number
  correct: boolean
  badge: boolean
}

// Character ranges in `text` for each quote's fragments. A quote resolves if any
// fragment is found; if none match, it goes to `unresolved` (fallback citation).
function rangesForQuotes(
  text: string,
  quotes: QuoteHighlight[],
): { ranges: Range[]; unresolved: QuoteHighlight[] } {
  const { norm, map } = normalizeWithMap(text)
  const ranges: Range[] = []
  const unresolved: QuoteHighlight[] = []
  for (const q of quotes) {
    let resolved = false
    for (const frag of quoteFragments(q.quote)) {
      const fnorm = normalize(frag)
      if (!fnorm) continue
      const j = norm.indexOf(fnorm)
      if (j === -1) continue
      ranges.push({
        start: map[j],
        end: map[j + fnorm.length - 1] + 1,
        n: q.n,
        correct: q.correct,
        badge: false,
      })
      resolved = true
    }
    if (!resolved) unresolved.push(q)
  }
  // Exactly one badge per question — on its earliest occurrence in this text.
  const earliest = new Map<number, Range>()
  for (const r of ranges) {
    const cur = earliest.get(r.n)
    if (!cur || r.start < cur.start) earliest.set(r.n, r)
  }
  for (const r of ranges) r.badge = earliest.get(r.n) === r
  return { ranges, unresolved }
}

function QBadge({ n, correct }: { n: number; correct: boolean }) {
  return (
    <span
      className={`mr-1 inline-block rounded px-1 py-px align-middle text-[10px] font-extrabold leading-none text-white ${
        correct ? 'bg-emerald-600' : 'bg-rose-500'
      }`}
    >
      Q{n}
    </span>
  )
}

// Render `text` with its ranges wrapped in highlights. `seenAnchor` tracks which
// questions already carry the scroll anchor (first occurrence wins), so Locate
// jumps to a stable target even across blocks.
function renderRanges(
  text: string,
  ranges: Range[],
  focusedN: number | null,
  seenAnchor: Set<number>,
  keyBase: string,
): ReactNode[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const out: ReactNode[] = []
  let cursor = 0
  let k = 0
  for (const r of sorted) {
    if (r.start < cursor) continue // drop overlapping highlight
    if (r.start > cursor) out.push(<Fragment key={`${keyBase}t${k++}`}>{text.slice(cursor, r.start)}</Fragment>)
    const anchor = r.badge && !seenAnchor.has(r.n)
    if (anchor) seenAnchor.add(r.n)
    out.push(
      <mark
        key={`${keyBase}m${k++}`}
        id={anchor ? `hl-q${r.n}` : undefined}
        className={`rounded bg-sun-soft px-0.5 py-px text-inherit ${
          focusedN === r.n ? 'ring-2 ring-brand ring-offset-1' : ''
        }`}
      >
        {r.badge && <QBadge n={r.n} correct={r.correct} />}
        {text.slice(r.start, r.end)}
      </mark>,
    )
    cursor = r.end
  }
  if (cursor < text.length) out.push(<Fragment key={`${keyBase}t${k++}`}>{text.slice(cursor)}</Fragment>)
  return out
}

/** Highlight one or more question quotes inside a single plain text string
 *  (used for Part 3 paragraphs and Part 2 texts, which have no shared passage). */
export function HighlightedText({
  text,
  quotes,
  focusedN,
}: {
  text: string
  quotes: QuoteHighlight[]
  focusedN: number | null
}) {
  const seen = new Set<number>()
  const { ranges } = rangesForQuotes(text, quotes)
  return <>{renderRanges(text, ranges, focusedN, seen, 't')}</>
}

function parseParagraphIndex(location?: string): number | null {
  if (!location) return null
  const m = location.match(/paragraph\s+(\d+)/i)
  return m ? Number(m[1]) - 1 : null
}

function renderGapBlock(
  text: string,
  gaps: Record<string, GapFill>,
  focusedN: number | null,
  seenAnchor: Set<number>,
  keyBase: string,
): ReactNode[] {
  // split() with the capturing GAP_MARKER_RE interleaves [text, itemId, text, …]
  return text.split(GAP_MARKER_RE).map((seg, i) => {
    if (i % 2 === 0) return <Fragment key={`${keyBase}g${i}`}>{seg}</Fragment>
    const g = gaps[seg]
    if (!g) return <span key={`${keyBase}g${i}`}>______</span>
    const anchor = !seenAnchor.has(g.n)
    if (anchor) seenAnchor.add(g.n)
    return (
      <mark
        key={`${keyBase}g${i}`}
        id={anchor ? `hl-q${g.n}` : undefined}
        className={`rounded bg-sun-soft px-1 py-px font-semibold text-inherit ${
          focusedN === g.n ? 'ring-2 ring-brand ring-offset-1' : ''
        }`}
      >
        <QBadge n={g.n} correct={g.correct} />
        {g.answer}
      </mark>
    )
  })
}

/** Render passage HTML with gaps filled+labelled and quote evidence highlighted.
 *  Blocks that contain {{markers}} render the filled gaps; plain blocks get
 *  their assigned question quotes highlighted (location paragraph preferred). */
export function HighlightedPassage({
  html,
  gaps,
  quotes,
  focusedN,
}: {
  html: string
  gaps: Record<string, GapFill>
  quotes: QuoteHighlight[]
  focusedN: number | null
}) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = Array.from(doc.body.childNodes)
  const blockText = blocks.map((b) => b.textContent ?? '')
  const seenAnchor = new Set<number>()

  // Assign each quote to one plain-text block (prefer its location paragraph,
  // else the first block that contains a fragment). Unmatched quotes are simply
  // not highlighted — the review card still cites them.
  const quotesByBlock: QuoteHighlight[][] = blocks.map(() => [])
  const blockMatches = (bi: number, frags: string[]) => {
    if (blockText[bi].includes('{{')) return false
    const norm = normalizeWithMap(blockText[bi]).norm
    return frags.some((f) => norm.includes(normalize(f)))
  }
  for (const q of quotes) {
    const frags = quoteFragments(q.quote)
    const loc = parseParagraphIndex(q.location)
    let target = -1
    if (loc != null && blocks[loc] && blockMatches(loc, frags)) target = loc
    else {
      for (let bi = 0; bi < blocks.length; bi++) {
        if (blockMatches(bi, frags)) {
          target = bi
          break
        }
      }
    }
    if (target !== -1) quotesByBlock[target].push(q)
  }

  const children = blocks.map((node, bi) => {
    const text = blockText[bi]
    if (node.nodeType !== Node.ELEMENT_NODE && !text.trim()) return null
    const tag = node.nodeType === Node.ELEMENT_NODE ? (node as Element).tagName.toLowerCase() : 'p'
    const inner = text.includes('{{')
      ? renderGapBlock(text, gaps, focusedN, seenAnchor, `b${bi}`)
      : renderRanges(text, rangesForQuotes(text, quotesByBlock[bi]).ranges, focusedN, seenAnchor, `b${bi}`)
    return createElement(tag === 'h4' ? 'h4' : 'p', { key: bi }, inner)
  })

  return <>{children}</>
}
