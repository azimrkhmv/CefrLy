import { useState } from 'react'
import type { SVGProps } from 'react'
import type { TestMode, WritingTest } from '../../types/test'

// A practice ladder that fits the shorter writing clocks (drills run 12–30 min,
// the full mock 60). The test's own duration is always injected so the default
// matches the real-exam length.
const BASE_MINUTES = [10, 15, 20, 30, 45, 60, 90]

const wordsHint = (minWords: number, maxWords?: number) =>
  maxWords ? `${minWords}–${maxWords} words` : `about ${minWords} words`

// "Choose a mode" for the Writing paper — mirrors the Reading/Listening
// ModePicker but with writing-appropriate copy and clocks.
//
// Writing is clock-based like Reading: practice sets its own limit and can pause
// the timer; simulation runs the fixed real-exam clock, can't pause, and
// auto-submits when time is up. Both write the SAME task(s).
export function WritingModePicker({
  test,
  onStart,
}: {
  test: WritingTest
  onStart: (mode: TestMode, durationSec: number) => void
}) {
  const isFull = (test.scope ?? 'full') === 'full'
  const simMinutes = Math.round(test.durationSec / 60)

  // Inject the exam's own length so it's always an option, then sort/dedupe.
  const minuteOptions = Array.from(new Set([...BASE_MINUTES, simMinutes])).sort((a, b) => a - b)
  const [minutes, setMinutes] = useState(simMinutes)

  function start(mode: TestMode) {
    const durationSec = mode === 'practice' ? minutes * 60 : test.durationSec
    onStart(mode, durationSec)
  }

  // One fact per bullet so the two cards read as a comparable checklist.
  const summary = isFull
    ? `Full mock — ${test.tasks.length} writing tasks`
    : `${test.tasks[0].label} — ${wordsHint(test.tasks[0].minWords, test.tasks[0].maxWords)}`

  const practiceBullets = [
    summary,
    'Set your own time limit',
    'Pause and resume any time',
  ]
  const simulationBullets = [
    summary,
    `${simMinutes} minutes on the clock`,
    'No pausing',
    'Submits itself when time is up',
  ]

  return (
    <div className="w-full max-w-4xl text-left">
      <h1 className="mb-2 text-center text-3xl font-extrabold text-heading">Choose a mode</h1>
      <p className="mb-8 text-center text-sm text-ink-soft">{test.title}</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Practice */}
        <div className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
          <div className="mb-4 flex flex-col items-center text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <SlidersIcon width={28} height={28} />
            </span>
            <h2 className="text-xl font-extrabold text-heading">Practice mode</h2>
          </div>
          <p className="mb-5 text-sm text-ink-soft">
            Best for building your writing at your own pace — set your own time limit and pause
            whenever you need a break.
          </p>

          <ul className="mb-5 space-y-2 text-sm font-semibold text-ink">
            {practiceBullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 shrink-0 text-brand" width={18} height={18} />
                {b}
              </li>
            ))}
          </ul>

          <label className="mb-6 block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Choose a time limit</span>
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink outline-none transition-colors focus:border-brand"
            >
              {minuteOptions.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => start('practice')}
            className="mt-auto rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
          >
            Start Now
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
            The best way to feel the real exam — one fixed clock that can’t be paused, just like test
            day.
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
            className="mt-auto rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
          >
            Start Now
          </button>
        </div>
      </div>
    </div>
  )
}

// Local icons (kept here so the shared icon set isn't touched) — same marks as
// the Reading/Listening ModePicker for visual consistency.
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
