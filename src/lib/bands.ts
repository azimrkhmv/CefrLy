import type { Band } from '../types/test'

export const BAND_ORDER: Band[] = ['below_B1', 'B1', 'B2', 'C1']

// Raw-score thresholds (lower bound of each band out of 35). Used by the
// band ruler so the scale encodes the real scoring boundaries.
export const BAND_THRESHOLDS: Record<Band, number> = {
  below_B1: 0,
  B1: 10,
  B2: 18,
  C1: 28,
}

export const BAND_INFO: Record<
  Band,
  { label: string; className: string; range: string; blurb: string }
> = {
  C1: {
    label: 'C1',
    className: 'border border-line bg-white text-ink',
    range: '28–35',
    blurb: 'Advanced comprehension — you’re at the top of the scale.',
  },
  B2: {
    label: 'B2',
    className: 'border border-line bg-white text-ink',
    range: '18–27',
    blurb: 'Solid upper-intermediate comprehension. C1 is within reach.',
  },
  B1: {
    label: 'B1',
    className: 'border border-line bg-white text-ink',
    range: '10–17',
    blurb: 'A working foundation. Regular practice will take you to B2.',
  },
  below_B1: {
    label: 'Below B1',
    className: 'border border-line bg-white text-ink-soft',
    range: '0–9',
    blurb: 'A starting point. Study the explanations below and try again.',
  },
}
