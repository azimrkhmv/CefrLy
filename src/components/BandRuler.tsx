import { useEffect, useState } from 'react'
import type { Band } from '../types/test'
import { BAND_INFO, BAND_ORDER, BAND_THRESHOLDS } from '../lib/bands'

const MAX_SCORE = 35

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
 * student's level. With `band`/`score` the fill sweeps to the exact score
 * and that band lights up; with `demo` (signed-out surfaces) it sweeps to
 * the C1 boundary as an aspiration. With `animate`, segments draw in and
 * the fill glides (CSS-driven, so prefers-reduced-motion disables it).
 * `tone="dark"` re-cuts the palette for dark panels (statement of results).
 */
export function BandRuler({
  band,
  score,
  demo = false,
  animate = false,
  tone = 'light',
}: {
  band?: Band
  score?: number
  demo?: boolean
  animate?: boolean
  tone?: 'light' | 'dark'
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
    typeof score === 'number'
      ? (Math.min(score, MAX_SCORE) / MAX_SCORE) * 100
      : demo
        ? (BAND_THRESHOLDS.C1 / MAX_SCORE) * 100
        : null
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
              style={{ width: `${((end - start) / MAX_SCORE) * 100}%` }}
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
      </div>

      {/* boundary ticks crossing the rule */}
      {[0, ...BAND_ORDER.slice(1).map((b) => BAND_THRESHOLDS[b]), MAX_SCORE].map((mark, i) => (
        <span
          key={mark}
          className={`absolute top-0 h-3 w-px ${palette.tick} ${animate ? 'reveal' : ''}`}
          style={{
            left: `calc(${(mark / MAX_SCORE) * 100}% - ${mark === MAX_SCORE ? 1 : 0}px)`,
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
          <span
            className={`ruler-marker absolute top-0 h-3 w-0.5 -translate-x-1/2 ${palette.fill}`}
            style={{ left: `${fillPct}%` }}
            aria-hidden
          />
        </>
      )}
    </div>
  )
}
