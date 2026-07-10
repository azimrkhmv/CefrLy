import type { Band } from './test'

// Onboarding answers, collected once by the /welcome wizard right after
// registration (profiles.onboarded_at = the asked-once flag). Study prefs
// (goal/date/weak areas/time) stay editable in /settings; attribution is
// write-once. All of it feeds the future study-roadmap feature.

export type FirstExam = 'first_time' | 'took_mock' | 'took_real'
/** Self-assessed level at signup ('unknown' = "Not sure yet"). C2 is
 *  aspirational — the exam only grades up to C1 — but students may claim it. */
export type SelfLevel = 'unknown' | Band | 'C2'
/** The goal level. C2 sits above the exam's C1 ceiling (aspirational). */
export type TargetBand = 'B1' | 'B2' | 'C1' | 'C2'
/** How long until the exam / how long the student plans to prep. Replaces the
 *  old exact exam-month picker. */
export type StudyTimeframe = 'lt_1_month' | '1_3_months' | '3_6_months' | 'no_date'
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
  /** What the student wants to be called. */
  firstName: string
  /** Surname (optional). */
  lastName: string | null
  firstExam: FirstExam
  selfLevel: SelfLevel
  targetBand: TargetBand
  /** How far off the exam is; 'no_date' = undecided. */
  studyTimeframe: StudyTimeframe
  weakAreas: WeakArea[]
  dailyMinutes: DailyMinutes
  heardFrom: HeardFrom
  /** Free text when heardFrom is 'other'. */
  heardFromNote: string | null
}

/** The subset a student can edit later in /settings. */
export type StudyPrefs = Pick<
  OnboardingAnswers,
  'targetBand' | 'studyTimeframe' | 'weakAreas' | 'dailyMinutes'
>

/** The signed-in user's profiles row (every answer nullable: rows predating
 *  the wizard, or a wizard not yet finished). */
export interface StudentProfile {
  id: string
  name: string | null
  firstName: string | null
  lastName: string | null
  onboardedAt: string | null
  firstExam: FirstExam | null
  selfLevel: SelfLevel | null
  targetBand: TargetBand | null
  studyTimeframe: StudyTimeframe | null
  weakAreas: WeakArea[]
  dailyMinutes: DailyMinutes | null
  heardFrom: HeardFrom | null
  heardFromNote: string | null
}
