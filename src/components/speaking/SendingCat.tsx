import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// The waiting screen between "I have finished speaking" and "here is my band".
//
// Two different waits share it: the seconds while the last answers reach the
// server, and the minute while the examiner marks them. Both used to be a line
// of grey text, which reads like nothing is happening — the moment a student is
// most likely to close the tab, and closing it during the first one used to
// cost the paper.
//
// So: the mascot, a bubble that says what is happening in the student's own
// terms, and a bar that is visibly moving. The copy rotates slowly so a long
// wait still looks alive without ever claiming a percentage we do not know.
// ---------------------------------------------------------------------------

export function SendingCat({
  title,
  lines,
  note,
}: {
  title: string
  /** Rotating reassurance, shown one at a time in the cat's bubble. */
  lines: string[]
  note?: string
}) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (lines.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), 2600)
    return () => clearInterval(t)
  }, [lines.length])

  return (
    <div className="mt-5 rounded-2xl bg-brand-soft p-5 sm:p-6">
      <div className="flex items-end justify-center gap-3">
        <img
          src="/cat-read-grey.png"
          alt=""
          aria-hidden
          draggable={false}
          className="cat-bob h-20 w-auto select-none"
        />
        {/* aria-live so a screen reader hears the wait explained, not just a bar. */}
        <p
          key={i}
          aria-live="polite"
          className="bubble-pop mb-3 max-w-[15rem] rounded-2xl bg-white px-3.5 py-2 text-left text-xs font-bold text-brand-deep shadow-card"
        >
          {lines[i]}
        </p>
      </div>

      <p className="mt-3 font-extrabold text-heading">{title}</p>

      {/* Indeterminate on purpose: we know the stages, never the percentage. */}
      <div
        role="progressbar"
        aria-label={title}
        className="skeleton mx-auto mt-3 h-1.5 w-48 rounded-full"
      />

      {note && <p className="mx-auto mt-3 max-w-sm text-xs text-ink-soft">{note}</p>}
    </div>
  )
}
