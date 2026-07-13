import { useEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { useHighlightsStore } from '../../store/highlights'
import {
  offsetsToDomRange,
  pointToOffsetAt,
  rangeToOffsets,
  rebuildHighlights,
  registerHighlightSource,
} from '../../lib/textHighlight'

// Wraps a passage container so a student in marker mode can highlight its text.
// Marks live in the highlights store keyed by `markKey` (as character offsets)
// and are painted by the shared CSS-Highlight controller — no DOM mutation, so
// this composes over PassageHtml (gap inputs and all) without touching it.
export function HighlightablePassage({
  markKey,
  className,
  children,
}: {
  markKey: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const markerMode = useHighlightsStore((s) => s.markerMode)
  const ranges = useHighlightsStore((s) => s.marks[markKey])
  const addMark = useHighlightsStore((s) => s.addMark)
  const eraseAt = useHighlightsStore((s) => s.eraseAt)

  // Register this container as a source of DOM ranges for the shared highlight;
  // repaint when its content mutates (e.g. a sibling re-render replaces nodes).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const source = () => {
      const stored = useHighlightsStore.getState().marks[markKey] ?? []
      const out: Range[] = []
      for (const r of stored) {
        const dom = offsetsToDomRange(el, r.start, r.end)
        if (dom) out.push(dom)
      }
      return out
    }
    const unregister = registerHighlightSource(source)
    const observer = new MutationObserver(() => rebuildHighlights())
    observer.observe(el, { childList: true, subtree: true, characterData: true })
    return () => {
      unregister()
      observer.disconnect()
    }
  }, [markKey])

  // Repaint when this container's stored ranges change (add / erase / hydrate).
  useEffect(() => {
    rebuildHighlights()
  }, [ranges])

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!markerMode) return
    const el = ref.current
    if (!el) return
    const selection = el.ownerDocument.getSelection()
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      if (el.contains(range.commonAncestorContainer)) {
        const { start, end } = rangeToOffsets(el, range)
        if (end > start) {
          addMark(markKey, { start, end })
          selection.removeAllRanges()
        }
      }
      return
    }
    // Collapsed release in marker mode = eraser: drop the mark under the cursor.
    const offset = pointToOffsetAt(el, e.clientX, e.clientY)
    if (offset != null) eraseAt(markKey, offset)
  }

  return (
    <div
      ref={ref}
      onPointerUp={onPointerUp}
      className={[className, markerMode ? 'cefrly-marking' : ''].filter(Boolean).join(' ') || undefined}
    >
      {children}
    </div>
  )
}
