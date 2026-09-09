// Icons shared by the auth surfaces. All stroke/fill colours come from theme
// tokens or currentColor — the only literal hexes are Google's four official
// brand colours, which must stay exact.

export function GoogleIcon() {
  return (
    <svg width={19} height={19} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18a13.2 13.2 0 0 1 0-8.36v-5.7H4.34a22.02 22.02 0 0 0 0 19.76l7.35-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 9.5c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 2.89 29.93 1 24 1 15.4 1 7.96 5.93 4.34 13.12l7.35 5.7C13.42 13.37 18.27 9.5 24 9.5Z"
      />
    </svg>
  )
}

export function EyeIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  )
}

export function EyeOffIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.3" />
      <path d="M6.5 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.2-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

export function ShieldIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function ChevronLeftIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

/** Decorative backdrop behind the desktop mascot (from the design's
 *  halo-curves.svg, since grown well past it). Inlined rather than shipped as a
 *  file so it costs no extra request and can use theme tokens instead of the
 *  source's hard-coded #8b5cf6. The C2PA provenance metadata in the original
 *  export is dropped — it was ~4 KB of base64 the browser never reads.
 *
 *  Three layers, back to front: two soft glows, a set of ripple rings centred
 *  under the cushion (the cat sits in the middle of them, so the panel reads as
 *  a calm pond rather than an empty half-page), and the sweeping arcs. Every
 *  stroke is painted with a horizontal gradient so lines dissolve at the panel
 *  edges instead of ending in a hard clipped stub. */
export function HaloCurves({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 500"
      fill="none"
      className={className}
      aria-hidden
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        <radialGradient
          id="cefrly-halo"
          cx={230}
          cy={430}
          r={280}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity={0.2} />
          <stop offset=".45" stopColor="var(--color-accent)" stopOpacity={0.09} />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity={0} />
        </radialGradient>
        {/* A second, cooler glow up and to the right, so the panel's empty
            middle is not perfectly flat. */}
        <radialGradient
          id="cefrly-halo-far"
          cx={470}
          cy={170}
          r={230}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--color-brand)" stopOpacity={0.08} />
          <stop offset="1" stopColor="var(--color-brand)" stopOpacity={0} />
        </radialGradient>
        {/* Fades every stroke out at both ends. */}
        <linearGradient id="cefrly-stroke" x1="0" y1="0" x2="600" y2="0"
          gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity={0} />
          <stop offset=".22" stopColor="var(--color-accent)" stopOpacity={1} />
          <stop offset=".78" stopColor="var(--color-accent)" stopOpacity={1} />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="cefrly-ripple" x1="0" y1="0" x2="600" y2="0"
          gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-brand)" stopOpacity={0} />
          <stop offset=".3" stopColor="var(--color-brand)" stopOpacity={1} />
          <stop offset=".7" stopColor="var(--color-brand)" stopOpacity={1} />
          <stop offset="1" stopColor="var(--color-brand)" stopOpacity={0} />
        </linearGradient>
      </defs>

      <circle cx={470} cy={170} r={230} fill="url(#cefrly-halo-far)" />
      <circle cx={230} cy={430} r={280} fill="url(#cefrly-halo)" />

      {/* Ripple rings under the cushion. Centred below the viewBox floor so
          only their upper arcs show — the cat stands in the middle of them. */}
      <g stroke="url(#cefrly-ripple)" fill="none" opacity={0.22}>
        <ellipse cx={175} cy={505} rx={140} ry={52} strokeWidth={1.2} />
        <ellipse cx={175} cy={508} rx={215} ry={80} strokeWidth={1} />
        <ellipse cx={175} cy={512} rx={300} ry={112} strokeWidth={0.9} />
      </g>

      {/* Sweeping arcs. Graduated weight and opacity so they read as a family
          with depth rather than three identical tramlines. */}
      <g
        stroke="url(#cefrly-stroke)"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M-40 470 C 120 300 320 260 640 400" strokeWidth={2.2} opacity={0.34} />
        <path d="M-40 400 C 140 210 360 190 640 320" strokeWidth={1.6} opacity={0.26} />
        <path d="M-40 330 C 160 130 400 120 640 240" strokeWidth={1.2} opacity={0.2} />
        <path d="M-40 258 C 180 52 430 46 640 158" strokeWidth={1} opacity={0.14} />
        {/* One dashed pass, offset just off the lead arc, for texture. */}
        <path
          d="M-40 432 C 130 254 340 224 640 358"
          strokeWidth={1.4}
          strokeDasharray="2 12"
          opacity={0.4}
        />
      </g>

      {/* A few motes sitting on the arcs — the detail that makes the backdrop
          look drawn rather than generated. */}
      <g fill="var(--color-accent)">
        <circle cx={92} cy={382} r={3} opacity={0.3} />
        <circle cx={318} cy={268} r={2.2} opacity={0.24} />
        <circle cx={462} cy={318} r={3.4} opacity={0.2} />
        <circle cx={228} cy={172} r={2} opacity={0.18} />
        <circle cx={540} cy={214} r={2.6} opacity={0.16} />
      </g>
    </svg>
  )
}
