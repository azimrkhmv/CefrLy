import type { TargetBand } from '../types/profile'
import { BAND_QUIP, BandCat, QuipBubble } from './BandCat'

// The goal picker: three stops (B1 / B2 / C1) on a ruler-style track, with the
// band cat sliding to the selection — the wizard's signature moment, reused in
// /settings. Implemented as a real radio group (sr-only inputs), so clicks,
// tab focus and arrow keys all work natively.

const STOPS: { band: TargetBand; pct: number; meaning: string }[] = [
  { band: 'B1', pct: 16.666, meaning: 'A solid working foundation.' },
  { band: 'B2', pct: 50, meaning: 'What universities and most jobs ask for.' },
  { band: 'C1', pct: 83.333, meaning: 'Top of the scale — scholarships love it.' },
]

// Vertical anchor of the track inside the component (px from the top);
// everything above it is reserved headroom for the cat + quip bubble.
const TRACK_Y = 116

export function GoalBandPicker({
  value,
  onChange,
  name = 'target-band',
}: {
  value: TargetBand
  onChange: (band: TargetBand) => void
  /** Radio-group name — override when two pickers share a page. */
  name?: string
}) {
  const sel = STOPS.find((s) => s.band === value) ?? STOPS[1]
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Goal level"
        className="relative"
        style={{ height: TRACK_Y + 64 }}
      >
        {/* quip + cat ride the selected stop */}
        <span
          aria-hidden
          className="pointer-events-none absolute z-[1] motion-safe:transition-[left] motion-safe:duration-500"
          style={{
            left: `clamp(80px, ${sel.pct}%, calc(100% - 80px))`,
            top: TRACK_Y - 76,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <QuipBubble>{BAND_QUIP[sel.band]}</QuipBubble>
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute z-[1] motion-safe:transition-[left] motion-safe:duration-500"
          style={{ left: `${sel.pct}%`, top: TRACK_Y + 2, transform: 'translate(-50%, -100%)' }}
        >
          <BandCat band={sel.band} height={64} />
        </span>

        {/* track between the first and last stops, fill up to the selection */}
        <span
          aria-hidden
          className="absolute h-0.5 bg-line"
          style={{ left: `${STOPS[0].pct}%`, right: `${100 - STOPS[2].pct}%`, top: TRACK_Y }}
        />
        <span
          aria-hidden
          className="absolute h-1 rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-500"
          style={{
            left: `${STOPS[0].pct}%`,
            width: `${sel.pct - STOPS[0].pct}%`,
            top: TRACK_Y - 1,
          }}
        />

        {STOPS.map((stop) => {
          const selected = stop.band === value
          return (
            <label
              key={stop.band}
              className="absolute flex w-24 -translate-x-1/2 cursor-pointer flex-col items-center"
              style={{ left: `${stop.pct}%`, top: TRACK_Y - 21, paddingTop: 15 }}
            >
              <input
                type="radio"
                name={name}
                value={stop.band}
                checked={selected}
                onChange={() => onChange(stop.band)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`h-3 w-3 rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 ${
                  selected ? 'border-brand bg-brand' : 'border-ink-faint bg-white'
                }`}
              />
              <span
                className={`mt-2.5 text-sm ${
                  selected ? 'font-extrabold text-brand' : 'font-semibold text-ink-soft'
                }`}
              >
                {stop.band}
              </span>
            </label>
          )
        })}
      </div>
      <p className="mt-1 text-center text-sm text-ink-soft" aria-live="polite">
        {sel.meaning}
      </p>
    </div>
  )
}
