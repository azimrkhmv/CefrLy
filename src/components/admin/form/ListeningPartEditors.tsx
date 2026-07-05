import { useState } from 'react'
import type { GapItemDraft, MatchItemDraft, McqItemDraft, OptionDraft } from '../../../lib/testDraft'
import type { AudioDraft, GroupDraft, ImageDraft, ListeningDraft } from '../../../lib/listeningDraft'
import { audioUrl, imageUrl, uploadMedia } from '../../../lib/storage'
import { ExplanationEditor, QuestionCard, SectionCard, SelectField, TextAreaField, TextField } from './fields'

function replaceAt<T>(list: T[], index: number, next: T): T[] {
  return list.map((item, i) => (i === index ? next : item))
}

// ── Media upload widgets (admin-only writes; RLS blocks students) ────────────
function NumberField({
  label,
  value,
  onChange,
  width = 'w-16',
}: {
  label: string
  value: number
  onChange: (n: number) => void
  width?: string
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
        className={`tnum ${width} rounded-lg border border-line bg-white px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft`}
      />
    </label>
  )
}

export function AudioUploadField({
  value,
  onChange,
  slug,
  pathKey,
  label,
}: {
  value: AudioDraft
  onChange: (next: AudioDraft) => void
  slug: string
  pathKey: string
  label: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!slug) {
      setError('Set the slug at the top of the form before uploading media.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3'
      const path = `${slug}/${pathKey}.${ext}`
      await uploadMedia('audio', path, file)
      onChange({ ...value, assetPath: path })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-page p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{label}</span>
        {value.assetPath ? (
          <span className="text-xs font-bold text-ok">uploaded ✓</span>
        ) : (
          <span className="text-xs font-bold text-amber-700">no file yet</span>
        )}
      </div>
      {value.assetPath && (
        <audio controls src={audioUrl(value.assetPath)} className="w-full">
          <track kind="captions" />
        </audio>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-ink-faint">
          {value.assetPath ? 'Replace audio' : 'Upload audio'}
          <input type="file" accept="audio/*" className="hidden" onChange={onFile} disabled={uploading} />
        </label>
        {uploading && <span className="text-xs text-ink-soft">Uploading…</span>}
        <NumberField label="Plays" value={value.playLimit} onChange={(playLimit) => onChange({ ...value, playLimit })} />
        <NumberField label="Preview (s)" value={value.previewSec} onChange={(previewSec) => onChange({ ...value, previewSec })} width="w-20" />
      </div>
      {value.assetPath && <p className="tnum break-all text-[11px] text-ink-faint">{value.assetPath}</p>}
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  )
}

export function ImageUploadField({
  value,
  onChange,
  slug,
}: {
  value: ImageDraft
  onChange: (next: ImageDraft) => void
  slug: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!slug) {
      setError('Set the slug at the top of the form before uploading media.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${slug}/map.${ext}`
      await uploadMedia('images', path, file)
      onChange({ ...value, assetPath: path })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-page p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">Map / plan image</span>
        {value.assetPath ? (
          <span className="text-xs font-bold text-ok">uploaded ✓</span>
        ) : (
          <span className="text-xs font-bold text-amber-700">required</span>
        )}
      </div>
      {value.assetPath && (
        <img src={imageUrl(value.assetPath)} alt={value.alt || 'map preview'} className="max-h-64 w-full rounded-lg border border-line bg-white object-contain" />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-ink-faint">
          {value.assetPath ? 'Replace image' : 'Upload image'}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
        </label>
        {uploading && <span className="text-xs text-ink-soft">Uploading…</span>}
      </div>
      <TextField
        label="Image description (alt text)"
        value={value.alt}
        onChange={(alt) => onChange({ ...value, alt })}
        placeholder="Describe the plan for screen-reader users."
      />
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  )
}

// ── Shared item field groups ─────────────────────────────────────────────────
function McqOptionsFields({
  item,
  onChange,
  showPrompt,
}: {
  item: McqItemDraft
  onChange: (next: McqItemDraft) => void
  showPrompt: boolean
}) {
  return (
    <>
      {showPrompt && (
        <TextAreaField label="Question" rows={2} value={item.prompt} onChange={(prompt) => onChange({ ...item, prompt })} />
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {item.options.map((option, index) => (
          <TextField
            key={option.key}
            label={`Option ${option.key}`}
            value={option.label}
            onChange={(label) => onChange({ ...item, options: replaceAt(item.options, index, { ...option, label }) })}
          />
        ))}
      </div>
      <SelectField
        label="Correct option"
        value={item.answer}
        onChange={(answer) => onChange({ ...item, answer })}
        options={item.options.map((o) => ({ value: o.key, label: `${o.key}. ${o.label || '(empty)'}` }))}
      />
      <ExplanationEditor value={item.explanation} onChange={(explanation) => onChange({ ...item, explanation })} />
    </>
  )
}

function GapFields({
  item,
  onChange,
  markerHint,
}: {
  item: GapItemDraft
  onChange: (next: GapItemDraft) => void
  markerHint?: boolean
}) {
  return (
    <>
      {markerHint && (
        <p className="text-xs text-ink-soft">
          Put the marker <code className="font-mono">{`{{${item.id}}}`}</code> in the notes text above.
        </p>
      )}
      <TextField
        label="Accepted answer(s)"
        value={item.answers}
        onChange={(answers) => onChange({ ...item, answers })}
        hint="Separate accepted spellings with commas, e.g.: 6.30, half past six, 18.30"
      />
      <ExplanationEditor value={item.explanation} onChange={(explanation) => onChange({ ...item, explanation })} />
    </>
  )
}

function MatchFields({
  item,
  onChange,
  pool,
  promptLabel,
}: {
  item: MatchItemDraft
  onChange: (next: MatchItemDraft) => void
  pool: OptionDraft[]
  promptLabel: string
}) {
  return (
    <>
      <TextField label={promptLabel} value={item.prompt} onChange={(prompt) => onChange({ ...item, prompt })} />
      <SelectField
        label="Correct answer"
        value={item.answer}
        onChange={(answer) => onChange({ ...item, answer })}
        options={pool.map((o) => ({ value: o.key, label: o.label && o.label !== o.key ? `${o.key}. ${o.label}` : o.key }))}
      />
      <ExplanationEditor value={item.explanation} onChange={(explanation) => onChange({ ...item, explanation })} />
    </>
  )
}

// audioMode='single' hides the per-part audio slots (one player governs all).
function PartAudio({
  audioMode,
  value,
  onChange,
  slug,
  pathKey,
}: {
  audioMode: 'per_part' | 'single'
  value: AudioDraft
  onChange: (next: AudioDraft) => void
  slug: string
  pathKey: string
}) {
  if (audioMode !== 'per_part') return null
  return <AudioUploadField value={value} onChange={onChange} slug={slug} pathKey={pathKey} label="Part recording" />
}

// ── The six part editors ─────────────────────────────────────────────────────
export function LPart1Editor({
  value,
  onChange,
  slug,
  audioMode,
}: {
  value: ListeningDraft['part1']
  onChange: (next: ListeningDraft['part1']) => void
  slug: string
  audioMode: 'per_part' | 'single'
}) {
  return (
    <SectionCard title="Part 1 — Choose the best reply (1–8)" subtitle="8 short recordings; each has 3 options (A/B/C) and no written prompt.">
      <PartAudio audioMode={audioMode} value={value.audio} onChange={(audio) => onChange({ ...value, audio })} slug={slug} pathKey="part1" />
      <TextAreaField label="Instructions" rows={2} value={value.instructions} onChange={(instructions) => onChange({ ...value, instructions })} />
      {value.items.map((item, index) => (
        <QuestionCard key={item.id} number={1 + index} itemId={item.id}>
          <McqOptionsFields item={item} showPrompt={false} onChange={(next) => onChange({ ...value, items: replaceAt(value.items, index, next) })} />
        </QuestionCard>
      ))}
    </SectionCard>
  )
}

export function LStemPartEditor({
  title,
  subtitle,
  value,
  onChange,
  slug,
  audioMode,
  startNumber,
  pathKey,
}: {
  title: string
  subtitle: string
  value: ListeningDraft['part2']
  onChange: (next: ListeningDraft['part2']) => void
  slug: string
  audioMode: 'per_part' | 'single'
  startNumber: number
  pathKey: string
}) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <PartAudio audioMode={audioMode} value={value.audio} onChange={(audio) => onChange({ ...value, audio })} slug={slug} pathKey={pathKey} />
      <TextAreaField label="Instructions" rows={2} value={value.instructions} onChange={(instructions) => onChange({ ...value, instructions })} />
      <TextField label="Form/notes title (optional)" value={value.stemTitle} onChange={(stemTitle) => onChange({ ...value, stemTitle })} />
      <TextAreaField
        label="Form / notes text"
        rows={8}
        value={value.stemHtml}
        onChange={(stemHtml) => onChange({ ...value, stemHtml })}
        hint={`Wrap lines in <p>…</p> and put a marker where each blank belongs: ${value.items.map((i) => `{{${i.id}}}`).join(' … ')}`}
      />
      {value.items.map((item, index) => (
        <QuestionCard key={item.id} number={startNumber + index} itemId={item.id}>
          <GapFields item={item} markerHint onChange={(next) => onChange({ ...value, items: replaceAt(value.items, index, next) })} />
        </QuestionCard>
      ))}
    </SectionCard>
  )
}

export function LPart3Editor({
  value,
  onChange,
  slug,
  audioMode,
}: {
  value: ListeningDraft['part3']
  onChange: (next: ListeningDraft['part3']) => void
  slug: string
  audioMode: 'per_part' | 'single'
}) {
  return (
    <SectionCard title="Part 3 — Match the speakers (15–18)" subtitle="4 speakers; 8 options A–H (extras stay unused).">
      <PartAudio audioMode={audioMode} value={value.audio} onChange={(audio) => onChange({ ...value, audio })} slug={slug} pathKey="part3" />
      <TextAreaField label="Instructions" rows={2} value={value.instructions} onChange={(instructions) => onChange({ ...value, instructions })} />
      <div className="grid gap-2 sm:grid-cols-2">
        {value.optionPool.map((option, index) => (
          <TextField
            key={option.key}
            label={`Option ${option.key}`}
            value={option.label}
            onChange={(label) => onChange({ ...value, optionPool: replaceAt(value.optionPool, index, { ...option, label }) })}
          />
        ))}
      </div>
      {value.items.map((item, index) => (
        <QuestionCard key={item.id} number={15 + index} itemId={item.id}>
          <MatchFields item={item} pool={value.optionPool} promptLabel="Speaker label" onChange={(next) => onChange({ ...value, items: replaceAt(value.items, index, next) })} />
        </QuestionCard>
      ))}
    </SectionCard>
  )
}

export function LPart4Editor({
  value,
  onChange,
  slug,
  audioMode,
}: {
  value: ListeningDraft['part4']
  onChange: (next: ListeningDraft['part4']) => void
  slug: string
  audioMode: 'per_part' | 'single'
}) {
  return (
    <SectionCard title="Part 4 — Label the map (19–23)" subtitle="5 places labelled with letters A–H on the plan (extras stay unused).">
      <PartAudio audioMode={audioMode} value={value.audio} onChange={(audio) => onChange({ ...value, audio })} slug={slug} pathKey="part4" />
      <TextAreaField label="Instructions" rows={2} value={value.instructions} onChange={(instructions) => onChange({ ...value, instructions })} />
      <ImageUploadField value={value.image} onChange={(image) => onChange({ ...value, image })} slug={slug} />
      <p className="text-xs text-ink-soft">
        Places are matched to the letters {value.optionPool.map((o) => o.key).join(', ')} shown on the map.
      </p>
      {value.items.map((item, index) => (
        <QuestionCard key={item.id} number={19 + index} itemId={item.id}>
          <MatchFields item={item} pool={value.optionPool} promptLabel="Place name" onChange={(next) => onChange({ ...value, items: replaceAt(value.items, index, next) })} />
        </QuestionCard>
      ))}
    </SectionCard>
  )
}

export function LPart5Editor({
  value,
  onChange,
  slug,
  audioMode,
}: {
  value: ListeningDraft['part5']
  onChange: (next: ListeningDraft['part5']) => void
  slug: string
  audioMode: 'per_part' | 'single'
}) {
  const updateGroup = (gi: number, next: GroupDraft) =>
    onChange({ ...value, groups: replaceAt(value.groups, gi, next) })

  return (
    <SectionCard title="Part 5 — Three extracts (24–29)" subtitle="3 extracts; each has a context line and 2 MCQs (3 options).">
      <PartAudio audioMode={audioMode} value={value.audio} onChange={(audio) => onChange({ ...value, audio })} slug={slug} pathKey="part5" />
      <TextAreaField label="Instructions" rows={2} value={value.instructions} onChange={(instructions) => onChange({ ...value, instructions })} />
      {value.groups.map((group, gi) => (
        <div key={gi} className="rounded-2xl border border-line bg-page/50 p-4">
          <p className="mb-3 text-sm font-extrabold text-heading">Extract {gi + 1}</p>
          <TextAreaField
            label="Context line (what the student will hear)"
            rows={2}
            value={group.context}
            onChange={(context) => updateGroup(gi, { ...group, context })}
          />
          <div className="mt-3 space-y-3">
            {group.items.map((item, ii) => (
              <QuestionCard key={item.id} number={24 + gi * 2 + ii} itemId={item.id}>
                <McqOptionsFields
                  item={item}
                  showPrompt
                  onChange={(next) => updateGroup(gi, { ...group, items: replaceAt(group.items, ii, next) })}
                />
              </QuestionCard>
            ))}
          </div>
        </div>
      ))}
    </SectionCard>
  )
}
