import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMyProfile, updateNames, updateStudyPrefs } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { DailyMinutes, HeardFrom, StudyPrefs, StudyTimeframe, WeakArea } from '../types/profile'
import { Chip, OptionCard } from '../components/choice'
import { GoalBandPicker } from '../components/GoalBandPicker'

// Study preferences from onboarding, editable any time. Attribution
// (heard_from) is shown but write-once; onboarded_at is never touched here.

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

const TIMEFRAME_OPTIONS: { value: StudyTimeframe; title: string; sub: string }[] = [
  { value: 'lt_1_month', title: 'Less than a month', sub: 'Focus on full tests and high-impact fixes.' },
  { value: '1_3_months', title: '1–3 months', sub: 'Build accuracy, timing, and review habits.' },
  { value: '3_6_months', title: '3–6 months', sub: 'Grow your score with steady practice.' },
  { value: 'no_date', title: 'No date yet', sub: 'Keep the plan flexible.' },
]

const HEARD_LABEL: Record<HeardFrom, string> = {
  telegram: 'Telegram',
  instagram: 'Instagram',
  youtube: 'YouTube',
  friend_teacher: 'a friend or teacher',
  learning_centre: 'a learning centre',
  milliymock: 'MilliyMock',
  google: 'Google search',
  other: 'somewhere else',
}

function prefsOf(p: {
  targetBand: StudyPrefs['targetBand'] | null
  studyTimeframe: StudyTimeframe | null
  weakAreas: WeakArea[]
  dailyMinutes: DailyMinutes | null
}): StudyPrefs {
  return {
    targetBand: p.targetBand ?? 'B2',
    studyTimeframe: p.studyTimeframe ?? 'no_date',
    weakAreas: [...p.weakAreas].sort(),
    dailyMinutes: p.dailyMinutes ?? 30,
  }
}

export function SettingsPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({ queryKey: ['my-profile'], queryFn: fetchMyProfile, enabled: !!session })

  const [prefs, setPrefs] = useState<StudyPrefs | null>(null)
  const [names, setNames] = useState<{ firstName: string; lastName: string } | null>(null)
  useEffect(() => {
    if (profile) {
      setPrefs((current) => current ?? prefsOf(profile))
      setNames(
        (current) =>
          current ?? { firstName: profile.firstName ?? '', lastName: profile.lastName ?? '' },
      )
    }
  }, [profile])

  const save = useMutation({
    mutationFn: updateStudyPrefs,
    onSuccess: (updated) => {
      queryClient.setQueryData(['my-profile'], updated)
      setPrefs(prefsOf(updated))
    },
  })

  const saveNames = useMutation({
    mutationFn: () => updateNames(names!.firstName, names!.lastName),
    onSuccess: (updated) => {
      queryClient.setQueryData(['my-profile'], updated)
      setNames({ firstName: updated.firstName ?? '', lastName: updated.lastName ?? '' })
    },
  })

  const dirty =
    !!profile && !!prefs && JSON.stringify(prefs) !== JSON.stringify(prefsOf(profile))
  const nameDirty =
    !!profile &&
    !!names &&
    (names.firstName.trim() !== (profile.firstName ?? '').trim() ||
      names.lastName.trim() !== (profile.lastName ?? '').trim())

  if (isLoading || (!profile && !error)) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-9 w-48 rounded-xl" />
        <div className="skeleton h-72 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    )
  }
  if (error) {
    return (
      <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
        Could not load your settings: {(error as Error).message}
      </p>
    )
  }
  if (!prefs || !names) return null

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold text-heading">Settings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Your study preferences — the dashboard adapts to whatever you change here.
      </p>

      <div className="mt-6 space-y-5">
        <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-line/50 sm:p-7">
          <h2 className="font-extrabold text-heading">Your name</h2>
          <p className="mt-0.5 text-sm text-ink-soft">How Cefrly greets you across the app.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="set-first" className="mb-1.5 block text-sm font-bold text-ink">
                First name
              </label>
              <input
                id="set-first"
                type="text"
                value={names.firstName}
                onChange={(e) => setNames({ ...names, firstName: e.target.value })}
                maxLength={60}
                autoComplete="given-name"
                placeholder="e.g. Aziz"
                className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand"
              />
            </div>
            <div>
              <label htmlFor="set-last" className="mb-1.5 block text-sm font-bold text-ink">
                Surname <span className="font-semibold text-ink-faint">(optional)</span>
              </label>
              <input
                id="set-last"
                type="text"
                value={names.lastName}
                onChange={(e) => setNames({ ...names, lastName: e.target.value })}
                maxLength={60}
                autoComplete="family-name"
                placeholder="e.g. Karimov"
                className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand"
              />
            </div>
          </div>
          {saveNames.error && (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
              Could not save your name: {(saveNames.error as Error).message}
            </p>
          )}
          <div className="mt-4 flex items-center justify-end gap-3">
            {saveNames.isSuccess && !nameDirty && (
              <span className="text-sm font-bold text-ok">Saved ✓</span>
            )}
            <button
              type="button"
              disabled={!nameDirty || !names.firstName.trim() || saveNames.isPending}
              onClick={() => saveNames.mutate()}
              className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saveNames.isPending ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-line/50 sm:p-7">
          <h2 className="font-extrabold text-heading">Your goal</h2>
          <p className="mt-0.5 text-sm text-ink-soft">The level you’re working towards.</p>
          <div className="mt-4">
            <GoalBandPicker
              value={prefs.targetBand}
              onChange={(targetBand) => setPrefs({ ...prefs, targetBand })}
              name="settings-target-band"
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-line/50 sm:p-7">
          <h2 className="font-extrabold text-heading">Exam timeframe</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            How far off your exam is — drives the countdown on your dashboard.
          </p>
          <div className="mt-4 space-y-3">
            {TIMEFRAME_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                selected={prefs.studyTimeframe === o.value}
                onClick={() => setPrefs({ ...prefs, studyTimeframe: o.value })}
                title={o.title}
                sub={o.sub}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-line/50 sm:p-7">
          <h2 className="font-extrabold text-heading">Focus areas</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            What you’re struggling with — we flag these skills on your roadmap.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {WEAK_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                selected={prefs.weakAreas.includes(o.value)}
                onClick={() =>
                  setPrefs({
                    ...prefs,
                    weakAreas: prefs.weakAreas.includes(o.value)
                      ? prefs.weakAreas.filter((w) => w !== o.value)
                      : [...prefs.weakAreas, o.value].sort(),
                  })
                }
                label={o.label}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-line/50 sm:p-7">
          <h2 className="font-extrabold text-heading">Daily study time</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            How much time you can realistically give English each day.
          </p>
          <div className="mt-4 space-y-3">
            {TIME_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                selected={prefs.dailyMinutes === o.value}
                onClick={() => setPrefs({ ...prefs, dailyMinutes: o.value })}
                title={o.title}
                sub={o.sub}
              />
            ))}
          </div>
        </section>

        {profile?.heardFrom && (
          <p className="px-1 text-sm text-ink-soft">
            You told us you found Cefrly via{' '}
            <span className="font-bold text-ink">{HEARD_LABEL[profile.heardFrom]}</span>
            {profile.heardFrom === 'other' && profile.heardFromNote
              ? ` (“${profile.heardFromNote}”)`
              : ''}
            . Thanks — that stays as it is.
          </p>
        )}

        {save.error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
            Could not save: {(save.error as Error).message}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pb-4">
          {save.isSuccess && !dirty && (
            <span className="text-sm font-bold text-ok">Saved ✓</span>
          )}
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => prefs && save.mutate(prefs)}
            className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
