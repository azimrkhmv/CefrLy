import type { Band } from '../types/test'

export const BAND_ORDER: Band[] = ['below_B1', 'B1', 'B2', 'C1']

export const BAND_INFO: Record<
  Band,
  { label: string; className: string; range: string; blurb: string }
> = {
  C1: {
    label: 'C1',
    className: 'bg-emerald-100 text-emerald-800',
    range: '28–35',
    blurb: 'Outstanding — your reading is at an advanced level. Keep it sharp!',
  },
  B2: {
    label: 'B2',
    className: 'bg-sky-100 text-sky-800',
    range: '18–27',
    blurb: 'Great work — solid upper-intermediate reading. C1 is within reach.',
  },
  B1: {
    label: 'B1',
    className: 'bg-amber-100 text-amber-800',
    range: '10–17',
    blurb: 'A good foundation — keep practising and B2 will follow.',
  },
  below_B1: {
    label: 'Below B1',
    className: 'bg-rose-100 text-rose-800',
    range: '0–9',
    blurb: 'Every strong reader started here — study the explanations below and try again.',
  },
}
