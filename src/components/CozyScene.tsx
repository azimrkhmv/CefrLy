// Decorative "study nook" vignette that fills the empty space to the right of
// the sleeping cat on the auth page. Purely ornamental (aria-hidden), soft
// monochrome lavender so it recedes behind the mascot and never competes with
// the form. Colours match the imported auth design's lavender family.
export function CozyScene({ className = '' }: { className?: string }) {
  const line = '#B4A2E4'
  const f1 = '#ECE7F8' // lightest
  const f2 = '#DED3F3'
  const f3 = '#D0C1EE'
  return (
    <svg
      viewBox="0 0 460 330"
      fill="none"
      className={className}
      aria-hidden
      role="presentation"
    >
      <g
        stroke={line}
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      >
        {/* floor line */}
        <path d="M40 293 H430" opacity={0.6} />

        {/* wall clock */}
        <g>
          <circle cx={168} cy={86} r={40} fill={f1} />
          <circle cx={168} cy={86} r={31} fill="none" opacity={0.5} />
          <path d="M168 86 V60" />
          <path d="M168 86 L188 96" />
          <circle cx={168} cy={86} r={3.2} fill={line} stroke="none" />
          <path d="M168 46 v-8" />
        </g>

        {/* steaming mug */}
        <g>
          <path d="M150 210 q-9 -11 0 -22 q9 -11 0 -22" fill="none" opacity={0.7} />
          <path d="M170 210 q-9 -11 0 -22 q9 -11 0 -22" fill="none" opacity={0.7} />
          <path
            d="M126 232 H184 V266 a12 12 0 0 1 -12 12 H138 a12 12 0 0 1 -12 -12 Z"
            fill={f2}
          />
          <path d="M184 240 a15 15 0 0 1 0 26" fill="none" />
          <path d="M118 282 H192" />
        </g>

        {/* potted plant on a little stack of books */}
        <g>
          {/* books the pot rests on */}
          <rect x={312} y={250} width={112} height={20} rx={5} fill={f2} />
          <rect x={320} y={231} width={96} height={20} rx={5} fill={f1} />
          {/* pot */}
          <path d="M346 200 H402 L394 231 H354 Z" fill={f3} />
          <path d="M342 200 H406" />
          {/* leaves */}
          <path d="M374 200 C 372 168 372 150 374 132" />
          <path d="M374 176 C 356 168 344 150 340 128 C 362 132 374 150 376 172 Z" fill={f2} />
          <path d="M374 168 C 392 158 404 140 408 120 C 386 126 376 144 372 164 Z" fill={f2} />
          <path d="M374 150 C 366 132 366 118 372 104 C 384 116 384 134 378 152 Z" fill={f1} />
        </g>

        {/* stack of books in front */}
        <g>
          <rect x={244} y={252} width={150} height={17} rx={5} fill={f1} />
          <rect x={256} y={269} width={132} height={17} rx={5} fill={f3} />
          {/* spine ticks */}
          <path d="M262 252 v17" opacity={0.5} />
          <path d="M272 269 v17" opacity={0.5} />
        </g>
      </g>
    </svg>
  )
}
