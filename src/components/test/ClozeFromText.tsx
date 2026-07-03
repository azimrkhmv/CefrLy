import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PartProps } from './PartRenderer'
import { GAP_MARKER_RE } from './gapMarkers'
import { GapInput } from './items/GapInput'

// Part 1: the passage html contains {{itemId}} markers. We swap each marker for
// an empty <span data-gap-id> and portal a controlled input into it, so the
// inputs sit inline in the text without breaking the passage markup.
export function ClozeFromText({ part, numbering }: PartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [slots, setSlots] = useState<{ id: string; el: HTMLElement }[]>([])

  const html = useMemo(
    () =>
      (part.passage?.html ?? '').replace(
        GAP_MARKER_RE,
        (_match, id: string) => `<span data-gap-id="${id}"></span>`,
      ),
    [part],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const found = Array.from(container.querySelectorAll<HTMLElement>('[data-gap-id]')).map(
      (el) => ({ id: el.dataset.gapId!, el }),
    )
    setSlots(found)
  }, [html])

  return (
    <div>
      {part.passage?.title && (
        <h3 className="mb-3 text-base font-semibold">{part.passage.title}</h3>
      )}
      <div
        ref={containerRef}
        className="passage max-w-3xl"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {slots.map(({ id, el }) => createPortal(<GapInput itemId={id} number={numbering[id]} />, el))}
    </div>
  )
}
