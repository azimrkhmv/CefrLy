// ---------------------------------------------------------------------------
// What goes on the note sheet — the pure half of SpeakingNotes.tsx.
//
// Split out because these fields are a scoring decision, not a layout one, and
// a scoring decision needs a test beside it. (Node cannot strip JSX, so a .tsx
// cannot be imported by node --test; the graders separate rubric.ts from
// index.ts for the same reason.)
//
// THE FIELDS MIRROR WHAT THE MARK SCHEME COUNTS:
//   · Part 2 is scored by HOW MANY of its prompts were addressed (all three = 4
//     marks, two = 3, one = 1), so there is a line per prompt. An empty line is
//     a prompt you are about to forget.
//   · Part 3's marks turn on covering BOTH sides (4) rather than one (3), with
//     5 needing balanced argument on top — so it is For / Against side by side,
//     and a box for the view the task also asks for.
//   · Parts 1.1 and 1.2 get NO sheet: they are answered on the spot with five
//     to ten seconds of preparation, and a notes box there invites a student to
//     write when they should be talking.
// ---------------------------------------------------------------------------
import type { SpeakingStep } from './speakingQuestions'

export interface NoteField {
  key: string
  label: string
  placeholder: string
  rows: number
}

/** The sheet for this question, or null for the parts that get no paper. */
export function fieldsFor(step: SpeakingStep): NoteField[] | null {
  const { partType, debate } = step.task

  if (partType === 'part_3') {
    return [
      {
        key: 'for',
        label: 'Arguments FOR',
        placeholder: debate?.for?.length ? 'Your own reasons, in your own words…' : 'Reasons to agree…',
        rows: 3,
      },
      {
        key: 'against',
        label: 'Arguments AGAINST',
        placeholder: debate?.against?.length
          ? 'Your own reasons, in your own words…'
          : 'Reasons to disagree…',
        rows: 3,
      },
      { key: 'view', label: 'What I think', placeholder: 'Your own position, and why…', rows: 2 },
    ]
  }

  if (partType !== 'part_2') return null

  // Part 2's prompts are stored newline-separated (see the part_2 builder in
  // speakingFromSamples.ts) — one note line each, numbered to match the
  // question card above so the eye can pair them without thinking.
  const prompts = step.question.text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (prompts.length <= 1) {
    return [{ key: 'n1', label: 'Notes', placeholder: 'Key words, examples, an order to say them in…', rows: 5 }]
  }

  return prompts.map((prompt, i) => ({
    key: `n${i + 1}`,
    label: `${i + 1}. ${prompt}`,
    placeholder: 'Key words — not sentences…',
    rows: 2,
  }))
}
