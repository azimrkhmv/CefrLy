// Student passage highlighting via the CSS Custom Highlight API. Highlights are
// painted by registering DOM Ranges — no DOM mutation — so React re-renders and
// gap <input>s inside the passage are never disturbed. Marks are stored as text
// character offsets (see store/highlights) and mapped to Ranges on demand, which
// makes them robust to any re-render that replaces the passage's text nodes.
//
// The Highlight API isn't in TypeScript's DOM lib yet, so it is reached through
// small guarded casts here rather than global augmentation.

const HL_NAME = 'cefrly-mark'

interface HighlightRegistry {
  set(name: string, hl: object): void
  delete(name: string): void
}
type HighlightCtor = new (...ranges: Range[]) => object

function highlightApi(): { registry: HighlightRegistry; Ctor: HighlightCtor } | null {
  const g = globalThis as unknown as {
    CSS?: { highlights?: HighlightRegistry }
    Highlight?: HighlightCtor
  }
  const registry = g.CSS?.highlights
  const Ctor = g.Highlight
  if (!registry || typeof Ctor !== 'function') return null
  return { registry, Ctor }
}

/** True when the browser can paint custom highlights (Chrome/Edge 105+, Safari
 *  17.2+, Firefox 140+). The marker toggle is hidden when this is false. */
export function highlightsSupported(): boolean {
  return highlightApi() !== null
}

// Each mounted passage container contributes a getter for its live DOM ranges.
// One shared Highlight is repainted from every source whenever anything changes.
const sources = new Set<() => Range[]>()

export function registerHighlightSource(getRanges: () => Range[]): () => void {
  sources.add(getRanges)
  rebuildHighlights()
  return () => {
    sources.delete(getRanges)
    rebuildHighlights()
  }
}

export function rebuildHighlights(): void {
  const api = highlightApi()
  if (!api) return
  const ranges: Range[] = []
  for (const get of sources) {
    try {
      for (const r of get()) ranges.push(r)
    } catch {
      /* container detached mid-rebuild — skip it */
    }
  }
  if (ranges.length === 0) {
    api.registry.delete(HL_NAME)
    return
  }
  api.registry.set(HL_NAME, new api.Ctor(...ranges))
}

// ---- offset <-> DOM mapping -------------------------------------------------
// Offsets count only text-node characters (Range.toString concatenation), so a
// gap <input> — which has no textContent — is transparent to the offset space.

function pointOffset(container: HTMLElement, node: Node, offsetInNode: number): number {
  const r = document.createRange()
  r.selectNodeContents(container)
  try {
    r.setEnd(node, offsetInNode)
  } catch {
    return container.textContent?.length ?? 0
  }
  return r.toString().length
}

/** Character offsets [start,end) of a selection Range within `container`. */
export function rangeToOffsets(container: HTMLElement, range: Range): { start: number; end: number } {
  const a = pointOffset(container, range.startContainer, range.startOffset)
  const b = pointOffset(container, range.endContainer, range.endOffset)
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

function textNodes(container: HTMLElement): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
  return nodes
}

function offsetToPos(container: HTMLElement, offset: number): { node: Text; offset: number } | null {
  const nodes = textNodes(container)
  if (nodes.length === 0) return null
  let remaining = Math.max(0, offset)
  for (const t of nodes) {
    if (remaining <= t.data.length) return { node: t, offset: remaining }
    remaining -= t.data.length
  }
  const last = nodes[nodes.length - 1]
  return { node: last, offset: last.data.length }
}

/** Build a DOM Range from stored character offsets, or null if unresolvable. */
export function offsetsToDomRange(container: HTMLElement, start: number, end: number): Range | null {
  const s = offsetToPos(container, start)
  const e = offsetToPos(container, end)
  if (!s || !e) return null
  const r = document.createRange()
  try {
    r.setStart(s.node, s.offset)
    r.setEnd(e.node, e.offset)
  } catch {
    return null
  }
  return r
}

/** Character offset under a screen point, for the eraser (null if off-text). */
export function pointToOffsetAt(container: HTMLElement, x: number, y: number): number | null {
  const doc = container.ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  let node: Node | null = null
  let offset = 0
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    if (!pos) return null
    node = pos.offsetNode
    offset = pos.offset
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    const rng = doc.caretRangeFromPoint(x, y)
    if (!rng) return null
    node = rng.startContainer
    offset = rng.startOffset
  } else {
    return null
  }
  if (!node || !container.contains(node)) return null
  return pointOffset(container, node, offset)
}
