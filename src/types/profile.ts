import type { Band } from './test'

// Onboarding answers, collected once by the /welcome wizard right after
// registration (profiles.onboarded_at = the asked-once flag). Study prefs
// (goal/date/weak areas/time) stay editable in /settings; attribution is
// write-once. All of it feeds the future study-roadmap feature.

export type FirstExam = 'first_time' | 'took_mock' | 'took_real'
/** Self-assessed level at signup ('unknown' = "Not sure yet"). */
export type SelfLevel = 'unknown' | Band
export type TargetBand = 'B1' | 'B2' | 'C1'
export type WeakArea = 'reading' | 'listening' | 'writing' | 'speaking' | 'vocabulary' | 'timing'
export type DailyMinutes = 15 | 30 | 60 | 120
export type HeardFrom =
  | 'telegram'
  | 'instagram'
  | 'youtube'
  | 'friend_teacher'
  | 'learning_centre'
  | 'milliymock'
  | 'google'
  | 'other'

export interface OnboardingAnswers {
  firstExam: FirstExam
  selfLevel: SelfLevel
  targetBand: TargetBand
  /** First day of the chosen exam month (YYYY-MM-DD); null = not decided yet. */
  examMonth: string | null
  weakAreas: WeakArea[]
  dailyMinutes: DailyMinutes
  heardFrom: HeardFrom
  /** Free text when heardFrom is 'other'. */
  heardFromNote: string | null
}

/** The subset a student can edit later in /settings. */
export type StudyPrefs = Pick<
  OnboardingAnswers,
  'targetBand' | 'examMonth' | 'weakAreas' | 'dailyMinutes'
>

/** The signed-in user's profiles row (every answer nullable: rows predating
 *  the wizard, or a wizard not yet finished). */
export interface StudentProfile {
  id: string
  name: string | null
  onboardedAt: string | null
  firstExam: FirstExam | null
  selfLevel: SelfLevel | null
  targetBand: TargetBand | null
  examMonth: string | null
  weakAreas: WeakArea[]
  dailyMinutes: DailyMinutes | null
  heardFrom: HeardFrom | null
  heardFromNote: string | null
}
