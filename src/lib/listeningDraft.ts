// The listening admin form's working state (ListeningDraft) and its converters
// to/from schema-v2 content. Fixed template: 6 parts, 8/6/4/5/6/6 = 35.
import type {
  GapItem,
  Group,
  ListeningPart,
  ListeningTest,
  MatchItem,
  McqItem,
} from '../types/test'
import {
  emptyExplanation,
  type GapItemDraft,
  type MatchItemDraft,
  type McqItemDraft,
  type OptionDraft,
} from './testDraft'

export interface AudioDraft {
  assetPath: string
  playLimit: number
  previewSec: number
}
export interface ImageDraft {
  assetPath: string
  alt: string
}
export interface GroupDraft {
  context: string
  items: McqItemDraft[]
}

export interface ListeningDraft {
  title: string
  slug: string
  durationSec: number
  audioMode: 'per_part' | 'single'
  singleAudio: AudioDraft
  part1: { instructions: string; audio: AudioDraft; items: McqItemDraft[] }
  part2: { instructions: string; audio: AudioDraft; stemTitle: string; stemHtml: string; items: GapItemDraft[] }
  part3: { instructions: string; audio: AudioDraft; optionPool: OptionDraft[]; items: MatchItemDraft[] }
  part4: {
    instructions: string
    audio: AudioDraft
    image: ImageDraft
    optionPool: OptionDraft[]
    items: MatchItemDraft[]
  }
  part5: { instructions: string; audio: AudioDraft; groups: GroupDraft[] }
  part6: { instructions: string; audio: AudioDraft; stemTitle: string; stemHtml: string; items: GapItemDraft[] }
}

const LETTERS = 'ABCDEFGHIJ'.split('')
const qid = (n: number) => `q${n}`

const emptyAudio = (): AudioDraft => ({ assetPath: '', playLimit: 2, previewSec: 20 })

const emptyGap = (id: string): GapItemDraft => ({
  id,
  type: 'gap',
  answers: '',
  explanation: emptyExplanation(),
})
const emptyMatch = (id: string): MatchItemDraft => ({
  id,
  type: 'match',
  prompt: '',
  answer: '',
  explanation: emptyExplanation(),
})
/** mcq with 3 options (A/B/C) — the listening default. */
const emptyMcq3 = (id: string): McqItemDraft => ({
  id,
  type: 'mcq',
  prompt: '',
  options: ['A', 'B', 'C'].map((key) => ({ key, label: '' })),
  answer: '',
  explanation: emptyExplanation(),
})

export function emptyListeningDraft(): ListeningDraft {
  return {
    title: '',
    slug: '',
    durationSec: 2400,
    audioMode: 'per_part',
    singleAudio: { assetPath: '', playLimit: 2, previewSec: 30 },
    part1: {
      instructions:
        'You will hear eight short recordings. For each one, choose the best reply (A, B or C). You will hear each recording twice.',
      audio: emptyAudio(),
      items: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => emptyMcq3(qid(n))),
    },
    part2: {
      instructions:
        'You will hear a conversation. Complete the form. Write ONE word or a number in each gap. You will hear the recording twice.',
      audio: emptyAudio(),
      stemTitle: '',
      stemHtml:
        '<p><strong>Detail 1:</strong> {{q9}}</p>\n<p><strong>Detail 2:</strong> {{q10}}</p>\n<p><strong>Detail 3:</strong> {{q11}}</p>\n<p><strong>Detail 4:</strong> {{q12}}</p>\n<p><strong>Detail 5:</strong> {{q13}}</p>\n<p><strong>Detail 6:</strong> {{q14}}</p>',
      items: [9, 10, 11, 12, 13, 14].map((n) => emptyGap(qid(n))),
    },
    part3: {
      instructions:
        'You will hear four people speaking. Choose what each speaker says from the list (A–H). There are more options than speakers. You will hear the recording twice.',
      audio: emptyAudio(),
      optionPool: LETTERS.slice(0, 8).map((key) => ({ key, label: '' })),
      items: [15, 16, 17, 18].map((n) => {
        const m = emptyMatch(qid(n))
        m.prompt = `Speaker ${n - 14}`
        return m
      }),
    },
    part4: {
      instructions:
        'You will hear someone describing a plan. Label the places on the map. Choose the correct letter for each place. You will hear the recording twice.',
      audio: emptyAudio(),
      image: { assetPath: '', alt: '' },
      optionPool: LETTERS.slice(0, 8).map((key) => ({ key, label: key })),
      items: [19, 20, 21, 22, 23].map((n) => emptyMatch(qid(n))),
    },
    part5: {
      instructions:
        'You will hear three short extracts. For each extract, answer the two questions (A, B or C). You will hear each extract twice.',
      audio: emptyAudio(),
      groups: [0, 1, 2].map((gi) => ({
        context: '',
        items: [0, 1].map((ii) => emptyMcq3(qid(24 + gi * 2 + ii))),
      })),
    },
    part6: {
      instructions:
        'You will hear a talk. Complete the notes. Write ONE word in each gap. You will hear the talk twice.',
      audio: emptyAudio(),
      stemTitle: '',
      stemHtml:
        '<p>Note 1: {{q30}}</p>\n<p>Note 2: {{q31}}</p>\n<p>Note 3: {{q32}}</p>\n<p>Note 4: {{q33}}</p>\n<p>Note 5: {{q34}}</p>\n<p>Note 6: {{q35}}</p>',
      items: [30, 31, 32, 33, 34, 35].map((n) => emptyGap(qid(n))),
    },
  }
}

const parseAnswers = (value: string): string[] =>
  value
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)

const toGap = (d: GapItemDraft, number: number): GapItem => ({
  id: d.id,
  type: 'gap',
  points: 1,
  number,
  answer: parseAnswers(d.answers),
  caseSensitive: false,
  explanation: d.explanation,
})
const toMatch = (d: MatchItemDraft, number: number): MatchItem => ({
  id: d.id,
  type: 'match',
  points: 1,
  number,
  prompt: d.prompt,
  answer: d.answer,
  explanation: d.explanation,
})
const toMcq = (d: McqItemDraft, number: number, withPrompt: boolean): McqItem => ({
  id: d.id,
  type: 'mcq',
  points: 1,
  number,
  ...(withPrompt ? { prompt: d.prompt } : {}),
  options: d.options.map((o) => ({ key: o.key, label: o.label })),
  answer: d.answer,
  explanation: d.explanation,
})

const audioObj = (a: AudioDraft) => ({
  assetPath: a.assetPath,
  playLimit: Number(a.playLimit) || 2,
  previewSec: Number(a.previewSec) || 0,
})

export function listeningDraftToContent(draft: ListeningDraft): ListeningTest {
  const perPart = draft.audioMode === 'per_part'
  const audioField = (a: AudioDraft) => (perPart ? { audio: audioObj(a) } : {})

  const parts: ListeningPart[] = [
    {
      id: 'lp1',
      number: 1,
      layout: 'mcq_response',
      instructions: draft.part1.instructions,
      ...audioField(draft.part1.audio),
      items: draft.part1.items.map((d, i) => toMcq(d, 1 + i, false)),
    },
    {
      id: 'lp2',
      number: 2,
      layout: 'form_completion',
      instructions: draft.part2.instructions,
      ...audioField(draft.part2.audio),
      stem: { title: draft.part2.stemTitle || undefined, html: draft.part2.stemHtml },
      items: draft.part2.items.map((d, i) => toGap(d, 9 + i)),
    },
    {
      id: 'lp3',
      number: 3,
      layout: 'matching',
      instructions: draft.part3.instructions,
      ...audioField(draft.part3.audio),
      optionPool: draft.part3.optionPool.map((o) => ({ ...o })),
      items: draft.part3.items.map((d, i) => toMatch(d, 15 + i)),
    },
    {
      id: 'lp4',
      number: 4,
      layout: 'map_labelling',
      instructions: draft.part4.instructions,
      ...audioField(draft.part4.audio),
      image: { assetPath: draft.part4.image.assetPath, alt: draft.part4.image.alt },
      optionPool: draft.part4.optionPool.map((o) => ({ ...o })),
      items: draft.part4.items.map((d, i) => toMatch(d, 19 + i)),
    },
    {
      id: 'lp5',
      number: 5,
      layout: 'multi_extract_mcq',
      instructions: draft.part5.instructions,
      ...audioField(draft.part5.audio),
      groups: draft.part5.groups.map((g, gi): Group => ({
        id: `g${gi + 1}`,
        context: g.context,
        items: g.items.map((d, ii) => toMcq(d, 24 + gi * 2 + ii, true)),
      })),
    },
    {
      id: 'lp6',
      number: 6,
      layout: 'note_completion',
      instructions: draft.part6.instructions,
      ...audioField(draft.part6.audio),
      stem: { title: draft.part6.stemTitle || undefined, html: draft.part6.stemHtml },
      items: draft.part6.items.map((d, i) => toGap(d, 30 + i)),
    },
  ]

  const test: ListeningTest = {
    id: draft.slug || 'new-listening',
    skill: 'listening',
    title: draft.title,
    targetLevels: ['B1', 'B2', 'C1'],
    durationSec: draft.durationSec,
    audioMode: draft.audioMode,
    parts,
  }
  if (draft.audioMode === 'single') test.singleAudio = audioObj(draft.singleAudio)
  return test
}

const gapToDraft = (item: GapItem): GapItemDraft => ({
  id: item.id,
  type: 'gap',
  answers: item.answer.join(', '),
  explanation: { ...item.explanation },
})
const matchToDraft = (item: MatchItem): MatchItemDraft => ({
  id: item.id,
  type: 'match',
  prompt: item.prompt,
  answer: item.answer,
  explanation: { ...item.explanation },
})
const mcqToDraft = (item: McqItem): McqItemDraft => ({
  id: item.id,
  type: 'mcq',
  prompt: item.prompt ?? '',
  options: item.options.map((o) => ({ ...o })),
  answer: item.answer,
  explanation: { ...item.explanation },
})
const audioToDraft = (a: { assetPath: string; playLimit: number; previewSec: number } | undefined): AudioDraft =>
  a ? { assetPath: a.assetPath, playLimit: a.playLimit, previewSec: a.previewSec } : emptyAudio()

/** Prefill the listening form from stored schema-v2 content (edit mode). */
export function contentToListeningDraft(content: ListeningTest, slug: string): ListeningDraft {
  const draft = emptyListeningDraft()
  draft.title = content.title
  draft.slug = slug
  draft.durationSec = content.durationSec
  draft.audioMode = content.audioMode
  if (content.singleAudio) draft.singleAudio = audioToDraft(content.singleAudio)

  const [p1, p2, p3, p4, p5, p6] = content.parts

  draft.part1 = {
    instructions: p1.instructions,
    audio: audioToDraft(p1.audio),
    items: (p1.items ?? []).map((i) => mcqToDraft(i as McqItem)),
  }
  draft.part2 = {
    instructions: p2.instructions,
    audio: audioToDraft(p2.audio),
    stemTitle: p2.stem?.title ?? '',
    stemHtml: p2.stem?.html ?? '',
    items: (p2.items ?? []).map((i) => gapToDraft(i as GapItem)),
  }
  draft.part3 = {
    instructions: p3.instructions,
    audio: audioToDraft(p3.audio),
    optionPool: (p3.optionPool ?? []).map((o) => ({ ...o })),
    items: (p3.items ?? []).map((i) => matchToDraft(i as MatchItem)),
  }
  draft.part4 = {
    instructions: p4.instructions,
    audio: audioToDraft(p4.audio),
    image: { assetPath: p4.image?.assetPath ?? '', alt: p4.image?.alt ?? '' },
    optionPool: (p4.optionPool ?? []).map((o) => ({ ...o })),
    items: (p4.items ?? []).map((i) => matchToDraft(i as MatchItem)),
  }
  draft.part5 = {
    instructions: p5.instructions,
    audio: audioToDraft(p5.audio),
    groups: (p5.groups ?? []).map((g) => ({
      context: g.context,
      items: g.items.map((i) => mcqToDraft(i as McqItem)),
    })),
  }
  draft.part6 = {
    instructions: p6.instructions,
    audio: audioToDraft(p6.audio),
    stemTitle: p6.stem?.title ?? '',
    stemHtml: p6.stem?.html ?? '',
    items: (p6.items ?? []).map((i) => gapToDraft(i as GapItem)),
  }
  return draft
}
