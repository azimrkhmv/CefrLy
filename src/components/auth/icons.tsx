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

/** Decorative glow + arcs behind the desktop mascot (design: halo-curves.svg).
 *  Inlined rather than shipped as a file so it costs no extra request and can
 *  use the accent token instead of the source's hard-coded #8b5cf6. The C2PA
 *  provenance metadata in the original export is dropped — it was ~4 KB of
 *  base64 that the browser never reads. */
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
          cy={420}
          r={270}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity={0.14} />
          <stop offset=".45" stopColor="var(--color-accent)" stopOpacity={0.07} />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={230} cy={420} r={270} fill="url(#cefrly-halo)" />
      <g
        stroke="var(--color-accent)"
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.18}
      >
        <path d="M-40 470 C 120 300 320 260 640 400" />
        <path d="M-40 400 C 140 210 360 190 640 320" />
        <path d="M-40 330 C 160 130 400 120 640 240" />
      </g>
    </svg>
  )
}
