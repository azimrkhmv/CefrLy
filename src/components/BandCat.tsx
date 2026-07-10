import type { ReactNode } from 'react'
import type { Band } from '../types/test'

// The band-reactive mascot: one sitting cat per CEFR band, getting happier
// (and rounder) at every level — unimpressed below B1 up to the blissful C1
// chonk. All four are processed like cat-sit.png (transparent bg, lavender
// floor shadow kept, 520px tall). `w` is the rendered width at the shared
// 52px display height; whoever positions the cat on a scale clamps by half
// of it so the cat never hangs off the ends.
export const BAND_CAT: Record<Band, { src: string; w: number }> = {
  below_B1: { src: '/cat-band-below-b1.png', w: 40 },
  B1: { src: '/cat-band-b1.png', w: 41 },
  B2: { src: '/cat-band-b2.png', w: 45 },
  C1: { src: '/cat-band-c1.png', w: 53 },
}

/** The neutral base sitting cat (no band earned — demo surfaces). */
export const BASE_CAT = { src: '/cat-sit.png', w: 42 }

export const BAND_QUIP: Record<Band, string> = {
  below_B1: 'Everyone starts here.',
  B1: 'Climbing nicely.',
  B2: 'Look at you go.',
  C1: 'Top of the scale.',
}

/** The mascot at a given band (base cat when band is omitted). C2 is
 *  aspirational (no scorable band), so it reuses the blissful C1 chonk.
 *  Decorative — callers keep the accessible copy elsewhere. */
export function BandCat({ band, height = 52 }: { band?: Band | 'C2'; height?: number }) {
  const key = band === 'C2' ? 'C1' : band
  const cat = key ? BAND_CAT[key] : BASE_CAT
  return (
    <img
      src={cat.src}
      alt=""
      aria-hidden
      draggable={false}
      width={Math.round((cat.w / 52) * height)}
      height={height}
      className="block w-auto select-none"
      style={{ height }}
    />
  )
}

/** The small speech bubble that rides along with the mascot. */
export function QuipBubble({ children }: { children: ReactNode }) {
  return (
    <span className="bubble-pop block whitespace-nowrap rounded-2xl bg-brand-soft px-3 py-1 text-xs font-bold text-brand-deep">
      {children}
    </span>
  )
}
