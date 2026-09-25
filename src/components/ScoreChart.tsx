import { useEffect, useRef, useState } from 'react'

/**
 * Score trend on a fixed 0–max axis: y gridlines + labels, a soft area under
 * the line, and a dot per attempt. Measures its own width (ResizeObserver) so
 * the SVG is drawn 1:1 and the dots stay round at any card width; the old
 * Sparkline stretched a fixed viewBox instead.
 */
export function ScoreChart({
  scores,
  max,
  height = 170,
}: {
  /** Chronological, oldest first. */
  scores: number[]
  max: number
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Six even steps, so a /35 axis reads 0 7 14 21 28 35.
  const steps = 5
  const ticks = Array.from({ length: steps + 1 }, (_, i) => Math.round((max / steps) * i))
  const labelW = 26
  const padTop = 8
  const padBottom = 8
  const padRight = 10
  const plotW = Math.max(0, width - labelW - padRight)
  const plotH = height - padTop - padBottom

  const x = (i: number) =>
    labelW + (scores.length <= 1 ? plotW / 2 : (plotW * i) / (scores.length - 1))
  const y = (v: number) => padTop + plotH * (1 - Math.min(max, Math.max(0, v)) / max)

  const line = scores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area =
    scores.length > 1
      ? `${line} L${x(scores.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`
      : ''

  return (
    <div ref={wrapRef} className="w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Scores: ${scores.join(', ')} out of ${max}`}>
          <defs>
            <linearGradient id="score-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={labelW}
                x2={width - padRight}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-line)"
                strokeDasharray={t === 0 ? undefined : '3 4'}
              />
              <text
                x={labelW - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="tnum fill-ink-soft text-[10px] font-semibold"
              >
                {t}
              </text>
            </g>
          ))}
          {area && <path d={area} fill="url(#score-area)" />}
          <path
            d={line}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {scores.map((v, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={i === scores.length - 1 ? 5 : 3.5}
              fill={i === scores.length - 1 ? 'var(--color-accent-deep)' : 'var(--color-brand)'}
              stroke="white"
              strokeWidth={2}
            />
          ))}
        </svg>
      )}
    </div>
  )
}
