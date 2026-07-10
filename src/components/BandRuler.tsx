import { useEffect, useState, type ReactNode } from 'react'
import type { Band } from '../types/test'
import { BAND_INFO, BAND_ORDER, BAND_THRESHOLDS } from '../lib/bands'

const MAX_SCORE = 35
// The scored /35 axis (below_B1…C1) fills this fraction of the ruler; the
// remainder is an aspirational C2 "cap". C2 is ABOVE this exam's ceiling — no
// raw score maps to it — so it sits OFF the scored axis and the fill/mascot can
// never land there.
const SCORED_FRACTION = 0.82
/** Position (in % of the full ruler) of a raw mark on the scored portion. */
const xPct = (mark: number) => (Math.min(mark, MAX_SCORE) / MAX_SCORE) * SCORED_FRACTION * 100

// [start, end) in raw marks; the last band closes at 35.
function bandSpan(band: Band): [number, number] {
  const index = BAND_ORDER.indexOf(band)
  const start = BAND_THRESHOLDS[band]
  const end = index === BAND_ORDER.length - 1 ? MAX_SCORE : BAND_THRESHOLDS[BAND_ORDER[index + 1]]
  return [start, end]
}

/**
 * The CEFR band ruler: a ruled scale of the real scoring thresholds
 * (0 · 10 · 18 · 28 · 35 raw marks) with a fill that rises to the
 * student's level, plus a faded C2 cap beyond the exam's C1 ceiling. With
 * `band`/`score` the fill sweeps to the exact score and that band lights up;
 * with `demo` (signed-out surfaces) it sweeps to the C1 boundary as an
 * aspiration. The fill never enters the C2 cap (nothing scores C2). With
 * `animate`, segments draw in and the fill glides (CSS-driven, so
 * prefers-reduced-motion disables it). `tone="dark"` re-cuts the palette for
 * dark panels (statement of results).
 */
export function BandRuler({
  band,
  score,
  demo = false,
  animate = false,
  tone = 'light',
  topper,
  topperHalfWidth = 21,
  topperBubble,
}: {
  band?: Band
  score?: number
  demo?: boolean
  animate?: boolean
  tone?: 'light' | 'dark'
  /** Decorative node (e.g. the mascot) that rides the fill to the score. The
   * parent must reserve headroom above the ruler so it isn't clipped. */
  topper?: ReactNode
  /** Half the topper's rendered width in px; the fill position is clamped by
   * this so the mascot never hangs off the scale's ends. Band-specific cats
   * have different widths, so the parent passes the right half. */
  topperHalfWidth?: number
  /** Optional speech bubble that follows the topper but clamps further inside
   * the ruler, so a wide bubble never drags the mascot off-position or spills
   * out of the card at the extremes. */
  topperBubble?: ReactNode
}) {
  const dark = tone === 'dark'
  const palette = {
    track: dark ? 'bg-white/20' : 'bg-line',
    fill: dark ? 'bg-white' : 'bg-brand',
    tick: dark ? 'bg-white/30' : 'bg-ink-faint',
    litLabel: dark ? 'font-semibold text-white' : 'font-semibold text-brand',
    label: dark ? 'font-medium text-white/65' : 'font-medium text-ink-soft',
    range: dark ? 'text-white/60' : 'text-ink-soft',
  }

  const targetPct =
    typeof score === 'number' ? xPct(score) : demo ? xPct(BAND_THRESHOLDS.C1) : null
  const litBand = band ?? (demo ? 'C1' : undefined)
  const [fillPct, setFillPct] = useState(targetPct === null ? null : animate ? 0 : targetPct)

  useEffect(() => {
    if (targetPct === null) return
    if (!animate) {
      setFillPct(targetPct)
      return
    }
    // Let the 0% position paint first so the CSS transition has a run-up.
    const raf = requestAnimationFrame(() => setFillPct(targetPct))
    return () => cancelAnimationFrame(raf)
  }, [animate, targetPct])

  return (
    <div
      role="group"
      className="relative pt-1.5"
      aria-label={band ? `Indicative band ${BAND_INFO[band].label}` : 'CEFR band scale'}
    >
      <div className="flex">
        {BAND_ORDER.map((b, i) => {
          const [start, end] = bandSpan(b)
          const lit = litBand === b
          return (
            <div
              key={b}
              className="pr-2"
              style={{ width: `${((end - start) / MAX_SCORE) * SCORED_FRACTION * 100}%` }}
            >
              <span
                className={`ruler-track block h-0.5 w-full ${palette.track} ${
                  animate ? 'ruler-draw' : ''
                }`}
                style={animate ? { animationDelay: `${0.35 + i * 0.12}s` } : undefined}
                aria-hidden
              />
              <div
                className={animate ? 'reveal' : undefined}
                style={animate ? { animationDelay: `${0.5 + i * 0.12}s` } : undefined}
              >
                <p
                  className={`pt-2 text-[11px] uppercase tracking-[0.08em] ${
                    lit ? palette.litLabel : palette.label
                  }`}
                >
                  {BAND_INFO[b].label}
                </p>
                <p className={`tnum mt-0.5 text-[11px] ${palette.range}`}>{BAND_INFO[b].range}</p>
              </div>
            </div>
          )
        })}

        {/* Aspirational C2 cap — above this exam's C1 ceiling: just a label
            beyond the ruled scale, with NO track line or terminal tick (an
            invisible spacer keeps the label aligned with the scored bands). */}
        <div className="pr-2" style={{ width: `${(1 - SCORED_FRACTION) * 100}%` }}>
          <span className="block h-0.5 w-full" aria-hidden />
          <div
            className={animate ? 'reveal' : undefined}
            style={animate ? { animationDelay: `${0.5 + BAND_ORDER.length * 0.12}s` } : undefined}
          >
            <p className={`pt-2 text-[11px] uppercase tracking-[0.08em] ${palette.label}`}>C2</p>
            <p className={`mt-0.5 text-[11px] italic ${palette.range}`}>beyond</p>
          </div>
        </div>
      </div>

      {/* boundary ticks crossing the rule — the scored thresholds mapped onto
          the /35 portion. The line ends at the C1/35 mark; C2 is a label beyond
          it with no track or terminal tick. */}
      {[0, BAND_THRESHOLDS.B1, BAND_THRESHOLDS.B2, BAND_THRESHOLDS.C1, MAX_SCORE]
        .map((mark) => xPct(mark))
        .map((posPct, i) => (
          <span
            key={i}
            className={`absolute top-0 h-3 w-px ${palette.tick} ${animate ? 'reveal' : ''}`}
            style={{
              left: `${posPct}%`,
              ...(animate ? { animationDelay: `${0.45 + i * 0.08}s` } : undefined),
            }}
            aria-hidden
          />
        ))}

      {/* the level fill: rises from 0 to the score (or the C1 aspiration) */}
      {fillPct !== null && (
        <>
          <span
            className={`ruler-fill absolute left-0 top-[5px] h-1 rounded-full ${palette.fill}`}
            style={{ width: `${fillPct}%` }}
            aria-hidden
          />
          {/* the vertical tick marks the exact position; when the mascot rides
              the fill it IS the position indicator, so drop the tick to avoid a
              disconnected stray line (esp. at low scores where the cat clamps). */}
          {!topper && (
            <span
              className={`ruler-marker absolute top-0 h-3 w-0.5 -translate-x-1/2 ${palette.fill}`}
              style={{ left: `${fillPct}%` }}
              aria-hidden
            />
          )}
          {topper && (
            // Clamped by half the mascot's width, so at score 0 its paw edge
            // sits exactly at the start of the scale.
            <span
              className="pointer-events-none absolute z-[1] motion-safe:transition-[left] motion-safe:duration-1000"
              style={{
                left: `clamp(${topperHalfWidth}px, ${fillPct}%, calc(100% - ${topperHalfWidth}px))`,
                top: '7px',
                transform: 'translate(-50%, -100%)',
              }}
              aria-hidden
            >
              {topper}
            </span>
          )}
          {topperBubble && (
            // The bubble follows the mascot but clamps further in, so it stays
            // fully inside the card even when the mascot is at an extreme.
            <span
              className="pointer-events-none absolute z-[1] motion-safe:transition-[left] motion-safe:duration-1000"
              style={{
                left: `clamp(96px, ${fillPct}%, calc(100% - 96px))`,
                top: '-49px',
                transform: 'translate(-50%, -100%)',
              }}
              aria-hidden
            >
              {topperBubble}
            </span>
          )}
        </>
      )}
    </div>
  )
}
