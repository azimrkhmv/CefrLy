import type { SpeakingPartType, SpeakingTask, SpeakingTest } from '../types/test'

// ---------------------------------------------------------------------------
// Local speaking fixtures (Phase 5, UI-first) — the exact mirror of
// writingFixtures. They stand in for the future get-test / listTests endpoint
// so the whole Speaking catalog is clickable in the dev server without touching
// the live Supabase. When the backend is wired, swap `SPEAKING_FIXTURES` for the
// fetched list — the catalog + screens consume the typed SpeakingTest shape
// either way. Prompts are original placeholder content in the Multilevel format
// (interview · photo comparison · topic talk · for & against).
// ---------------------------------------------------------------------------

const min = (m: number) => m * 60

export const PART_LABEL: Record<SpeakingPartType, string> = {
  part_1_1: 'Part 1.1',
  part_1_2: 'Part 1.2',
  part_2: 'Part 2',
  part_3: 'Part 3',
}

const PART_LEVEL = {
  part_1_1: 'B1',
  part_1_2: 'B2',
  part_2: 'B2',
  part_3: 'C1',
} as const

/** Short human hint of what each part is (used on the Add-Custom tile etc.). */
export const PART_BLURB: Record<SpeakingPartType, string> = {
  part_1_1: 'Interview · 3 short questions',
  part_1_2: 'Photo comparison · 2 photos',
  part_2: 'Talk on a topic · 1 min prep',
  part_3: 'For & against · argue your view',
}

/** Default timings per part — used when a student adds a custom question (they
 *  only supply the prompt, not the clock). */
export const PART_DEFAULTS: Record<
  SpeakingPartType,
  { prepSec: number; speakSec: number; durationSec: number; level: 'B1' | 'B2' | 'C1' }
> = {
  part_1_1: { prepSec: 0, speakSec: 30, durationSec: 90, level: 'B1' },
  part_1_2: { prepSec: 60, speakSec: 90, durationSec: 150, level: 'B2' },
  part_2: { prepSec: 60, speakSec: 120, durationSec: 180, level: 'B2' },
  part_3: { prepSec: 60, speakSec: 120, durationSec: 180, level: 'C1' },
}

/** The example placeholder shown in the custom-question textarea per part. */
export const PART_EXAMPLE: Record<SpeakingPartType, string> = {
  part_1_1:
    'Example:\nAnswer these questions about your home town.\n\n• Where do you live?\n• What do you like most about it?\n• How has it changed in recent years?',
  part_1_2:
    'Example:\nCompare and contrast these two photos.\n\n• say what is happening in each\n• explain how they are similar and different\n• say which situation you would prefer',
  part_2:
    'Example:\nTalk about a skill you would like to learn.\n\n• say what the skill is\n• explain why you want to learn it\n• describe how you would start',
  part_3:
    'Example:\nSome people think university education should be free for everyone.\n\nGive arguments for and against this opinion, then say what you think.',
}

/** Build a single-part drill (scope 'part', one task). */
function drill(opts: {
  id: string
  partType: SpeakingPartType
  title: string
  promptTitle: string
  promptHtml: string
  questions?: string[]
  recommended?: boolean
}): SpeakingTest {
  const d = PART_DEFAULTS[opts.partType]
  const partNumber =
    opts.partType === 'part_1_1' ? 1 : opts.partType === 'part_1_2' ? 2 : opts.partType === 'part_2' ? 3 : 4
  const task: SpeakingTask = {
    id: `${opts.id}-t`,
    partType: opts.partType,
    label: PART_LABEL[opts.partType],
    prompt: { title: opts.promptTitle, html: opts.promptHtml },
    questions: opts.questions,
    prepSec: d.prepSec,
    speakSec: d.speakSec,
    recommended: opts.recommended,
  }
  return {
    id: opts.id,
    skill: 'speaking',
    title: opts.title,
    targetLevels: [PART_LEVEL[opts.partType]],
    durationSec: d.durationSec,
    scope: 'part',
    partNumber,
    tasks: [task],
  }
}

// --- The full Mock Test paper (scope 'full', 4 ordered parts) ---------------

const MOCK_1: SpeakingTest = {
  id: 'speaking-mock-1',
  skill: 'speaking',
  title: 'CEFR Speaking Mock 1',
  targetLevels: ['B1', 'B2', 'C1'],
  durationSec: min(10),
  scope: 'full',
  tasks: [
    {
      id: 'speaking-mock-1-t1',
      partType: 'part_1_1',
      label: 'Part 1.1',
      prompt: {
        title: 'Your free time',
        html: `<p>The examiner will ask you some questions about <strong>your free time</strong>. Answer each question in about <strong>30 seconds</strong>.</p>`,
      },
      questions: [
        'What do you usually do in your free time?',
        'Who do you prefer to spend your free time with, and why?',
        'Has the way you spend your free time changed in the last few years?',
      ],
      prepSec: 0,
      speakSec: 30,
    },
    {
      id: 'speaking-mock-1-t2',
      partType: 'part_1_2',
      label: 'Part 1.2',
      prompt: {
        title: 'Studying alone or in a group',
        html: `<p>Compare and contrast these two photos. You have <strong>1 minute</strong> to prepare and <strong>1.5 minutes</strong> to speak.</p>
<p>In your answer:</p>
<ul>
  <li>say what is happening in each photo</li>
  <li>explain how the two situations are similar and different</li>
  <li>say which way of studying you would prefer, and why</li>
</ul>`,
      },
      prepSec: 60,
      speakSec: 90,
    },
    {
      id: 'speaking-mock-1-t3',
      partType: 'part_2',
      label: 'Part 2',
      prompt: {
        title: 'A place that is important to you',
        html: `<p>Talk about <strong>a place that is important to you</strong>. You have <strong>1 minute</strong> to prepare and <strong>2 minutes</strong> to speak.</p>
<p>You should say:</p>
<ul>
  <li>where the place is and how often you go there</li>
  <li>what you usually do there</li>
  <li>why it matters to you</li>
</ul>`,
      },
      prepSec: 60,
      speakSec: 120,
    },
    {
      id: 'speaking-mock-1-t4',
      partType: 'part_3',
      label: 'Part 3',
      prompt: {
        title: 'Public transport instead of private cars',
        html: `<p>Some people say that everyone should use public transport instead of private cars.</p>
<p>Give arguments <strong>for</strong> and <strong>against</strong> this opinion, then say what you think. You have <strong>1 minute</strong> to prepare and <strong>2 minutes</strong> to speak.</p>`,
      },
      prepSec: 60,
      speakSec: 120,
    },
  ],
}

// --- Single-part drills -----------------------------------------------------

const DRILLS: SpeakingTest[] = [
  // Part 1.1 — interview
  drill({
    id: 's-p11-hometown',
    partType: 'part_1_1',
    title: 'Your home town',
    recommended: true,
    promptTitle: 'Your home town',
    promptHtml: `<p>Answer these questions about <strong>your home town</strong>. Speak for about <strong>30 seconds</strong> on each.</p>`,
    questions: [
      'Where do you come from?',
      'What do you like most about your home town?',
      'What would you change about it if you could?',
    ],
  }),
  drill({
    id: 's-p11-food',
    partType: 'part_1_1',
    title: 'Food and cooking',
    promptTitle: 'Food and cooking',
    promptHtml: `<p>Answer these questions about <strong>food and cooking</strong>. Speak for about <strong>30 seconds</strong> on each.</p>`,
    questions: [
      'What kind of food do you enjoy most?',
      'Do you prefer eating at home or in a restaurant? Why?',
      'Have eating habits in your country changed recently?',
    ],
  }),
  drill({
    id: 's-p11-work',
    partType: 'part_1_1',
    title: 'Study and work',
    promptTitle: 'Study and work',
    promptHtml: `<p>Answer these questions about <strong>study and work</strong>. Speak for about <strong>30 seconds</strong> on each.</p>`,
    questions: [
      'Are you studying or working at the moment?',
      'What is the most difficult part of it?',
      'What would you like to be doing in five years?',
    ],
  }),
  // Part 1.2 — photo comparison
  drill({
    id: 's-p12-transport',
    partType: 'part_1_2',
    title: 'Cycling and driving',
    recommended: true,
    promptTitle: 'Cycling and driving',
    promptHtml: `<p>Compare and contrast these two ways of getting to work.</p>
<ul><li>say what is happening in each situation</li><li>explain how they are similar and different</li><li>say which one you would choose, and why</li></ul>`,
  }),
  drill({
    id: 's-p12-shopping',
    partType: 'part_1_2',
    title: 'Shopping online and in a market',
    promptTitle: 'Shopping online and in a market',
    promptHtml: `<p>Compare and contrast these two ways of shopping.</p>
<ul><li>describe each situation</li><li>explain the advantages of each</li><li>say which you prefer, and why</li></ul>`,
  }),
  drill({
    id: 's-p12-holiday',
    partType: 'part_1_2',
    title: 'A city break and a beach holiday',
    promptTitle: 'A city break and a beach holiday',
    promptHtml: `<p>Compare and contrast these two kinds of holiday.</p>
<ul><li>say what people are doing in each</li><li>explain what kind of traveller each suits</li><li>say which you would rather take, and why</li></ul>`,
  }),
  // Part 2 — topic talk
  drill({
    id: 's-p2-teacher',
    partType: 'part_2',
    title: 'A teacher who influenced you',
    recommended: true,
    promptTitle: 'A teacher who influenced you',
    promptHtml: `<p>Talk about <strong>a teacher who influenced you</strong>.</p>
<p>You should say:</p>
<ul><li>who they were and what they taught</li><li>what made their lessons different</li><li>how they changed the way you think</li></ul>`,
  }),
  drill({
    id: 's-p2-decision',
    partType: 'part_2',
    title: 'An important decision you made',
    promptTitle: 'An important decision you made',
    promptHtml: `<p>Talk about <strong>an important decision you made</strong>.</p>
<p>You should say:</p>
<ul><li>what the decision was</li><li>what made it difficult</li><li>whether you would make the same choice again</li></ul>`,
  }),
  drill({
    id: 's-p2-technology',
    partType: 'part_2',
    title: 'A piece of technology you use daily',
    promptTitle: 'A piece of technology you use daily',
    promptHtml: `<p>Talk about <strong>a piece of technology you use every day</strong>.</p>
<p>You should say:</p>
<ul><li>what it is and how long you have used it</li><li>what you use it for</li><li>how life would change without it</li></ul>`,
  }),
  // Part 3 — for & against
  drill({
    id: 's-p3-exams',
    partType: 'part_3',
    title: 'Should exams be replaced by coursework?',
    recommended: true,
    promptTitle: 'Should exams be replaced by coursework?',
    promptHtml: `<p>Some people believe that exams should be replaced by continuous coursework.</p>
<p>Give arguments <strong>for</strong> and <strong>against</strong> this opinion, then say what you think.</p>`,
  }),
  drill({
    id: 's-p3-remote',
    partType: 'part_3',
    title: 'Is remote work better for society?',
    promptTitle: 'Is remote work better for society?',
    promptHtml: `<p>Some people argue that most jobs should be done remotely.</p>
<p>Give arguments <strong>for</strong> and <strong>against</strong> this view, then give your own opinion.</p>`,
  }),
  drill({
    id: 's-p3-tourism',
    partType: 'part_3',
    title: 'Does tourism help or harm a country?',
    promptTitle: 'Does tourism help or harm a country?',
    promptHtml: `<p>Some people say mass tourism does more harm than good.</p>
<p>Give arguments <strong>for</strong> and <strong>against</strong> this claim, then say where you stand.</p>`,
  }),
]

/** All bundled speaking tests (the Mock paper + single-part drills). */
export const SPEAKING_FIXTURES: SpeakingTest[] = [MOCK_1, ...DRILLS]
