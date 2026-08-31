import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

// ---------------------------------------------------------------------------
// "This one is for paid plans." Shown when a Free student opens a Writing or
// Speaking paper.
//
// It appears at the START, not at the end. A student who speaks for ten minutes
// and only then learns there is no score has been wasted, and it reads as a
// trick — so the catalog stays fully browsable and the wall lands on the first
// click instead.
//
// Cefrly's own dialog with the startled cat, never window.confirm — same rule
// as ConfirmDialog on every other student surface.
//
// RENDERED THROUGH A PORTAL, and it must stay that way. The app shell wraps
// routes in <main class="page-enter">, which animates a transform — and a
// transformed ancestor becomes the containing block for `position: fixed`
// descendants. Left inside the tree, this dialog anchors itself to <main>
// instead of the viewport and slides off the top as the catalog scrolls.
// ---------------------------------------------------------------------------

export function PaidSkillDialog({
  open,
  skill,
  onClose,
}: {
  open: boolean
  skill: 'Writing' | 'Speaking'
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-heading/40 px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paid-skill-title"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-card sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src="/cat-surprised.png"
          alt=""
          width={150}
          height={150}
          className="mx-auto h-[150px] w-auto object-contain"
        />
        <h2 id="paid-skill-title" className="mt-2 text-xl font-extrabold text-heading">
          {skill} is for paid plans
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          {skill} answers are checked by AI — you get a CEFR band, your transcript, every mistake
          and a stronger version of your answer. That is part of Pro and Premium.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Reading and Listening stay free, with unlimited practice.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            to="/pricing"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
          >
            See plans
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
