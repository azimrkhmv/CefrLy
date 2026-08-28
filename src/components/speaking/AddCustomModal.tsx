import { useEffect, useState } from 'react'
import type { SpeakingPartType, SpeakingTest } from '../../types/test'
import { PART_EXAMPLE, PART_LABEL } from '../../lib/speakingFixtures'
import { addCustomQuestion } from '../../lib/speakingCustom'
import { CloseIcon } from '../icons'

const PART_ORDER: SpeakingPartType[] = ['part_1_1', 'part_1_2', 'part_2', 'part_3']

/** Mounted only while open (parent conditionally renders it), so every open
 *  starts from a fresh form seeded with the tab's part type. */
export function AddCustomModal({
  initialPartType,
  onClose,
  onCreated,
}: {
  initialPartType: SpeakingPartType
  onClose: () => void
  onCreated: (test: SpeakingTest) => void
}) {
  const [partType, setPartType] = useState<SpeakingPartType>(initialPartType)
  const [question, setQuestion] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    if (!title.trim() || !question.trim()) {
      setError('Add a question and a title to save it.')
      return
    }
    const test = addCustomQuestion({
      partType,
      title: title.trim(),
      question: question.trim(),
    })
    onCreated(test)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-heading/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a custom question"
        className="bubble-pop relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-pop sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1 text-ink-faint transition-colors hover:bg-page hover:text-ink"
        >
          <CloseIcon width={18} height={18} />
        </button>

        <h2 className="text-center text-lg font-extrabold text-heading">Add a custom question</h2>

        <div className="mt-5 space-y-4">
          <Field label="Speaking part">
            <select
              value={partType}
              onChange={(e) => setPartType(e.target.value as SpeakingPartType)}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              {PART_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PART_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Question">
            <textarea
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value)
                setError(null)
              }}
              rows={5}
              placeholder={PART_EXAMPLE[partType]}
              className="w-full resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </Field>

          <Field label="Question title">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setError(null)
              }}
              placeholder="Example: Your home town"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </Field>

          {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
        </div>

        <button
          type="button"
          onClick={submit}
          className="mt-6 w-full rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          Add question
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-ink">
        {label}
        {hint && <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
