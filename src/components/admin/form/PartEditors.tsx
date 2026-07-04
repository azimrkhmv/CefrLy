import type { Explanation } from '../../../types/test'
import type {
  GapItemDraft,
  McqItemDraft,
  Part4ItemDraft,
  Part5ItemDraft,
  TestDraft,
  TfngItemDraft,
} from '../../../lib/testDraft'
import { emptyGap, emptyMcq, emptyTfng } from '../../../lib/testDraft'
import {
  ExplanationEditor,
  QuestionCard,
  SectionCard,
  SelectField,
  TextAreaField,
  TextField,
} from './fields'

// Every editor mutates a copy of its slice and hands the whole slice back up.

function replaceAt<T>(list: T[], index: number, next: T): T[] {
  return list.map((item, i) => (i === index ? next : item))
}

// ---------------------------------------------------------------------------
// Part 1 — cloze_from_text
// ---------------------------------------------------------------------------
export function Part1Editor({
  value,
  onChange,
  startNumber,
}: {
  value: TestDraft['part1']
  onChange: (next: TestDraft['part1']) => void
  startNumber: number
}) {
  const markers = value.items.map((i) => `{{${i.id}}}`).join(' … ')
  return (
    <SectionCard
      title="Part 1 — Cloze (questions 1–6)"
      subtitle={`Write the passage and put a marker where each gap belongs: ${markers}`}
    >
      <TextAreaField label="Instructions" rows={2} value={value.instructions} onChange={(instructions) => onChange({ ...value, instructions })} />
      <TextField label="Passage title (optional)" value={value.passageTitle} onChange={(passageTitle) => onChange({ ...value, passageTitle })} />
      <TextAreaField
        label="Passage text"
        rows={8}
        value={value.passageHtml}
        onChange={(passageHtml) => onChange({ ...value, passageHtml })}
        hint="Wrap paragraphs in <p>…</p>. Example: <p>Tea was discovered {{q1}} years ago.</p>"
      />
      {value.items.map((item, index) => (
        <QuestionCard key={item.id} number={startNumber + index} itemId={item.id}>
          <GapFields item={item} onChange={(next) => onChange({ ...value, items: replaceAt(value.items, index, next) })} />
        </QuestionCard>
      ))}
    </SectionCard>
  )
}

function GapFields({ item, onChange }: { item: GapItemDraft; onChange: (next: GapItemDraft) => void }) {
  return (
    <>
      <TextField
        label="Accepted answer(s)"
        value={item.answers}
        onChange={(answers) => onChange({ ...item, answers })}
        hint="Separate alternatives with commas, e.g.: colour, color"
      />
      <ExplanationEditor value={item.explanation} onChange={(explanation) => onChange({ ...item, explanation })} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Part 2 — match_texts
// ---------------------------------------------------------------------------
export function Part2Editor({
  value,
  onChange,
  startNumber,
}: {
  value: TestDraft['part2']
  onChange: (next: TestDraft['part2']) => void
  startNumber: number
}) {
  return (
    <SectionCard
      title="Part 2 — Match texts to statements (questions 7–14)"
      subtitle="10 statements A–J; 8 texts. Two statements stay unused."
    >
      <TextAreaField label="Instructions" rows={2} value={value.instructions} onChange={(instructions) => onChange({ ...value, instructions })} />
      <div className="grid gap-2 sm:grid-cols-2">
        {value.optionPool.map((option, index) => (
          <TextField
            key={option.key}
            label={`Statement ${option.key}`}
            value={option.label}
            onChange={(label) =>
              onChange({ ...value, optionPool: replaceAt(value.optionPool, index, { ...option, label }) })
            }
          />
        ))}
      </div>
      {value.items.map((item, index) => (
        <QuestionCard key={item.id} number={startNumber + index} itemId={item.id}>
          <TextAreaField
            label="Text (what this person/passage says)"
            rows={3}
            value={item.prompt}
            onChange={(prompt) => onChange({ ...value, items: replaceAt(value.items, index, { ...item, prompt }) })}
          />
          <SelectField
            label="Correct statement"
            value={item.answer}
            onChange={(answer) =>
              onChange({ ...value, items: replaceAt(value.items, index, { ...item, answer }) })
            }
            options={value.optionPool.map((o) => ({ value: o.key, label: `${o.key}. ${o.label || '(empty)'}` }))}
          />
          <ExplanationEditor
            value={item.explanation}
            onChange={(explanation) =>
              onChange({ ...value, items: replaceAt(value.items, index, { ...item, explanation }) })
            }
          />
        </QuestionCard>
      ))}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Part 3 — match_headings
// ---------------------------------------------------------------------------
export function Part3Editor({
  value,
  onChange,
  startNumber,
}: {
  value: TestDraft['part3']
  onChange: (next: TestDraft['part3']) => void
  startNumber: number
}) {
  const canAddHeading = value.optionPool.length < 9
  const canRemoveHeading = value.optionPool.length > 8

  return (
    <SectionCard
      title="Part 3 — Match headings to paragraphs (questions 15–20)"
      subtitle="6 paragraphs I–VI; 8 or 9 headings. Extra headings stay unused."
    >
      <TextAreaField label="Instructions" rows={2} value={value.instructions} onChange={(instructions) => onChange({ ...value, instructions })} />
      <TextField label="Passage title (optional)" value={value.passageTitle} onChange={(passageTitle) => onChange({ ...value, passageTitle })} />

      <div className="grid gap-2 sm:grid-cols-2">
        {value.optionPool.map((option, index) => (
          <TextField
            key={option.key}
            label={`Heading ${option.key}`}
            value={option.label}
            onChange={(label) =>
              onChange({ ...value, optionPool: replaceAt(value.optionPool, index, { ...option, label }) })
            }
          />
        ))}
      </div>
      <div className="flex gap-2">
        {canAddHeading && (
          <button
            type="button"
            onClick={() => onChange({ ...value, optionPool: [...value.optionPool, { key: 'I', label: '' }] })}
            className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Add 9th heading
          </button>
        )}
        {canRemoveHeading && (
          <button
            type="button"
            onClick={() => onChange({ ...value, optionPool: value.optionPool.slice(0, 8) })}
            className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Remove 9th heading
          </button>
        )}
      </div>

      {value.paragraphs.map((paragraph, index) => {
        const item = value.items[index]
        return (
          <QuestionCard key={paragraph.label} number={startNumber + index} itemId={item?.id ?? ''}>
            <TextAreaField
              label={`Paragraph ${paragraph.label}`}
              rows={4}
              value={paragraph.html}
              onChange={(html) =>
                onChange({ ...value, paragraphs: replaceAt(value.paragraphs, index, { ...paragraph, html }) })
              }
              hint="Wrap in <p>…</p>"
            />
            {item && (
              <>
                <SelectField
                  label="Correct heading"
                  value={item.answer}
                  onChange={(answer) =>
                    onChange({ ...value, items: replaceAt(value.items, index, { ...item, answer }) })
                  }
                  options={value.optionPool.map((o) => ({ value: o.key, label: `${o.key}. ${o.label || '(empty)'}` }))}
                />
                <ExplanationEditor
                  value={item.explanation}
                  onChange={(explanation) =>
                    onChange({ ...value, items: replaceAt(value.items, index, { ...item, explanation }) })
                  }
                />
              </>
            )}
          </QuestionCard>
        )
      })}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Parts 4 & 5 — passage_questions (mixed item types)
// ---------------------------------------------------------------------------
function McqFields({ item, onChange }: { item: McqItemDraft; onChange: (next: McqItemDraft) => void }) {
  return (
    <>
      <TextAreaField label="Question" rows={2} value={item.prompt} onChange={(prompt) => onChange({ ...item, prompt })} />
      <div className="grid gap-2 sm:grid-cols-2">
        {item.options.map((option, index) => (
          <TextField
            key={option.key}
            label={`Option ${option.key}`}
            value={option.label}
            onChange={(label) =>
              onChange({ ...item, options: replaceAt(item.options, index, { ...option, label }) })
            }
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

function TfngFields({ item, onChange }: { item: TfngItemDraft; onChange: (next: TfngItemDraft) => void }) {
  return (
    <>
      <TextAreaField label="Statement" rows={2} value={item.prompt} onChange={(prompt) => onChange({ ...item, prompt })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Correct answer"
          value={item.answer}
          onChange={(answer) => onChange({ ...item, answer: answer as TfngItemDraft['answer'] })}
          options={[
            { value: 'true', label: 'True' },
            { value: 'false', label: 'False' },
            { value: 'not_given', label: item.thirdOptionLabel },
          ]}
        />
        <SelectField
          label="Third option label"
          value={item.thirdOptionLabel}
          onChange={(v) => onChange({ ...item, thirdOptionLabel: v as TfngItemDraft['thirdOptionLabel'] })}
          options={[
            { value: 'Not Given', label: 'Not Given' },
            { value: 'No Information', label: 'No Information' },
          ]}
        />
      </div>
      <ExplanationEditor value={item.explanation} onChange={(explanation) => onChange({ ...item, explanation })} />
    </>
  )
}

function GapSummaryFields({ item, onChange }: { item: GapItemDraft; onChange: (next: GapItemDraft) => void }) {
  return (
    <>
      <p className="text-xs text-ink-soft">
        Put the marker <code className="font-mono">{`{{${item.id}}}`}</code> in the summary inside the passage text.
      </p>
      <GapFields item={item} onChange={onChange} />
    </>
  )
}

function TypeSwitch({
  current,
  choices,
  onSwitch,
}: {
  current: string
  choices: { value: string; label: string }[]
  onSwitch: (type: string) => void
}) {
  return (
    <select
      value={current}
      onChange={(e) => onSwitch(e.target.value)}
      className="rounded-xl border border-line bg-white px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft"
      aria-label="Question type"
    >
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  )
}

function convertItem(
  item: { id: string; explanation: Explanation },
  type: string,
): Part4ItemDraft | Part5ItemDraft {
  const base =
    type === 'mcq' ? emptyMcq(item.id) : type === 'tfng' ? emptyTfng(item.id) : emptyGap(item.id)
  const prompt = 'prompt' in item ? (item as { prompt?: string }).prompt ?? '' : ''
  if ('prompt' in base) (base as { prompt: string }).prompt = prompt
  base.explanation = item.explanation
  return base
}

interface PassagePartValue<I> {
  instructions: string
  passageTitle: string
  passageHtml: string
  items: I[]
}

export function PassagePartEditor<I extends Part4ItemDraft | Part5ItemDraft>({
  title,
  subtitle,
  value,
  onChange,
  startNumber,
  typeChoices,
}: {
  title: string
  subtitle: string
  value: PassagePartValue<I>
  onChange: (next: PassagePartValue<I>) => void
  startNumber: number
  typeChoices: { value: string; label: string }[]
}) {
  const update = (index: number, next: Part4ItemDraft | Part5ItemDraft) =>
    onChange({ ...value, items: replaceAt(value.items, index, next as I) })

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <TextAreaField
        label="Instructions"
        rows={2}
        value={value.instructions}
        onChange={(instructions) => onChange({ ...value, instructions })}
      />
      <TextField
        label="Passage title (optional)"
        value={value.passageTitle}
        onChange={(passageTitle) => onChange({ ...value, passageTitle })}
      />
      <TextAreaField
        label="Passage text"
        rows={10}
        value={value.passageHtml}
        onChange={(passageHtml) => onChange({ ...value, passageHtml })}
        hint="Wrap paragraphs in <p>…</p>. For summary gaps, include the markers, e.g. {{q30}}."
      />
      {value.items.map((item, index) => (
        <QuestionCard
          key={item.id}
          number={startNumber + index}
          itemId={item.id}
          right={
            <TypeSwitch
              current={item.type}
              choices={typeChoices}
              onSwitch={(type) => update(index, convertItem(item, type))}
            />
          }
        >
          {item.type === 'mcq' && <McqFields item={item} onChange={(next) => update(index, next)} />}
          {item.type === 'tfng' && <TfngFields item={item} onChange={(next) => update(index, next)} />}
          {item.type === 'gap' && (
            <GapSummaryFields item={item} onChange={(next) => update(index, next)} />
          )}
        </QuestionCard>
      ))}
    </SectionCard>
  )
}
