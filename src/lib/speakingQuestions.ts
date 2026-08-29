import type { SpeakingQuestion, SpeakingTask, SpeakingTest } from '../types/test'

// ---------------------------------------------------------------------------
// Turning a paper into the flat list of questions the exam screen steps through.
//
// A card is never answered in one go: the student sees one question, answers it,
// and moves on. That is true of a single-part drill and of the full mock alike —
// the mock simply chains its four tasks into one longer list.
// ---------------------------------------------------------------------------

/** One thing the student is asked, with everything the screen needs to run it. */
export interface SpeakingStep {
  /** Stable key: task id + index within the task. */
  id: string
  taskId: string
  taskIndex: number
  /** "Part 1.1" etc — shown above the question. */
  label: string
  task: SpeakingTask
  question: SpeakingQuestion
  /** 0-based position within its own task. */
  questionIndex: number
  /** How many questions this task has (for "Question 2 of 3"). */
  questionCount: number
  /** Silent preparation before this question's recording starts. EVERY question
   *  gets one — the exam gives 5s even between Part 1.1 follow-ups. */
  prepSec: number
  /** Hard limit for this answer: the recorder stops itself when it runs out. */
  speakSec: number
}

const asQuestion = (q: string | SpeakingQuestion): SpeakingQuestion =>
  typeof q === 'string' ? { text: q } : q

/** Strip tags so a prompt written as HTML can still be spoken aloud. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The questions of a single task. A task with no `questions` is a single long
 * turn (Part 2's topic talk, Part 3's argument) — its prompt IS the question,
 * so it yields exactly one step and the stepper collapses to 1 of 1.
 */
export function taskQuestions(task: SpeakingTask): SpeakingQuestion[] {
  if (task.questions && task.questions.length > 0) return task.questions.map(asQuestion)
  return [{ text: task.prompt.title ?? plainText(task.prompt.html) }]
}

/** Every question in the paper, in the order they are asked. */
export function speakingSteps(test: SpeakingTest): SpeakingStep[] {
  const steps: SpeakingStep[] = []
  test.tasks.forEach((task, taskIndex) => {
    const questions = taskQuestions(task)
    questions.forEach((question, questionIndex) => {
      steps.push({
        id: `${task.id}-q${questionIndex}`,
        taskId: task.id,
        taskIndex,
        label: task.label,
        task,
        question,
        questionIndex,
        questionCount: questions.length,
        // Per-question overrides win (Part 1.2's opening comparison gets 10s/45s
        // where its follow-ups get the part's 5s/30s); otherwise inherit.
        prepSec: question.prepSec ?? task.prepSec,
        speakSec: question.speakSec ?? task.speakSec,
      })
    })
  })
  return steps
}

/** Total questions in a paper — used for the catalog card and instructions. */
export function questionCount(test: SpeakingTest): number {
  return test.tasks.reduce((n, t) => n + taskQuestions(t).length, 0)
}
