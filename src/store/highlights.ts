import { create } from 'zustand'

/** One highlighted span, stored as character offsets into a passage container's
 *  text (not DOM nodes) so it survives React re-renders and page refreshes. */
export interface MarkRange {
  start: number
  end: number
}

interface HighlightsState {
  /** When on, selecting passage text marks it; clicking a mark removes it. */
  markerMode: boolean
  /** markKey (one passage container) -> its highlighted ranges. */
  marks: Record<string, MarkRange[]>
  setMarkerMode: (on: boolean) => void
  toggleMarkerMode: () => void
  addMark: (key: string, range: MarkRange) => void
  /** Remove the highlight covering `offset` in `key` (the eraser). */
  eraseAt: (key: string, offset: number) => void
  clearAll: () => void
  hydrate: (marks: Record<string, MarkRange[]>) => void
  reset: () => void
}

// Merge overlapping/adjacent ranges so a container holds one clean span per
// contiguous highlight — keeps re-marking idempotent and erasing predictable.
function mergeRanges(ranges: MarkRange[]): MarkRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const out: MarkRange[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else out.push({ start: r.start, end: r.end })
  }
  return out
}

export const useHighlightsStore = create<HighlightsState>((set) => ({
  markerMode: false,
  marks: {},
  setMarkerMode: (on) => set({ markerMode: on }),
  toggleMarkerMode: () => set((s) => ({ markerMode: !s.markerMode })),
  addMark: (key, range) =>
    set((s) => {
      if (range.end <= range.start) return {}
      return { marks: { ...s.marks, [key]: mergeRanges([...(s.marks[key] ?? []), range]) } }
    }),
  eraseAt: (key, offset) =>
    set((s) => {
      const arr = s.marks[key]
      if (!arr || arr.length === 0) return {}
      let idx = -1
      for (let i = arr.length - 1; i >= 0; i--) {
        if (offset >= arr[i].start && offset <= arr[i].end) {
          idx = i
          break
        }
      }
      if (idx === -1) return {}
      const next = arr.slice()
      next.splice(idx, 1)
      const marks = { ...s.marks }
      if (next.length) marks[key] = next
      else delete marks[key]
      return { marks }
    }),
  clearAll: () => set({ marks: {} }),
  hydrate: (marks) => set({ marks: marks ?? {} }),
  reset: () => set({ markerMode: false, marks: {} }),
}))
