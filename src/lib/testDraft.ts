// The admin form's working state (TestDraft) and its converters to/from
// schema-v2 content. The form is a FIXED template mirroring the rigid Reading
// paper: 5 parts, 6/8/6/9/6 questions, 35 total.

import type { Explanation, Item, Part, ReadingTest } from '../types/test'

export interface OptionDraft {
  key: string
  label: string
}

export interface GapItemDraft {
  id: string
  type: 'gap'
  /** Accepted answers, comma-separated in the form. */
  answers: string
  explanation: Explanation
}
export interface MatchItemDraft {
  id: string
  type: 'match'
  prompt: string
  answer: string
  explanation: Explanation
}
export interface McqItemDraft {
  id: string
  type: 'mcq'
  prompt: string
  options: OptionDraft[]
  answer: string
  explanation: Explanation
}
export interface TfngItemDraft {
  id: string
  type: 'tfng'
  prompt: string
  thirdOptionLabel: 'Not Given' | 'No Information'
  answer: 'true' | 'false' | 'not_given'
  explanation: Explanation
}
export type Part4ItemDraft = McqItemDraft | TfngItemDraft
export type Part5ItemDraft = GapItemDraft | McqItemDraft

export interface ParagraphDraft {
  label: string
  html: string
}

export interface TestDraft {
  title: string
  slug: string
  durationSec: number
  part1: { instructions: string; passageTitle: string; passageHtml: string; items: GapItemDraft[] }
  part2: { instructions: string; optionPool: OptionDraft[]; items: MatchItemDraft[] }
  part3: {
    instructions: string
    passageTitle: string
    optionPool: OptionDraft[]
    paragraphs: ParagraphDraft[]
    items: MatchItemDraft[]
  }
  part4: { instructions: string; passageTitle: string; passageHtml: string; items: Part4ItemDraft[] }
  part5: { instructions: string; passageTitle: string; passageHtml: string; items: Part5ItemDraft[] }
}

const LETTERS = 'ABCDEFGHIJ'.split('')
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']

export const emptyExplanation = (): Explanation => ({ location: '', quote: '', reasoning: '' })

export const emptyGap = (id: string): GapItemDraft => ({
  id,
  type: 'gap',
  answers: '',
  explanation: emptyExplanation(),
})
export const emptyMatch = (id: string): MatchItemDraft => ({
  id,
  type: 'match',
  prompt: '',
  answer: '',
  explanation: emptyExplanation(),
})
export const emptyMcq = (id: string): McqItemDraft => ({
  id,
  type: 'mcq',
  prompt: '',
  options: ['A', 'B', 'C', 'D'].map((key) => ({ key, label: '' })),
  answer: '',
  explanation: emptyExplanation(),
})
export const emptyTfng = (id: string): TfngItemDraft => ({
  id,
  type: 'tfng',
  prompt: '',
  thirdOptionLabel: 'Not Given',
  answer: 'true',
  explanation: emptyExplanation(),
})

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function emptyDraft(): TestDraft {
  const qid = (n: number) => `q${n}`
  return {
    title: '',
    slug: '',
    durationSec: 3600,
    part1: {
      instructions: 'Read the text below and complete gaps 1–6. Write ONE word in each gap.',
      passageTitle: '',
      passageHtml: '',
      items: [1, 2, 3, 4, 5, 6].map((n) => emptyGap(qid(n))),
    },
    part2: {
      instructions:
        'Read the eight texts (questions 7–14). Match each text to the correct statement (A–J). There are TWO extra statements which you do not need to use.',
      optionPool: LETTERS.map((key) => ({ key, label: '' })),
      items: [7, 8, 9, 10, 11, 12, 13, 14].map((n) => emptyMatch(qid(n))),
    },
    part3: {
      instructions:
        'Read the text. Choose the best heading (A–H) for each paragraph (I–VI). There are TWO extra headings which you do not need to use.',
      passageTitle: '',
      optionPool: LETTERS.slice(0, 8).map((key) => ({ key, label: '' })),
      paragraphs: ROMAN.map((label) => ({ label, html: '' })),
      items: [15, 16, 17, 18, 19, 20].map((n) => emptyMatch(qid(n))),
    },
    part4: {
      instructions:
        'Read the text and answer questions 21–29. For multiple-choice questions choose the correct answer (A–D); for statements decide True, False or Not Given.',
      passageTitle: '',
      passageHtml: '',
      items: ([21, 22, 23, 24, 25].map((n) => emptyMcq(qid(n))) as Part4ItemDraft[]).concat(
        [26, 27, 28, 29].map((n) => emptyTfng(qid(n))),
      ),
    },
    part5: {
      instructions:
        'Read the text and answer questions 30–35. For gaps, complete the summary with ONE word from the text; for multiple-choice questions choose the correct answer.',
      passageTitle: '',
      passageHtml: '',
      items: ([30, 31, 32, 33].map((n) => emptyGap(qid(n))) as Part5ItemDraft[]).concat(
        [34, 35].map((n) => emptyMcq(qid(n))),
      ),
    },
  }
}

const parseAnswers = (value: string): string[] =>
  value
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)

function draftItemToItem(item: GapItemDraft | MatchItemDraft | McqItemDraft | TfngItemDraft, promptOverride?: string): Item {
  switch (item.type) {
    case 'gap':
      return {
        id: item.id,
        type: 'gap',
        points: 1,
        answer: parseAnswers(item.answers),
        caseSensitive: false,
        explanation: item.explanation,
      }
    case 'match':
      return {
        id: item.id,
        type: 'match',
        points: 1,
        prompt: promptOverride ?? item.prompt,
        answer: item.answer,
        explanation: item.explanation,
      }
    case 'mcq':
      return {
        id: item.id,
        type: 'mcq',
        points: 1,
        prompt: item.prompt,
        options: item.options.map((o) => ({ key: o.key, label: o.label })),
        answer: item.answer,
        explanation: item.explanation,
      }
    case 'tfng':
      return {
        id: item.id,
        type: 'tfng',
        points: 1,
        prompt: item.prompt,
        thirdOptionLabel: item.thirdOptionLabel,
        answer: item.answer,
        explanation: item.explanation,
      }
  }
}

export function draftToContent(draft: TestDraft): ReadingTest {
  const parts: Part[] = [
    {
      id: 'part1',
      number: 1,
      layout: 'cloze_from_text',
      instructions: draft.part1.instructions,
      passage: {
        title: draft.part1.passageTitle || undefined,
        html: draft.part1.passageHtml,
      },
      items: draft.part1.items.map((i) => draftItemToItem(i)),
    },
    {
      id: 'part2',
      number: 2,
      layout: 'match_texts',
      instructions: draft.part2.instructions,
      optionPool: draft.part2.optionPool.map((o) => ({ ...o })),
      items: draft.part2.items.map((i) => draftItemToItem(i)),
    },
    {
      id: 'part3',
      number: 3,
      layout: 'match_headings',
      instructions: draft.part3.instructions,
      optionPool: draft.part3.optionPool.map((o) => ({ ...o })),
      passage: {
        title: draft.part3.passageTitle || undefined,
        paragraphs: draft.part3.paragraphs.map((p) => ({ ...p })),
      },
      items: draft.part3.items.map((item, index) =>
        draftItemToItem(item, `Paragraph ${draft.part3.paragraphs[index]?.label ?? index + 1}`),
      ),
    },
    {
      id: 'part4',
      number: 4,
      layout: 'passage_questions',
      instructions: draft.part4.instructions,
      passage: {
        title: draft.part4.passageTitle || undefined,
        html: draft.part4.passageHtml,
      },
      items: draft.part4.items.map((i) => draftItemToItem(i)),
    },
    {
      id: 'part5',
      number: 5,
      layout: 'passage_questions',
      instructions: draft.part5.instructions,
      passage: {
        title: draft.part5.passageTitle || undefined,
        html: draft.part5.passageHtml,
      },
      items: draft.part5.items.map((i) => draftItemToItem(i)),
    },
  ]

  return {
    id: draft.slug || 'new-test',
    skill: 'reading',
    title: draft.title,
    targetLevels: ['B1', 'B2', 'C1'],
    durationSec: draft.durationSec,
    parts,
  }
}

function itemToDraft(item: Item): GapItemDraft | MatchItemDraft | McqItemDraft | TfngItemDraft {
  switch (item.type) {
    case 'gap':
      return { id: item.id, type: 'gap', answers: item.answer.join(', '), explanation: { ...item.explanation } }
    case 'match':
      return { id: item.id, type: 'match', prompt: item.prompt, answer: item.answer, explanation: { ...item.explanation } }
    case 'mcq':
      return {
        id: item.id,
        type: 'mcq',
        prompt: item.prompt ?? '',
        options: item.options.map((o) => ({ ...o })),
        answer: item.answer,
        explanation: { ...item.explanation },
      }
    case 'tfng':
      return {
        id: item.id,
        type: 'tfng',
        prompt: item.prompt,
        thirdOptionLabel: item.thirdOptionLabel,
        answer: item.answer,
        explanation: { ...item.explanation },
      }
  }
}

/** Prefill the form from stored schema-v2 content (edit mode). */
export function contentToDraft(content: ReadingTest, slug: string): TestDraft {
  const draft = emptyDraft()
  draft.title = content.title
  draft.slug = slug
  draft.durationSec = content.durationSec

  const [p1, p2, p3, p4, p5] = content.parts

  draft.part1 = {
    instructions: p1.instructions,
    passageTitle: p1.passage?.title ?? '',
    passageHtml: p1.passage?.html ?? '',
    items: p1.items.map(itemToDraft) as GapItemDraft[],
  }
  draft.part2 = {
    instructions: p2.instructions,
    optionPool: (p2.optionPool ?? []).map((o) => ({ ...o })),
    items: p2.items.map(itemToDraft) as MatchItemDraft[],
  }
  draft.part3 = {
    instructions: p3.instructions,
    passageTitle: p3.passage?.title ?? '',
    optionPool: (p3.optionPool ?? []).map((o) => ({ ...o })),
    paragraphs: (p3.passage?.paragraphs ?? []).map((p) => ({ ...p })),
    items: p3.items.map(itemToDraft) as MatchItemDraft[],
  }
  draft.part4 = {
    instructions: p4.instructions,
    passageTitle: p4.passage?.title ?? '',
    passageHtml: p4.passage?.html ?? '',
    items: p4.items.map(itemToDraft) as Part4ItemDraft[],
  }
  draft.part5 = {
    instructions: p5.instructions,
    passageTitle: p5.passage?.title ?? '',
    passageHtml: p5.passage?.html ?? '',
    items: p5.items.map(itemToDraft) as Part5ItemDraft[],
  }
  return draft
}
