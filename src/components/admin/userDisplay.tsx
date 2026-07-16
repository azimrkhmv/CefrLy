import { BAND_INFO } from '../../lib/bands'
import type { Band } from '../../types/test'
import type { UserRole } from '../../lib/adminApi'

// Shared presentation for the admin user directory + profile pages. Labels for
// the onboarding enums live here so the two pages can never drift apart.

export function BandPill({ band }: { band: Band }) {
  const info = BAND_INFO[band]
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${info.className}`}>
      {info.label}
    </span>
  )
}

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'super admin',
  admin: 'admin',
  student: 'student',
}

export function RoleChip({ role }: { role: UserRole }) {
  const isStaff = role === 'admin' || role === 'super_admin'
  return (
    <span
      className={`rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-bold ${
        isStaff ? 'text-brand' : 'text-ink-soft'
      }`}
    >
      {ROLE_LABEL[role]}
    </span>
  )
}

// --- onboarding enum labels -------------------------------------------------
// Mirrors the CHECK constraints on profiles (migrations 0009 + 0014).

export const FIRST_EXAM_LABEL: Record<string, string> = {
  first_time: 'First time taking it',
  took_mock: 'Has taken a mock before',
  took_real: 'Has taken the real exam',
}

export const SELF_LEVEL_LABEL: Record<string, string> = {
  unknown: 'Not sure',
  below_B1: 'Below B1',
  B1: 'Around B1',
  B2: 'Around B2',
  C1: 'Around C1',
  C2: 'Around C2',
}

export const TIMEFRAME_LABEL: Record<string, string> = {
  lt_1_month: 'Under a month away',
  '1_3_months': 'In 1–3 months',
  '3_6_months': 'In 3–6 months',
  no_date: 'No date set',
}

export const WEAK_AREA_LABEL: Record<string, string> = {
  reading: 'Reading',
  listening: 'Listening',
  writing: 'Writing',
  speaking: 'Speaking',
  vocabulary: 'Vocabulary',
  timing: 'Timing',
}

export const HEARD_FROM_LABEL: Record<string, string> = {
  telegram: 'Telegram',
  instagram: 'Instagram',
  youtube: 'YouTube',
  friend_teacher: 'Friend or teacher',
  learning_centre: 'Learning centre',
  milliymock: 'MilliyMock',
  google: 'Google',
  other: 'Other',
}

export const DAILY_MINUTES_LABEL: Record<number, string> = {
  15: '15 min / day',
  30: '30 min / day',
  60: '1 hour / day',
  120: '2 hours / day',
}

/** Enum → label, falling back to the raw value so unmapped rows still read. */
export function labelFor(map: Record<string, string>, value: string | null): string {
  if (!value) return '—'
  return map[value] ?? value
}

// --- dates ------------------------------------------------------------------

export function formatDay(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** "Today" / "3 days ago" / a date once it's old enough to not be useful. */
export function relativeDay(iso: string | null): string {
  if (!iso) return 'Never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return formatDay(iso)
}
