import type { WritingTask, WritingTaskType, WritingTest } from '../types/test'

// ---------------------------------------------------------------------------
// Local writing fixtures (Phase 4, UI-first). These stand in for the future
// get-test / listTests endpoint so the whole Writing UI is clickable in the dev
// server without touching the live Supabase (no-prod-while-students-live). When
// the backend is wired, swap `WRITING_FIXTURES` for the fetched list — the
// catalog + screens consume the typed WritingTest shape either way.
// Prompts are original placeholder content in the Multilevel format (two emails
// + a forum post); NO charts (unlike IELTS).
// ---------------------------------------------------------------------------

const min = (m: number) => m * 60

/** Build a single-task drill (scope 'part', one task). */
function drill(opts: {
  id: string
  taskType: WritingTaskType
  title: string
  durationMin: number
  minWords: number
  maxWords?: number
  promptTitle: string
  promptHtml: string
  recommended?: boolean
}): WritingTest {
  const partNumber = opts.taskType === 'task_1_1' ? 1 : opts.taskType === 'task_1_2' ? 2 : 3
  const task: WritingTask = {
    id: `${opts.id}-t`,
    taskType: opts.taskType,
    label: TASK_LABEL[opts.taskType],
    minWords: opts.minWords,
    maxWords: opts.maxWords,
    prompt: { title: opts.promptTitle, html: opts.promptHtml },
    recommended: opts.recommended,
  }
  return {
    id: opts.id,
    skill: 'writing',
    title: opts.title,
    targetLevels: [TASK_LEVEL[opts.taskType]],
    durationSec: min(opts.durationMin),
    scope: 'part',
    partNumber,
    tasks: [task],
  }
}

export const TASK_LABEL: Record<WritingTaskType, string> = {
  task_1_1: 'Task 1.1',
  task_1_2: 'Task 1.2',
  part_2: 'Task 2',
}

const TASK_LEVEL = {
  task_1_1: 'B1',
  task_1_2: 'B2',
  part_2: 'C1',
} as const

/** Short human hint of what each task type is (used on the Add-Custom tile etc.). */
export const TASK_BLURB: Record<WritingTaskType, string> = {
  task_1_1: 'Informal email · ~50 words',
  task_1_2: 'Formal email · ~120–150 words',
  part_2: 'Forum post / article · ~180–200 words',
}

/** Default duration + word target per task type — used when a student adds a
 *  custom question (they only supply the prompt, not the timing). */
export const TASK_DEFAULTS: Record<
  WritingTaskType,
  { durationSec: number; minWords: number; maxWords?: number; level: 'B1' | 'B2' | 'C1' }
> = {
  task_1_1: { durationSec: min(12), minWords: 50, level: 'B1' },
  task_1_2: { durationSec: min(20), minWords: 120, maxWords: 150, level: 'B2' },
  part_2: { durationSec: min(30), minWords: 180, maxWords: 200, level: 'C1' },
}

/** The example placeholder shown in the custom-question textarea per task type. */
export const TASK_EXAMPLE: Record<WritingTaskType, string> = {
  task_1_1:
    'Example:\nYou have just moved to a new city. Write an informal email to your friend.\n\n• say where you moved\n• describe your new home\n• invite them to visit',
  task_1_2:
    'Example:\nYou want to complain about a service you received. Write a formal email to the manager.\n\n• explain what happened\n• say how it affected you\n• state what you expect them to do',
  part_2:
    'Example:\nYou have seen this comment on a forum: "Exams are the best way to measure learning."\n\nWrite a forum post giving your opinion, with reasons and examples.',
}

// --- The full Mock Test paper (scope 'full', 3 ordered tasks) ---------------

const MOCK_1: WritingTest = {
  id: 'writing-mock-1',
  skill: 'writing',
  title: 'CEFR Writing Mock 1',
  targetLevels: ['B1', 'B2', 'C1'],
  durationSec: min(60),
  scope: 'full',
  tasks: [
    {
      id: 'writing-mock-1-t1',
      taskType: 'task_1_1',
      label: 'Task 1.1',
      minWords: 50,
      prompt: {
        title: 'A new library in your town',
        html: `<p>A new public library has just opened in your town. Write an <strong>informal email</strong> to your English-speaking friend, Alex.</p>
<p>In your email:</p>
<ul>
  <li>tell Alex the library has opened</li>
  <li>describe what you liked most about it</li>
  <li>invite Alex to visit it with you</li>
</ul>
<p>Write about <strong>50 words</strong>.</p>`,
      },
    },
    {
      id: 'writing-mock-1-t2',
      taskType: 'task_1_2',
      label: 'Task 1.2',
      minWords: 120,
      maxWords: 150,
      prompt: {
        title: 'A suggestion to the library',
        html: `<p>You would like the new library to offer more for young people. Write a <strong>formal email</strong> to the library director, Ms Karimova.</p>
<p>In your email:</p>
<ul>
  <li>introduce yourself and say why you are writing</li>
  <li>suggest two services the library could add for students</li>
  <li>explain how these would help the community</li>
</ul>
<p>Write <strong>120–150 words</strong>.</p>`,
      },
    },
    {
      id: 'writing-mock-1-t3',
      taskType: 'part_2',
      label: 'Task 2',
      minWords: 180,
      maxWords: 200,
      prompt: {
        title: 'Are physical libraries still needed?',
        html: `<p>You have seen this comment on an online forum:</p>
<blockquote>"Everything is online now — physical libraries are a waste of public money."</blockquote>
<p>Write a <strong>forum post</strong> responding to this opinion. Explain whether you agree or disagree and give reasons and examples to support your view.</p>
<p>Write <strong>180–200 words</strong>.</p>`,
      },
    },
  ],
}

// --- Single-task drills -----------------------------------------------------

const DRILLS: WritingTest[] = [
  // Task 1.1 — informal email
  drill({
    id: 'w-t11-gym',
    taskType: 'task_1_1',
    title: 'A new fitness class',
    durationMin: 12,
    minWords: 50,
    recommended: true,
    promptTitle: 'A new fitness class',
    promptHtml: `<p>You have started going to a new fitness class. Write an <strong>informal email</strong> to your friend Sam.</p>
<p>In your email:</p>
<ul><li>say what class you joined</li><li>describe how you feel after it</li><li>ask Sam to come with you next time</li></ul>
<p>Write about <strong>50 words</strong>.</p>`,
  }),
  drill({
    id: 'w-t11-weekend',
    taskType: 'task_1_1',
    title: 'Weekend plans',
    durationMin: 12,
    minWords: 50,
    promptTitle: 'Weekend plans',
    promptHtml: `<p>You are planning a weekend trip and want a friend to join. Write an <strong>informal email</strong> to your friend Bek.</p>
<p>In your email:</p>
<ul><li>say where you are going</li><li>explain what you will do there</li><li>invite Bek and suggest a time to meet</li></ul>
<p>Write about <strong>50 words</strong>.</p>`,
  }),
  drill({
    id: 'w-t11-book',
    taskType: 'task_1_1',
    title: 'A book you enjoyed',
    durationMin: 12,
    minWords: 50,
    promptTitle: 'A book you enjoyed',
    promptHtml: `<p>You have just finished a book you loved. Write an <strong>informal email</strong> to your friend Dina.</p>
<p>In your email:</p>
<ul><li>tell Dina the name of the book</li><li>say why you enjoyed it</li><li>recommend when she should read it</li></ul>
<p>Write about <strong>50 words</strong>.</p>`,
  }),
  // Task 1.2 — formal email
  drill({
    id: 'w-t12-complaint',
    taskType: 'task_1_2',
    title: 'A complaint about an online order',
    durationMin: 20,
    minWords: 120,
    maxWords: 150,
    recommended: true,
    promptTitle: 'A complaint about an online order',
    promptHtml: `<p>You ordered a product online and it arrived damaged. Write a <strong>formal email</strong> to the customer service manager.</p>
<p>In your email:</p>
<ul><li>give the details of your order</li><li>explain what was wrong</li><li>say what you would like the company to do</li></ul>
<p>Write <strong>120–150 words</strong>.</p>`,
  }),
  drill({
    id: 'w-t12-course',
    taskType: 'task_1_2',
    title: 'Requesting course information',
    durationMin: 20,
    minWords: 120,
    maxWords: 150,
    promptTitle: 'Requesting course information',
    promptHtml: `<p>You want to enrol in an English course abroad. Write a <strong>formal email</strong> to the language school.</p>
<p>In your email:</p>
<ul><li>say which course you are interested in</li><li>ask about fees and start dates</li><li>request information about accommodation</li></ul>
<p>Write <strong>120–150 words</strong>.</p>`,
  }),
  drill({
    id: 'w-t12-job',
    taskType: 'task_1_2',
    title: 'Applying for a part-time job',
    durationMin: 20,
    minWords: 120,
    maxWords: 150,
    promptTitle: 'Applying for a part-time job',
    promptHtml: `<p>You saw an advert for a part-time job at a café. Write a <strong>formal email</strong> to the manager.</p>
<p>In your email:</p>
<ul><li>say which job you are applying for</li><li>describe your relevant experience</li><li>explain when you are available to work</li></ul>
<p>Write <strong>120–150 words</strong>.</p>`,
  }),
  // Task 2 — forum post / article
  drill({
    id: 'w-p2-social',
    taskType: 'part_2',
    title: 'Does social media do more harm than good?',
    durationMin: 30,
    minWords: 180,
    maxWords: 200,
    recommended: true,
    promptTitle: 'Does social media do more harm than good?',
    promptHtml: `<p>You have seen this comment on an online forum:</p>
<blockquote>"Social media brings people together and helps them learn."</blockquote>
<p>Write a <strong>forum post</strong> giving your opinion. Say whether you agree or disagree and support your view with reasons and examples.</p>
<p>Write <strong>180–200 words</strong>.</p>`,
  }),
  drill({
    id: 'w-p2-cars',
    taskType: 'part_2',
    title: 'Should city centres ban private cars?',
    durationMin: 30,
    minWords: 180,
    maxWords: 200,
    promptTitle: 'Should city centres ban private cars?',
    promptHtml: `<p>You have seen this comment on an online forum:</p>
<blockquote>"City centres would be cleaner and safer without private cars."</blockquote>
<p>Write a <strong>forum post</strong> responding to this opinion. Explain whether you agree or disagree and give reasons and examples.</p>
<p>Write <strong>180–200 words</strong>.</p>`,
  }),
  drill({
    id: 'w-p2-remote',
    taskType: 'part_2',
    title: 'Is working from home better than the office?',
    durationMin: 30,
    minWords: 180,
    maxWords: 200,
    promptTitle: 'Is working from home better than the office?',
    promptHtml: `<p>You have seen this comment on an online forum:</p>
<blockquote>"People are more productive and happier when they work from home."</blockquote>
<p>Write a <strong>forum post</strong> giving your view. Say whether you agree or disagree and support your opinion with reasons and examples.</p>
<p>Write <strong>180–200 words</strong>.</p>`,
  }),
]

/** All bundled writing tests (the Mock paper + single-task drills). */
export const WRITING_FIXTURES: WritingTest[] = [MOCK_1, ...DRILLS]
