import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveOnboarding } from '../lib/api'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type {
  DailyMinutes,
  FirstExam,
  HeardFrom,
  OnboardingAnswers,
  SelfLevel,
  StudyTimeframe,
  WeakArea,
} from '../types/profile'
import type { TargetBand } from '../types/profile'
import { BandCat, QuipBubble } from '../components/BandCat'
import { Chip, OptionCard } from '../components/choice'
import { GoalBandPicker } from '../components/GoalBandPicker'
import { Logo } from '../components/Logo'

// The one-time onboarding wizard (/welcome). ProtectedRoute funnels every
// account without profiles.onboarded_at here; finishing stamps it, so the
// questions are asked exactly once — never again on later logins. Answers
// personalize the dashboard today and feed the study-roadmap feature later.

const DRAFT_KEY = 'cefrly-onboarding-draft'
const STEP_COUNT = 8

type Draft = {
  firstName: string
  lastName: string
  firstExam?: FirstExam
  selfLevel?: SelfLevel
  targetBand: TargetBand
  studyTimeframe?: StudyTimeframe
  weakAreas: WeakArea[]
  dailyMinutes?: DailyMinutes
  heardFrom?: HeardFrom
  heardFromNote: string
}

const EMPTY_DRAFT: Draft = {
  firstName: '',
  lastName: '',
  targetBand: 'B2',
  weakAreas: [],
  heardFromNote: '',
}

const FIRST_EXAM_OPTIONS: { value: FirstExam; title: string; sub: string }[] = [
  { value: 'first_time', title: 'First time', sub: 'The format is new to me — I want it to feel predictable.' },
  { value: 'took_mock', title: 'I’ve taken mock tests', sub: 'I have a score, but not a plan yet.' },
  { value: 'took_real', title: 'I’ve taken the real exam', sub: 'I’m back to improve my result.' },
]

const LEVEL_OPTIONS: { value: SelfLevel; title: string; sub: string }[] = [
  { value: 'unknown', title: 'Not sure yet', sub: 'No problem — finding out is the whole point.' },
  { value: 'below_B1', title: 'Just starting out', sub: 'Simple everyday English is still a challenge.' },
  { value: 'B1', title: 'Around B1', sub: 'I manage familiar topics and everyday situations.' },
  { value: 'B2', title: 'Around B2', sub: 'I’m confident in most conversations and texts.' },
  { value: 'C1', title: 'Around C1', sub: 'I handle complex language comfortably.' },
  { value: 'C2', title: 'Around C2', sub: 'Near-native — I rarely struggle with anything.' },
]

const TIMEFRAME_OPTIONS: { value: StudyTimeframe; title: string; sub: string }[] = [
  { value: 'lt_1_month', title: 'Less than a month', sub: 'Focus on full tests and high-impact fixes.' },
  { value: '1_3_months', title: '1–3 months', sub: 'Build accuracy, timing, and review habits.' },
  { value: '3_6_months', title: '3–6 months', sub: 'Grow your score with steady practice.' },
  { value: 'no_date', title: 'No date yet', sub: 'Keep the plan flexible.' },
]

const WEAK_OPTIONS: { value: WeakArea; label: string }[] = [
  { value: 'reading', label: 'Reading' },
  { value: 'listening', label: 'Listening' },
  { value: 'writing', label: 'Writing' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'timing', label: 'Time management' },
]

const TIME_OPTIONS: { value: DailyMinutes; title: string; sub: string }[] = [
  { value: 15, title: '15 minutes', sub: 'Quick, focused exercises.' },
  { value: 30, title: '30 minutes', sub: 'One section at a time.' },
  { value: 60, title: '1 hour', sub: 'Full practice sessions.' },
  { value: 120, title: '2+ hours', sub: 'Intensive prep.' },
]

const SOURCE_OPTIONS: { value: HeardFrom; label: string }[] = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'friend_teacher', label: 'A friend or teacher' },
  { value: 'learning_centre', label: 'Learning centre' },
  { value: 'milliymock', label: 'MilliyMock' },
  { value: 'google', label: 'Google search' },
  { value: 'other', label: 'Other' },
]

const STEP_META: { title: string; sub: string; quip?: string }[] = [
  {
    title: 'What should we call you?',
    sub: 'Your name is how the cat greets you around here.',
    quip: 'First things first.',
  },
  {
    title: 'Is this your first CEFR exam?',
    sub: 'This shapes how we pace your prep.',
    quip: 'Be honest. I won’t judge.',
  },
  {
    title: 'Where’s your English right now?',
    sub: 'A guess is fine — the tests will tell us precisely.',
    quip: 'No pressure. Guessing is allowed.',
  },
  {
    // The goal picker brings its own cat, so this step has no header mascot.
    title: 'What’s your goal?',
    sub: 'Slide the cat to the level you’re aiming for.',
  },
  {
    title: 'How long until your exam?',
    sub: 'This helps us build your plan.',
    quip: 'A deadline focuses the whiskers.',
  },
  {
    title: 'What do you struggle with?',
    sub: 'Pick as many as you like — or none.',
    quip: 'We all have our weak paws.',
  },
  {
    title: 'How much time can you give English daily?',
    sub: 'Be realistic — small and daily beats big and rarely.',
    quip: 'Consistency. Says the cat who naps 16 hours.',
  },
  {
    title: 'How did you hear about Cefrly?',
    sub: 'Last one — it helps us reach more students.',
    quip: 'Just curious. For science.',
  },
]

function loadDraft(): { step: number; draft: Draft } {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { step?: number; draft?: Partial<Draft> }
      return {
        step: Math.min(Math.max(parsed.step ?? 0, 0), STEP_COUNT - 1),
        draft: { ...EMPTY_DRAFT, ...parsed.draft },
      }
    }
  } catch {
    // corrupt draft — start over
  }
  return { step: 0, draft: EMPTY_DRAFT }
}

export function WelcomePage() {
  const navigate = useNavigate()
  const { session, markOnboarded } = useAuth()
  const [{ step, draft }, setState] = useState(loadDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) return
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, draft }))
  }, [step, draft, done])

  const setDraft = (patch: Partial<Draft>) =>
    setState((s) => ({ ...s, draft: { ...s.draft, ...patch } }))
  const goTo = (next: number) => setState((s) => ({ ...s, step: next }))

  // Prefill the name from Google metadata once, only while it's untouched, so
  // OAuth users don't retype what we already know.
  const prefilledName = useRef(false)
  useEffect(() => {
    if (prefilledName.current) return
    if (draft.firstName || draft.lastName) {
      prefilledName.current = true
      return
    }
    const meta = session?.user.user_metadata as Record<string, unknown> | undefined
    const full = ((meta?.full_name as string) || (meta?.name as string) || '').trim()
    if (!full) return
    prefilledName.current = true
    const parts = full.split(/\s+/)
    setDraft({ firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const greetName = draft.firstName.trim()

  const canContinue = [
    !!draft.firstName.trim(),
    !!draft.firstExam,
    !!draft.selfLevel,
    true, // goal has a default
    !!draft.studyTimeframe,
    true, // struggles may be empty
    !!draft.dailyMinutes,
    !!draft.heardFrom,
  ][step]

  async function finish() {
    setSaving(true)
    setError(null)
    const note = draft.heardFromNote.trim()
    const answers: OnboardingAnswers = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim() || null,
      firstExam: draft.firstExam!,
      selfLevel: draft.selfLevel!,
      targetBand: draft.targetBand,
      studyTimeframe: draft.studyTimeframe!,
      weakAreas: draft.weakAreas,
      dailyMinutes: draft.dailyMinutes!,
      heardFrom: draft.heardFrom!,
      heardFromNote: note ? note.slice(0, 200) : null,
    }
    try {
      await saveOnboarding(answers)
      localStorage.removeItem(DRAFT_KEY)
      // NOTE: markOnboarded() waits for the finale CTA — flipping it now would
      // make ProtectedRoute bounce us off /welcome before the "All set" screen.
      setDone(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col bg-page px-5 py-8">
        <div className="mx-auto w-full max-w-xl">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center text-center">
          <QuipBubble>{greetName ? `Nice to meet you, ${greetName}.` : 'Nice to meet you.'}</QuipBubble>
          <div className="mt-3">
            <BandCat band={draft.targetBand} height={110} />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-heading">You’re all set!</h1>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">
            Goal locked: <span className="font-extrabold text-brand">{draft.targetBand}</span>. Your
            dashboard will keep it in sight — the fastest way to reach it is a real attempt.
          </p>
          <button
            type="button"
            onClick={() => {
              markOnboarded()
              navigate('/', { replace: true })
            }}
            className="mt-8 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
          >
            Go to my dashboard
          </button>
        </div>
      </div>
    )
  }

  const meta = STEP_META[step]

  return (
    <div className="min-h-screen bg-page px-5 py-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center justify-between">
          <Logo />
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="text-sm font-bold text-ink-soft hover:text-ink"
          >
            Sign out
          </button>
        </div>

        <div className="mt-8">
          <p className="tnum text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
            Step {step + 1} of {STEP_COUNT}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line/70">
            <div
              className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-500"
              style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-lift ring-1 ring-line/50 sm:p-8">
          {meta.quip && (
            <div className="mb-5 flex items-end gap-3">
              <BandCat height={48} />
              {/* key restarts the pop animation on every step */}
              <div key={step} className="pb-4">
                <QuipBubble>{meta.quip}</QuipBubble>
              </div>
            </div>
          )}
          <h1 className="text-2xl font-extrabold text-heading">{meta.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{meta.sub}</p>

          <div className="mt-6">
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="ob-first" className="mb-1.5 block text-sm font-bold text-ink">
                    First name
                  </label>
                  <input
                    id="ob-first"
                    type="text"
                    value={draft.firstName}
                    onChange={(e) => setDraft({ firstName: e.target.value })}
                    maxLength={60}
                    autoComplete="given-name"
                    placeholder="e.g. Aziz"
                    className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand"
                  />
                </div>
                <div>
                  <label htmlFor="ob-last" className="mb-1.5 block text-sm font-bold text-ink">
                    Surname <span className="font-semibold text-ink-faint">(optional)</span>
                  </label>
                  <input
                    id="ob-last"
                    type="text"
                    value={draft.lastName}
                    onChange={(e) => setDraft({ lastName: e.target.value })}
                    maxLength={60}
                    autoComplete="family-name"
                    placeholder="e.g. Karimov"
                    className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                {FIRST_EXAM_OPTIONS.map((o) => (
                  <OptionCard
                    key={o.value}
                    selected={draft.firstExam === o.value}
                    onClick={() => setDraft({ firstExam: o.value })}
                    title={o.title}
                    sub={o.sub}
                  />
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                {LEVEL_OPTIONS.map((o) => (
                  <OptionCard
                    key={o.value}
                    selected={draft.selfLevel === o.value}
                    onClick={() => setDraft({ selfLevel: o.value })}
                    title={o.title}
                    sub={o.sub}
                  />
                ))}
              </div>
            )}

            {step === 3 && (
              <GoalBandPicker
                value={draft.targetBand}
                onChange={(band) => setDraft({ targetBand: band })}
              />
            )}

            {step === 4 && (
              <div className="space-y-3">
                {TIMEFRAME_OPTIONS.map((o) => (
                  <OptionCard
                    key={o.value}
                    selected={draft.studyTimeframe === o.value}
                    onClick={() => setDraft({ studyTimeframe: o.value })}
                    title={o.title}
                    sub={o.sub}
                  />
                ))}
              </div>
            )}

            {step === 5 && (
              <div className="grid grid-cols-2 gap-2.5">
                {WEAK_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    selected={draft.weakAreas.includes(o.value)}
                    onClick={() =>
                      setDraft({
                        weakAreas: draft.weakAreas.includes(o.value)
                          ? draft.weakAreas.filter((w) => w !== o.value)
                          : [...draft.weakAreas, o.value],
                      })
                    }
                    label={o.label}
                  />
                ))}
              </div>
            )}

            {step === 6 && (
              <div className="space-y-3">
                {TIME_OPTIONS.map((o) => (
                  <OptionCard
                    key={o.value}
                    selected={draft.dailyMinutes === o.value}
                    onClick={() => setDraft({ dailyMinutes: o.value })}
                    title={o.title}
                    sub={o.sub}
                  />
                ))}
              </div>
            )}

            {step === 7 && (
              <div>
                <div className="grid grid-cols-2 gap-2.5">
                  {SOURCE_OPTIONS.map((o) => (
                    <Chip
                      key={o.value}
                      selected={draft.heardFrom === o.value}
                      onClick={() => setDraft({ heardFrom: o.value })}
                      label={o.label}
                    />
                  ))}
                </div>
                {draft.heardFrom === 'other' && (
                  <input
                    type="text"
                    value={draft.heardFromNote}
                    onChange={(e) => setDraft({ heardFromNote: e.target.value })}
                    maxLength={200}
                    placeholder="Where was it? (optional)"
                    className="mt-3 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand"
                  />
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
              Could not save your answers: {error}
            </p>
          )}

          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => goTo(step - 1)}
                className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
              >
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={!canContinue || saving}
              onClick={() => (step === STEP_COUNT - 1 ? finish() : goTo(step + 1))}
              className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {step === STEP_COUNT - 1 ? (saving ? 'Saving…' : 'Finish') : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
