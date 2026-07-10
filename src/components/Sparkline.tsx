const MAX = 35

/**
 * Sparkline of raw /35 scores over time with faint band-threshold guides
 * (10 · 18 · 28) and an HTML "you are here" dot on the last point (stays round
 * despite the horizontal stretch). Shared by Home and My results so the score
 * trend reads identically wherever it appears.
 */
export function Sparkline({ scores }: { scores: number[] }) {
  const W = 600
  const H = 76
  const pad = 8
  const x = (i: number) => pad + (i / Math.max(1, scores.length - 1)) * (W - 2 * pad)
  const y = (s: number) => H - pad - (s / MAX) * (H - 2 * pad)
  const line = scores.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s).toFixed(1)}`).join(' ')
  const area = `${line} L${x(scores.length - 1).toFixed(1)} ${H - pad} L${x(0).toFixed(1)} ${H - pad} Z`
  const lastPct = {
    left: (x(scores.length - 1) / W) * 100,
    top: (y(scores[scores.length - 1]) / H) * 100,
  }
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[76px] w-full" aria-hidden>
        {[10, 18, 28].map((t) => (
          <line
            key={t}
            x1={0}
            x2={W}
            y1={y(t)}
            y2={y(t)}
            className="text-line"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} className="text-brand" fill="currentColor" opacity={0.09} />
        <path
          d={line}
          className="text-brand"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-2 ring-white"
        style={{ left: `${lastPct.left}%`, top: `${lastPct.top}%` }}
        aria-hidden
      />
    </div>
  )
}
