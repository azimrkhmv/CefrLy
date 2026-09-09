import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Cefrly's own confirmation dialog — replaces window.confirm() so the alert
// speaks with the mascot's voice: the startled wide-eyed cat raises the alarm
// while the copy stays calm. Self-contained fixed overlay, so it works inside
// the full-screen exam portal too. Escape or the backdrop cancel; the safe
// action gets the initial focus.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'brand',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  /** Omit for a single-button notice — the dialog then shows only cancelLabel,
   *  styled as the primary action. */
  confirmLabel?: string
  cancelLabel: string
  /** Confirm-button color: brand for ordinary commits, rose for leaving/destructive. */
  tone?: 'brand' | 'rose'
  onConfirm?: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  // Portalled to <body>: an ancestor with a transform (a page/card entrance
  // animation, say) would otherwise become the containing block for
  // position:fixed and the backdrop would cover only that box, leaving the rest
  // of the screen live and undimmed.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-heading/40" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="bubble-pop relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-pop sm:p-7"
      >
        <img
          src="/cat-surprised.png"
          alt=""
          aria-hidden
          draggable={false}
          width={101}
          height={96}
          className="mx-auto block h-24 w-auto select-none"
        />
        <p className="mt-4 text-lg font-extrabold text-heading">{title}</p>
        <p className="mt-1.5 text-sm text-ink-soft">{message}</p>
        <div className="mt-6 flex justify-center gap-3">
          {confirmLabel ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                autoFocus
                className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors ${
                  tone === 'rose' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand hover:bg-brand-deep'
                }`}
              >
                {confirmLabel}
              </button>
            </>
          ) : (
            // Notice, not a choice: one button, and it is the safe one.
            <button
              type="button"
              onClick={onCancel}
              autoFocus
              className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
