import { useState } from 'react'
import { imageUrl, uploadMedia } from '../../../lib/storage'
import type { SampleImage, SpeakingTurn, VocabItem } from '../../../types/sample'

// Small, self-contained editors for the repeating parts of a sample: ordered
// string lists (task / why / writing paragraphs), speaking dialogue turns, the
// vocabulary glossary, and prompt images (with upload to the `images` bucket).

const field =
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft'
const ctrl =
  'rounded-lg border border-line px-2 py-1 text-xs font-bold text-ink-soft transition-colors hover:border-ink-faint disabled:opacity-30'
const ctrlDanger =
  'rounded-lg border border-line px-2 py-1 text-xs font-bold text-rose-600 transition-colors hover:border-rose-300'

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
const removeAt = <T,>(list: T[], i: number): T[] => list.filter((_, k) => k !== i)
const replaceAt = <T,>(list: T[], i: number, v: T): T[] => list.map((x, k) => (k === i ? v : x))

function RowControls({
  i,
  n,
  onUp,
  onDown,
  onRemove,
}: {
  i: number
  n: number
  onUp: () => void
  onDown: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 pt-1">
      <button type="button" onClick={onUp} disabled={i === 0} className={ctrl} aria-label="Move up">
        ↑
      </button>
      <button type="button" onClick={onDown} disabled={i === n - 1} className={ctrl} aria-label="Move down">
        ↓
      </button>
      <button type="button" onClick={onRemove} className={ctrlDanger} aria-label="Remove">
        ✕
      </button>
    </div>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 rounded-xl border border-dashed border-line px-3 py-1.5 text-xs font-bold text-brand transition-colors hover:border-brand/40"
    >
      {children}
    </button>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^\d-]/g, '')) || 0)}
        className={`${field} tnum`}
      />
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  )
}

export function StringListEditor({
  items,
  onChange,
  multiline,
  placeholder,
  addLabel,
}: {
  items: string[]
  onChange: (v: string[]) => void
  multiline?: boolean
  placeholder?: string
  addLabel?: string
}) {
  return (
    <div className="space-y-2">
      {items.map((val, i) => (
        <div key={i} className="flex items-start gap-2">
          {multiline ? (
            <textarea
              value={val}
              rows={2}
              onChange={(e) => onChange(replaceAt(items, i, e.target.value))}
              placeholder={placeholder}
              className={field}
            />
          ) : (
            <input
              type="text"
              value={val}
              onChange={(e) => onChange(replaceAt(items, i, e.target.value))}
              placeholder={placeholder}
              className={field}
            />
          )}
          <RowControls
            i={i}
            n={items.length}
            onUp={() => onChange(move(items, i, -1))}
            onDown={() => onChange(move(items, i, 1))}
            onRemove={() => onChange(removeAt(items, i))}
          />
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, ''])}>{addLabel ?? '+ Add line'}</AddButton>
    </div>
  )
}

export function TurnListEditor({
  items,
  onChange,
}: {
  items: SpeakingTurn[]
  onChange: (v: SpeakingTurn[]) => void
}) {
  return (
    <div className="space-y-2">
      {items.map((t, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 space-y-1.5">
            <input
              list="sample-speaker-suggestions"
              value={t.speaker}
              onChange={(e) => onChange(replaceAt(items, i, { ...t, speaker: e.target.value }))}
              placeholder="Speaker (Examiner / Student)"
              className={`${field} sm:max-w-[240px]`}
            />
            <textarea
              value={t.text}
              rows={2}
              onChange={(e) => onChange(replaceAt(items, i, { ...t, text: e.target.value }))}
              placeholder="What they say…"
              className={field}
            />
          </div>
          <RowControls
            i={i}
            n={items.length}
            onUp={() => onChange(move(items, i, -1))}
            onDown={() => onChange(move(items, i, 1))}
            onRemove={() => onChange(removeAt(items, i))}
          />
        </div>
      ))}
      <datalist id="sample-speaker-suggestions">
        <option value="Student" />
        <option value="Examiner" />
      </datalist>
      <AddButton onClick={() => onChange([...items, { speaker: 'Student', text: '' }])}>+ Add turn</AddButton>
    </div>
  )
}

export function VocabEditor({
  items,
  onChange,
}: {
  items: VocabItem[]
  onChange: (v: VocabItem[]) => void
}) {
  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
          <input
            value={v.term}
            onChange={(e) => onChange(replaceAt(items, i, { ...v, term: e.target.value }))}
            placeholder="term"
            className={field}
          />
          <input
            value={v.meaning}
            onChange={(e) => onChange(replaceAt(items, i, { ...v, meaning: e.target.value }))}
            placeholder="meaning (English)"
            className={field}
          />
          <input
            value={v.uz ?? ''}
            onChange={(e) => onChange(replaceAt(items, i, { ...v, uz: e.target.value }))}
            placeholder="Uzbek (optional)"
            className={field}
          />
          <button
            type="button"
            onClick={() => onChange(removeAt(items, i))}
            className={ctrlDanger}
            aria-label="Remove word"
          >
            ✕
          </button>
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, { term: '', meaning: '', uz: '' }])}>+ Add word</AddButton>
    </div>
  )
}

export function ImagesEditor({
  slug,
  items,
  onChange,
}: {
  slug: string
  items: SampleImage[]
  onChange: (v: SampleImage[]) => void
}) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload(i: number, file: File) {
    if (!slug) {
      setError('Set a slug first, then upload the image.')
      return
    }
    setError(null)
    setUploadingIdx(i)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const base =
        file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'image'
      const path = `samples/${slug}/${base}-${i + 1}.${ext}`
      await uploadMedia('images', path, file)
      onChange(replaceAt(items, i, { ...items[i], assetPath: path }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploadingIdx(null)
    }
  }

  return (
    <div className="space-y-3">
      {items.map((img, i) => (
        <div key={i} className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-ink-soft">Image {i + 1}</span>
            <button type="button" onClick={() => onChange(removeAt(items, i))} className={ctrlDanger}>
              Remove
            </button>
          </div>
          {img.assetPath && (
            <img
              src={imageUrl(img.assetPath)}
              alt={img.alt || 'preview'}
              className="mt-2 max-h-56 w-full rounded-lg border border-line bg-page object-contain"
            />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-ink-faint">
              {img.assetPath ? 'Replace image' : 'Upload image'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingIdx === i}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) upload(i, f)
                }}
              />
            </label>
            {uploadingIdx === i && <span className="text-xs text-ink-soft">Uploading…</span>}
            {img.assetPath && <span className="tnum text-[11px] text-ink-faint">{img.assetPath}</span>}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              value={img.alt}
              onChange={(e) => onChange(replaceAt(items, i, { ...img, alt: e.target.value }))}
              placeholder="Alt text (describe the photo)"
              className={field}
            />
            <input
              value={img.caption ?? ''}
              onChange={(e) => onChange(replaceAt(items, i, { ...img, caption: e.target.value }))}
              placeholder="Caption, e.g. “Photo A” (optional)"
              className={field}
            />
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <AddButton onClick={() => onChange([...items, { assetPath: '', alt: '', caption: '' }])}>+ Add image</AddButton>
    </div>
  )
}
