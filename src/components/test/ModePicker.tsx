import { useState } from 'react'
import type { SVGProps } from 'react'
import type { Skill, TestMode } from '../../types/test'

// The 20–90 min practice choices, in 10-minute steps (READING only).
const DURATION_MINUTES = [20, 30, 40, 50, 60, 70, 80, 90]

// "Choose a mode" — shown full-screen before an exam starts.
//
// READING is clock-based: practice picks its own 20–90 min limit and can pause
// the timer; simulation runs the fixed real-exam clock.
//
// LISTENING is audio-based — the recordings set the pace, so there is NO time
// limit to choose and NO countdown at all. Practice gives full control of the
// recordings (play/pause/rewind); simulation locks them to the real exam rules
// (auto-start, capped plays, no pausing). Both sit the SAME full 35-question paper.
export function ModePicker({
  title,
  skill = 'reading',
  totalQuestions = 35,
  simulationDurationSec,
  onStart,
  starting,
  error,
}: {
  title: string
  skill?: Skill
  totalQuestions?: number
  simulationDurationSec: number
  onStart: (mode: TestMode, durationSec: number) => void
  starting: boolean
  error?: string | null
}) {
  const listening = skill === 'listening'
  const totalParts = listening ? 6 : 5
  const simMinutes = Math.round(simulationDurationSec / 60)
  const [minutes, setMinutes] = useState(DURATION_MINUTES.includes(simMinutes) ? simMinutes : 60)
  const [pending, setPending] = useState<TestMode | null>(null)

  function start(mode: TestMode) {
    if (starting) return
    setPending(mode)
    // Listening sends no meaningful duration — the server decides (audio-paced,
    // untimed for the student). Reading practice sends the chosen limit.
    const durationSec = listening ? 0 : mode === 'practice' ? minutes * 60 : simulationDurationSec
    onStart(mode, durationSec)
  }

  const practiceBullets = [
    `Full test — ${totalParts} parts, ${totalQuestions} questions`,
    ...(listening
      ? ['No time limit — go at your own pace', 'Play, pause, rewind and replay the recordings']
      : ['Pause and resume any time']),
  ]
  const simulationBullets = [
    `Full test — ${totalParts} parts, ${totalQuestions} questions`,
    ...(listening
      ? [
          'Recordings start on their own, just like the exam hall',
          'No pausing or rewinding — submitting unlocks when the audio ends',
        ]
      : [`${simMinutes} minutes · no pause · submits itself when time is up`]),
  ]

  return (
    <div className="w-full max-w-4xl text-left">
      <h1 className="mb-2 text-center text-3xl font-extrabold text-heading">Choose a mode</h1>
      <p className="mb-8 text-center text-sm text-ink-soft">{title}</p>

      {error && (
        <p className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-center text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Practice */}
        <div className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
          <div className="mb-4 flex flex-col items-center text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <SlidersIcon width={28} height={28} />
            </span>
            <h2 className="text-xl font-extrabold text-heading">Practice mode</h2>
          </div>
          <p className="mb-5 text-sm text-ink-soft">
            {listening
              ? 'Best for learning — there’s no clock, and the recordings are fully under your control.'
              : 'Best for building accuracy at your own pace — set your own time limit and pause whenever you need a break.'}
          </p>

          <ul className="mb-5 space-y-2 text-sm font-semibold text-ink">
            {practiceBullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 shrink-0 text-brand" width={18} height={18} />
                {b}
              </li>
            ))}
          </ul>

          {!listening && (
            <label className="mb-6 block">
              <span className="mb-1.5 block text-sm font-bold text-ink">Choose a time limit</span>
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink outline-none transition-colors focus:border-brand"
              >
                {DURATION_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            onClick={() => start('practice')}
            disabled={starting}
            className="mt-auto rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
          >
            {starting && pending === 'practice' ? 'Starting…' : 'Start Now'}
          </button>
        </div>

        {/* Simulation */}
        <div className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
          <div className="mb-4 flex flex-col items-center text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <MonitorIcon width={28} height={28} />
            </span>
            <h2 className="text-xl font-extrabold text-heading">Simulation test mode</h2>
          </div>
          <p className="mb-5 text-sm text-ink-soft">
            {listening
              ? 'The real exam experience — the recordings play on their own schedule, exactly like test day.'
              : 'The best way to feel the real exam — one fixed clock that can’t be paused, just like test day.'}
          </p>

          <ul className="mb-6 space-y-2 text-sm font-semibold text-ink">
            {simulationBullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 shrink-0 text-brand" width={18} height={18} />
                {b}
              </li>
            ))}
          </ul>

          <button
            onClick={() => start('simulation')}
            disabled={starting}
            className="mt-auto rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
          >
            {starting && pending === 'simulation' ? 'Starting…' : 'Start Now'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Local icons (kept here so the shared icon set isn't touched).
function SlidersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="14" cy="18" r="2" />
    </svg>
  )
}

function MonitorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  )
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  )
}
