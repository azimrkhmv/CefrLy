import { useEffect, useRef, useState } from 'react'
import type { WritingTaskType, WritingTest } from '../../types/test'
import { TASK_EXAMPLE, TASK_LABEL } from '../../lib/writingFixtures'
import { addCustomQuestion } from '../../lib/writingCustom'
import { CloseIcon, PlusIcon } from '../icons'

const TASK_ORDER: WritingTaskType[] = ['task_1_1', 'task_1_2', 'part_2']

/** Read a chosen image file as a data URL so it survives a reload (an object URL
 *  would die when the page refreshes). Best-effort — failure just drops the image. */
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

/** Mounted only while open (parent conditionally renders it), so every open
 *  starts from a fresh form seeded with the tab's task type. */
export function AddCustomModal({
  initialTaskType,
  onClose,
  onCreated,
}: {
  initialTaskType: WritingTaskType
  onClose: () => void
  onCreated: (test: WritingTest) => void
}) {
  const [taskType, setTaskType] = useState<WritingTaskType>(initialTaskType)
  const [question, setQuestion] = useState('')
  const [title, setTitle] = useState('')
  const [imageSrc, setImageSrc] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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
      taskType,
      title: title.trim(),
      question: question.trim(),
      imageSrc,
    })
    onCreated(test)
    onClose()
  }

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    try {
      setImageSrc(await readImage(file))
    } catch {
      setError('That image could not be read. Try another file.')
    }
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
          <Field label="Writing task type">
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as WritingTaskType)}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              {TASK_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TASK_LABEL[t]}
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
              placeholder={TASK_EXAMPLE[taskType]}
              className="w-full resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </Field>

          <Field label="Add visual" hint="optional">
            {imageSrc ? (
              <div className="flex items-center gap-3">
                <img
                  src={imageSrc}
                  alt="Prompt preview"
                  className="h-16 w-16 rounded-lg border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageSrc(undefined)}
                  className="text-sm font-bold text-brand hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-white px-3.5 py-3 text-sm font-bold text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                <PlusIcon width={15} height={15} />
                Upload an image
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
          </Field>

          <Field label="Question title">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setError(null)
              }}
              placeholder="Example: A new library"
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
