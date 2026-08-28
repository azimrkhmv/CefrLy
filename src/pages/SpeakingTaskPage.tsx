import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { findSpeakingTest } from '../lib/speakingCatalog'
import { useCustomSpeakingTests } from '../lib/speakingCustom'
import { MicCheck } from '../components/speaking/MicCheck'
import { MicIcon } from '../components/icons'
import type { SpeakingTask, SpeakingTest } from '../types/test'

// The speaking exam screen (recorder, prep countdown, per-part clock) is the NEXT
// phase of work. Until it lands the card must not be a dead link, so this page
// resolves the test and shows the real paper — prompt, questions, timings — with
// a clearly-disabled record control. Same full-screen portal shell the writing
// exam uses, for the same reason: the app shell's transform-animated <main>
// would otherwise re-anchor a `fixed` overlay to itself.
function ExamScreen({ children }: { children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-page">{children}</div>,
    document.body,
  )
}

const clock = (sec: number) => (sec < 120 ? `${sec} sec` : `${Math.round(sec / 60)} min`)

export function SpeakingTaskPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const custom = useCustomSpeakingTests()
  const test = id ? findSpeakingTest(id, custom) : undefined

  if (!test) {
    return (
      <ExamScreen>
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div className="space-y-4">
            <p className="text-sm text-rose-700">This speaking task could not be found.</p>
            <Link
              to="/speaking"
              className="inline-block rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
            >
              Back to Speaking
            </Link>
          </div>
        </div>
      </ExamScreen>
    )
  }

  // Keyed on the test id so opening another card always re-runs the mic check.
  return <SpeakingAttempt key={test.id} test={test} onLeave={() => navigate('/speaking')} />
}

/** Every speaking attempt opens on the mic check — a microphone that turns out to
 *  be broken mid-exam costs the student the whole attempt. Only once they have
 *  recorded a clip and heard it back does the paper render. */
function SpeakingAttempt({ test, onLeave }: { test: SpeakingTest; onLeave: () => void }) {
  const [checked, setChecked] = useState(false)

  if (!checked) {
    return (
      <ExamScreen>
        <MicCheck
          title={test.title}
          bullets={instructionsFor(test)}
          onContinue={() => setChecked(true)}
          onBack={onLeave}
        />
      </ExamScreen>
    )
  }

  return <SpeakingPreview test={test} onLeave={onLeave} />
}

/** The "before you start" bullets, derived from the paper itself so a drill and
 *  the full mock each describe what actually happens. */
function instructionsFor(test: SpeakingTest): string[] {
  const isFull = (test.scope ?? 'full') === 'full'
  const questionCount = test.tasks.reduce((n, t) => n + (t.questions?.length ?? 1), 0)
  const hasPrep = test.tasks.some((t) => t.prepSec > 0)
  return [
    'Ensure your microphone is enabled',
    isFull
      ? `You will speak on ${test.tasks.length} parts — ${questionCount} prompts in total`
      : `${test.tasks[0].label}: ${questionCount} prompt${questionCount > 1 ? 's' : ''} about familiar topics`,
    hasPrep
      ? 'You get preparation time before each part, then the recording starts automatically'
      : 'Each question is answered straight away — there is no preparation time',
    `It will take about ${Math.max(1, Math.round(test.durationSec / 60))} minute${
      test.durationSec >= 120 ? 's' : ''
    } to complete`,
  ]
}

function SpeakingPreview({ test, onLeave }: { test: SpeakingTest; onLeave: () => void }) {
  return (
    <ExamScreen>
      <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate font-extrabold text-heading">{test.title}</h1>
          <p className="text-xs text-ink-soft">
            {(test.scope ?? 'full') === 'full'
              ? `Full mock · ${test.tasks.length} parts`
              : `${test.tasks[0].label} practice`}
            {' · '}
            {clock(test.durationSec)}
          </p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="shrink-0 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
        >
          Back to Speaking
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {test.tasks.map((task) => (
            <TaskPanel key={task.id} task={task} />
          ))}

          <div className="rounded-2xl border border-line bg-brand-soft p-5 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-brand">
              <MicIcon width={22} height={22} />
            </span>
            <p className="mt-3 font-extrabold text-heading">Recording is coming next</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
              The catalog, cards and custom questions are ready. The prep countdown, microphone
              recorder and playback land in the next step.
            </p>
          </div>
        </div>
      </div>
    </ExamScreen>
  )
}

function TaskPanel({ task }: { task: SpeakingTask }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
          {task.label}
        </span>
        <span className="tnum text-xs text-ink-soft">
          {task.prepSec > 0 ? `${task.prepSec}s prep · ` : 'No prep · '}
          {task.speakSec}s to speak
        </span>
      </div>

      {task.prompt.title && (
        <h2 className="mt-3 text-lg font-extrabold text-heading">{task.prompt.title}</h2>
      )}
      <div
        className="passage mt-2 text-ink"
        dangerouslySetInnerHTML={{ __html: task.prompt.html }}
      />

      {task.questions && task.questions.length > 0 && (
        <ol className="mt-4 space-y-2">
          {task.questions.map((q, i) => (
            <li key={i} className="flex gap-2.5 rounded-xl bg-page px-3.5 py-2.5">
              <span className="tnum shrink-0 font-bold text-brand">{i + 1}.</span>
              <span className="text-sm text-ink">{q}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
