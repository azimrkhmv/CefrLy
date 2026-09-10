import { useEffect, useMemo, useRef, useState } from 'react'
import { PenIcon } from '../icons'
import { readSpeakingNotes, saveSpeakingNotes } from '../../lib/speakingDraft'
import type { SpeakingStep } from '../../lib/speakingQuestions'
import { fieldsFor } from '../../lib/speakingNotes'

// ---------------------------------------------------------------------------
// The note sheet, for the two long turns.
//
// The real exam gives out paper before Part 2 and Part 3 and one minute to use
// it. Nobody argues both sides of a proposition for two minutes off the top of
// their head, and the app was asking students to do exactly that.
//
// THE FIELDS MIRROR WHAT THE MARK SCHEME COUNTS, which is the whole reason this
// is a form and not one blank box:
//   · Part 2 is scored by HOW MANY of its prompts were addressed (all three = 4
//     marks, two = 3, one = 1), so there is a line per prompt. An empty line is
//     a prompt you are about to forget.
//   · Part 3's marks turn on covering BOTH sides (4) rather than one (3), with
//     5 needing balanced argument on top — so it is For / Against side by side,
//     and a box for the view the task also asks for.
//
// Nothing here is uploaded, graded, or seen by anyone else. It is the student's
// paper. It survives a reload only so a refresh mid-attempt does not bin it.
// ---------------------------------------------------------------------------

/** Debounce, so a fast typist is not hitting localStorage on every keystroke
 *  while the microphone is live. */
const SAVE_DEBOUNCE_MS = 400

export function SpeakingNotes({ step, testId }: { step: SpeakingStep; testId: string }) {
  const fields = useMemo(() => fieldsFor(step), [step])
  const [values, setValues] = useState<Record<string, string>>({})
  const saveTimer = useRef<number | undefined>(undefined)

  // Load this question's notes when it opens — and on a reload mid-attempt.
  //
  // KEYED ON step.id ALONE, deliberately. Listing `fields` (or `step`) here
  // would re-run this whenever the parent handed down a new object identity,
  // and re-running it overwrites what is on screen with what is in storage —
  // silently binning up to SAVE_DEBOUNCE_MS of the student's typing, mid-exam,
  // for no reason they could ever see. The field list is recomputed inside
  // instead; it is derived from the same step, so it cannot disagree.
  useEffect(() => {
    const stored = readSpeakingNotes(testId)
    const mine: Record<string, string> = {}
    for (const f of fieldsFor(step) ?? []) mine[f.key] = stored[`${step.id}:${f.key}`] ?? ''
    setValues(mine)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, testId])

  useEffect(() => {
    return () => {
      if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current)
    }
  }, [])

  if (!fields) return null

  const update = (fieldKey: string, text: string) => {
    setValues((v) => ({ ...v, [fieldKey]: text }))
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      // Re-read before writing: another question's notes live in the same key,
      // and a stale copy in this component's memory would erase them.
      const all = readSpeakingNotes(testId)
      all[`${step.id}:${fieldKey}`] = text
      saveSpeakingNotes(testId, all)
    }, SAVE_DEBOUNCE_MS)
  }

  const twoUp = fields.length === 3 && fields[0].key === 'for'

  return (
    <section className="@container rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <PenIcon width={13} height={13} />
        </span>
        <h3 className="text-sm font-extrabold text-heading">Your notes</h3>
        <span className="ml-auto text-[11px] text-ink-soft">Not marked</span>
      </div>

      <div className={twoUp ? 'mt-3 grid grid-cols-1 gap-3 @md:grid-cols-2' : 'mt-3 space-y-2.5'}>
        {fields.map((field, i) => (
          <div key={field.key} className={twoUp && i === 2 ? '@md:col-span-2' : undefined}>
            <label
              htmlFor={`note-${step.id}-${field.key}`}
              className="block text-[11px] font-bold leading-snug text-ink-soft"
            >
              {field.label}
            </label>
            <textarea
              id={`note-${step.id}-${field.key}`}
              value={values[field.key] ?? ''}
              onChange={(e) => update(field.key, e.target.value)}
              rows={field.rows}
              placeholder={field.placeholder}
              spellCheck={false}
              className="mt-1 w-full resize-y rounded-lg border border-line bg-page px-2.5 py-1.5 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
