import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMyAttempts, fetchMyProfile } from '../lib/api'
import { fetchWritingAttempts } from '../lib/writingGrading'
import { fetchSpeakingAttempts } from '../lib/speakingGrading'
import { useAuth } from '../lib/auth'
import { useNavDrawer } from '../components/navDrawer'
import { BAND_INFO, BAND_ORDER, BAND_THRESHOLDS } from '../lib/bands'
import { skillMeta } from '../lib/skills'
import type { AttemptSummary } from '../types/attempt'
import type { Band } from '../types/test'
import type { SelfLevel, StudyTimeframe, WeakArea } from '../types/profile'
import { BandRuler } from '../components/BandRuler'
import { ScoreChart } from '../components/ScoreChart'
import { BAND_CAT, BAND_QUIP, BandCat, QuipBubble } from '../components/BandCat'
import { useCountUp } from '../lib/motion'
import { SHOW_WRITING } from '../lib/features'
import {
  ArrowRightIcon,
  BookIcon,
  ChevronDownIcon,
  ClipboardIcon,
  ClockIcon,
  HeadphonesIcon,
  MicIcon,
  PenIcon,
  PlayIcon,
  StarIcon,
  TrendUpIcon,
} from '../components/icons'

const MAX = 35
// Glass cards over the app background (owner design 2026-09-24): mostly-white
// frosted fill so text contrast never depends on the art behind, a white
// hairline edge and a soft brand-tinted shadow.
const CARD = 'rounded-[24px] bg-white/75 shadow-soft ring-1 ring-white/80 backdrop-blur-md'
const CARD_HERO = 'rounded-[28px] bg-white/80 shadow-lift ring-1 ring-white/80 backdrop-blur-md'
const KICKER = 'text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft'

/** A full-mock attempt — the only kind that carries a CEFR band. Part drills
 *  (scope 'part', band null) never reach the level/stat surfaces. */
type BandedAttempt = AttemptSummary & { band: Band }

// Mid-band scores used by the ?band= preview when no &score= is given.
const PREVIEW_SCORE: Record<Band, number> = { below_B1: 5, B1: 14, B2: 23, C1: 32 }

// The exam-countdown chip label, from the onboarding study timeframe.
const TIMEFRAME_CHIP: Record<Exclude<StudyTimeframe, 'no_date'>, string> = {
  lt_1_month: 'Exam under a month away',
  '1_3_months': 'Exam in 1–3 months',
  '3_6_months': 'Exam in 3–6 months',
}

function greetingName(email?: string, meta?: Record<string, unknown>): string {
  const raw =
    (meta?.full_name as string | undefined) ||
    (meta?.name as string | undefined) ||
    email?.split('@')[0] ||
    ''
  const first = raw.split(/[ ._-]/)[0]
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : ''
}

/** A change since the previous mock. Only ever built from real attempts. */
type Delta = { text: string; up: boolean; title: string }

function DeltaChip({ delta }: { delta: Delta }) {
  return (
    <span
      title={delta.title}
      // Under the number until the tiles are wide enough (2xl): a corner chip
      // collided with "Mocks taken" / "Average" in narrower tiles, up to and
      // including 1280px. 2xl and up: pinned to the tile's top-right corner.
      className={`tnum mt-1.5 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold 2xl:absolute 2xl:right-4 2xl:top-4 2xl:mt-0 ${
        delta.up ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
      }`}
    >
      <span aria-hidden>{delta.up ? '↑' : '↓'}</span> {delta.text}
      <span className="sr-only"> ({delta.title})</span>
    </span>
  )
}

function StatTile({
  Icon,
  label,
  value,
  sub,
  delta,
}: {
  Icon: (props: { width?: number; height?: number }) => React.ReactElement
  label: string
  value: string
  sub?: string
  delta?: Delta | null
}) {
  return (
    <div className={`relative flex items-center gap-4 p-5 ${CARD}`}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon width={22} height={22} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-soft">{label}</p>
        {/* the band pill must never wrap INTERNALLY ("Below / B1"); when the
            tile is too narrow the whole pill moves below the number instead */}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="tnum text-2xl font-extrabold text-heading">{value}</span>
          {sub && (
            <span className="whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand">
              {sub}
            </span>
          )}
        </p>
        {delta && <DeltaChip delta={delta} />}
      </div>
    </div>
  )
}

type ExamChip = { label: string; past: boolean }

/**
 * The reading cat that owns the top-right of both hero cards, with the exam
 * timeframe spoken as advice out of its mouth rather than filed as a chip in
 * the page header.
 */
function HeroCat({ exam, width, height }: { exam?: ExamChip | null; width: number; height: number }) {
  return (
    // ml-auto: on a phone the cat wraps onto its own line, and must still sit
    // on the right of the card, not drift to the left edge. -mr-5 pulls it into
    // the card's 28px padding so it sits almost against the edge (owner call
    // 2026-09-21); desktop keeps the normal padding.
    <div className="relative -mr-5 ml-auto flex shrink-0 items-start sm:mr-0">
      {exam && (
        <Link
          to="/settings"
          title="Change your timeframe in Settings"
          className="relative top-8 mr-2.5 max-w-[128px] rounded-xl bg-sun-soft px-2.5 py-1.5 text-[11px] font-bold leading-snug text-sun-ink shadow-card transition-colors hover:bg-sun/40 sm:max-w-[172px]"
        >
          <ClockIcon width={12} height={12} className="mr-1 inline align-[-1px]" />
          {exam.label}
          <span
            aria-hidden
            className="absolute -right-1 top-3.5 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-sun-soft"
          />
        </Link>
      )}
      <img
        src="/cat-read-grey.png"
        alt=""
        aria-hidden
        draggable={false}
        width={width}
        height={height}
        className="h-[150px] w-auto select-none"
      />
    </div>
  )
}

function LevelSnapshot({
  best,
  selfLevel,
  exam,
}: {
  best: BandedAttempt
  selfLevel?: SelfLevel | null
  exam?: ExamChip | null
}) {
  // The level the student claimed at onboarding owns this card; test results
  // only take over when there is nothing to fall back on ("Not sure yet", or
  // a profile predating the wizard).
  const selfBand = selfLevel && selfLevel !== 'unknown' ? selfLevel : null
  // The claimed/earned level may be C2 (aspirational); the ruler + cat visuals
  // top out at C1, so clamp there for display while keeping the C2 label.
  const actualLevel: Band | 'C2' = selfBand ?? best.band
  const displayBand: Band = actualLevel === 'C2' ? 'C1' : actualLevel
  const displayLabel = actualLevel === 'C2' ? 'C2' : BAND_INFO[displayBand].label
  // Self-assessed: no real marks, so seat the cat exactly on the band's own
  // mark (its threshold) — right above the band label, never mid-band.
  const rulerScore = selfBand ? BAND_THRESHOLDS[displayBand] : best.rawScore
  const score = useCountUp(best.rawScore)
  const meta = skillMeta(best.skill)
  return (
    <section className={`${CARD_HERO} p-7 sm:p-9`}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className={KICKER}>
            {selfBand ? 'Your current level' : `Your indicative ${meta.label.toLowerCase()} level`}
          </p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-[40px] font-extrabold leading-none text-heading">
              {displayLabel}
            </span>
            {selfBand ? (
              <span className="mb-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand">
                Self-assessed
              </span>
            ) : (
              <span className="tnum pb-1 text-lg font-bold text-ink-soft">
                {score}/{best.total} best
              </span>
            )}
          </div>
        </div>
        {/* the reading-book cat from the first-test hero keeps its seat here
            once attempts exist — it must never disappear from Home */}
        <HeroCat exam={exam} width={138} height={150} />
      </div>

      <div className="mt-2 pt-20">
        <BandRuler
          band={displayBand}
          score={rulerScore}
          animate
          topper={<BandCat band={displayBand} />}
          topperHalfWidth={Math.ceil(BAND_CAT[displayBand].w / 2)}
          topperBubble={<QuipBubble>{BAND_QUIP[displayBand]}</QuipBubble>}
        />
      </div>

    </section>
  )
}

const SKILLS = [
  { key: 'reading', name: 'Reading', Icon: BookIcon, to: '/reading' },
  { key: 'listening', name: 'Listening', Icon: HeadphonesIcon, to: '/listening' },
  // Concealed: `to: null` makes the card render as an inert "soon" tile.
  { key: 'writing', name: 'Writing', Icon: PenIcon, to: SHOW_WRITING ? '/writing' : null },
  { key: 'speaking', name: 'Speaking', Icon: MicIcon, to: '/speaking' },
] as const

type SkillKey = (typeof SKILLS)[number]['key']
/** Best FULL-paper mark per skill: /35 for Reading and Listening, the /75
 *  rating for Writing and Speaking. Drills never count (they carry no band). */
type SkillBest = Partial<Record<SkillKey, { score: number; total: number }>>

function SkillsRoadmap({ weakAreas, bests }: { weakAreas?: WeakArea[]; bests: SkillBest }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-extrabold text-heading">Your CEFR skills</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SKILLS.map(({ key, name, Icon, to }) => {
          const focus = weakAreas?.includes(key as WeakArea) ?? false
          const best = bests[key]
          const pct = best ? Math.round((best.score / best.total) * 100) : 0
          const body = (
            <>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <Icon width={22} height={22} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-extrabold ${to ? 'text-heading' : 'text-ink-soft'}`}>{name}</p>
                  {/* the student named this skill a struggle at onboarding */}
                  {focus ? (
                    <span className="rounded-full bg-sun-soft px-2 py-0.5 text-[10px] font-bold text-sun-ink">
                      Your focus
                    </span>
                  ) : to ? (
                    <ChevronDownIcon
                      width={16}
                      height={16}
                      className="-rotate-90 text-ink-soft transition-transform group-hover:translate-x-0.5"
                    />
                  ) : null}
                </div>
                <p className="tnum mt-1 text-right text-xs font-bold text-ink-soft">
                  {!to ? 'Coming soon' : best ? `${best.score}/${best.total}` : 'Not taken yet'}
                </p>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-brand-soft" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-linear-to-r from-brand to-accent"
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </div>
            </>
          )
          const cls = `group flex items-center gap-4 p-4 ${CARD}`
          return to ? (
            <Link
              key={key}
              to={to}
              aria-label={`${name}${best ? `, best ${best.score} out of ${best.total}` : ''}`}
              className={`${cls} transition-shadow hover:shadow-pop`}
            >
              {body}
            </Link>
          ) : (
            <div key={key} className={`${cls} opacity-80`}>
              {body}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RecentActivity({ attempts }: { attempts: AttemptSummary[] }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-extrabold text-heading">Recent activity</h2>
        <Link to="/dashboard" className="text-sm font-bold text-brand hover:underline">
          See all
        </Link>
      </div>
      <div className={`${CARD} divide-y divide-line`}>
        {attempts.slice(0, 3).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-heading">{a.testTitle}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] ${skillMeta(a.skill).chip}`}
                >
                  {skillMeta(a.skill).label}
                </span>
                {a.scope === 'part' && (
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-brand">
                    Part {a.partNumber}
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-soft">
                {new Date(a.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="tnum text-lg font-extrabold text-heading">
                {a.rawScore}/{a.total}
              </span>
              {/* part drills carry no CEFR band */}
              {a.band && (
                <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${BAND_INFO[a.band].className}`}>
                  {BAND_INFO[a.band].label}
                </span>
              )}
              <Link
                to={a.skill === 'listening' ? `/review/${a.id}` : `/analyze/${a.id}`}
                className="inline-flex items-center rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-brand hover:text-brand"
              >
                Review
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function NewUserHome({ exam }: { exam?: ExamChip | null }) {
  const openNav = useNavDrawer()
  const steps = [
    { n: 1, t: 'Take a mock test', d: 'A full CEFR reading paper, timed like the real exam.' },
    { n: 2, t: 'Get your band', d: 'An instant indicative CEFR level from your score out of 35.' },
    { n: 3, t: 'Learn from every answer', d: 'See the correct answer and why, for each question.' },
  ]
  return (
    <>
      <section className={`${CARD_HERO} overflow-hidden p-7 sm:p-9`}>
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-0 flex-1 basis-72">
            <p className={KICKER}>Start here</p>
            <h2 className="mt-2 text-2xl font-extrabold text-heading">Discover your real CEFR level</h2>
            {/* Desktop only: on a phone it pushed the band ruler below the fold
                (owner call 2026-09-21). */}
            <p className="mt-2 hidden max-w-md text-ink-soft sm:block">
              Take your first mock reading test — 35 questions, 5 parts, 60 minutes — and get an
              indicative band with an explanation for every answer.
            </p>
            <button
              type="button"
              onClick={openNav}
              className="group mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              <PlayIcon width={15} height={15} /> Start your first test
              <ArrowRightIcon
                width={15}
                height={15}
                className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
              />
            </button>
          </div>
          <HeroCat exam={exam} width={150} height={163} />
        </div>
        <div className="mt-8 max-w-xl pt-20 sm:pt-24">
          <BandRuler
            demo
            animate
            topper={<BandCat band="C1" />}
            topperHalfWidth={Math.ceil(BAND_CAT.C1.w / 2)}
            topperBubble={<QuipBubble>This seat’s waiting for you.</QuipBubble>}
          />
        </div>
      </section>

      {/* Desktop only (owner call 2026-09-21): on a phone three stacked cards
          were a long scroll between the hero and the skills. */}
      <section className="hidden sm:block">
        <h2 className="mb-4 text-xl font-extrabold text-heading">How it works</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className={`${CARD} p-5`}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-extrabold text-white">
                {s.n}
              </span>
              <p className="mt-3 font-extrabold text-heading">{s.t}</p>
              <p className="mt-1 text-sm text-ink-soft">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function HomeSkeleton() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-44 rounded-2xl" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    </div>
  )
}

export function HomePage() {
  const { session } = useAuth()
  const openNav = useNavDrawer()
  const {
    data: attempts,
    isLoading,
    error,
  } = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts, enabled: !!session })

  // Onboarding answers personalize the page (goal flag, exam countdown, focus
  // badges); the page renders fine while — or if — this is still loading.
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: fetchMyProfile,
    enabled: !!session,
  })
  // Best Writing/Speaking marks for the skills row. Same query keys as My
  // results, so the two pages share one cached copy.
  const { data: writingAttempts } = useQuery({
    queryKey: ['writing-attempts'],
    queryFn: fetchWritingAttempts,
    enabled: !!session,
  })
  const { data: speakingAttempts } = useQuery({
    queryKey: ['speaking-attempts'],
    queryFn: fetchSpeakingAttempts,
    enabled: !!session,
  })
  const exam =
    profile?.studyTimeframe && profile.studyTimeframe !== 'no_date'
      ? { label: TIMEFRAME_CHIP[profile.studyTimeframe], past: false }
      : null

  const name =
    profile?.firstName?.trim() ||
    greetingName(
      session?.user.email,
      session?.user.user_metadata as Record<string, unknown> | undefined,
    )
  // The CEFR surfaces (level snapshot, stat tiles, sparkline) speak in
  // full-mock terms — a part drill has no band and its small score can't sit
  // on the /35 axis. Recent activity still lists every attempt.
  const fullAttempts = (attempts ?? []).filter(
    (a): a is BandedAttempt => a.scope !== 'part' && a.band !== null,
  )
  const hasAttempts = fullAttempts.length > 0
  const hasAnyAttempts = !!attempts && attempts.length > 0

  const best = hasAttempts
    ? fullAttempts.reduce((a, b) => (b.rawScore > a.rawScore ? b : a))
    : null

  // PREVIEW: /?band=C1 (optionally &score=NN) shows the level snapshot as if
  // that band were earned — for eyeballing the band-specific ruler cats
  // without faking attempt history. Same spirit as /login?cat=. Only the
  // snapshot is overridden; stats/sparkline/activity stay real.
  const [params] = useSearchParams()
  const rawBand = params.get('band')
  const previewBand = rawBand
    ? BAND_ORDER.find((b) => b.toLowerCase() === rawBand.toLowerCase())
    : undefined
  const snapshot =
    best && previewBand
      ? {
          ...best,
          band: previewBand,
          rawScore: Math.min(MAX, Math.max(0, Number(params.get('score')) || PREVIEW_SCORE[previewBand])),
        }
      : best
  const latest = hasAttempts ? fullAttempts[0] : null
  const avg = hasAttempts
    ? Math.round(fullAttempts.reduce((sum, a) => sum + a.rawScore, 0) / fullAttempts.length)
    : 0
  const chron = hasAttempts ? [...fullAttempts].reverse().map((a) => a.rawScore) : []
  // The chart shows the most recent eight, like the design.
  const trend = chron.slice(-8)

  // Deltas: what the LATEST mock changed. All from real attempts; a chip is
  // only shown when there is something to compare against and it moved.
  const prev = fullAttempts.slice(1) // every mock before the latest
  const fmt = (n: number) => (Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(1))
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
  const thisWeek = fullAttempts.filter((a) => new Date(a.createdAt).getTime() >= weekAgo).length
  const deltas: Record<'mocks' | 'avg' | 'best' | 'latest', Delta | null> = {
    mocks: thisWeek > 0 ? { text: `+${thisWeek}`, up: true, title: `${thisWeek} in the last 7 days` } : null,
    avg: null,
    best: null,
    latest: null,
  }
  if (latest && prev.length > 0) {
    const prevAvg = prev.reduce((sum, a) => sum + a.rawScore, 0) / prev.length
    const exactAvg = fullAttempts.reduce((sum, a) => sum + a.rawScore, 0) / fullAttempts.length
    const dAvg = Math.round((exactAvg - prevAvg) * 10) / 10
    if (dAvg !== 0) deltas.avg = { text: `${dAvg > 0 ? '+' : '-'}${fmt(dAvg)}`, up: dAvg > 0, title: 'change in your average after your latest mock' }
    const prevBest = Math.max(...prev.map((a) => a.rawScore))
    if (best!.rawScore > prevBest) deltas.best = { text: `+${best!.rawScore - prevBest}`, up: true, title: 'your latest mock set a new best' }
    const dLatest = latest.rawScore - prev[0].rawScore
    if (dLatest !== 0) deltas.latest = { text: `${dLatest > 0 ? '+' : '-'}${Math.abs(dLatest)}`, up: dLatest > 0, title: 'compared with the mock before it' }
  }

  const skillBests: SkillBest = {}
  for (const a of fullAttempts) {
    const k = a.skill as SkillKey
    if ((k === 'reading' || k === 'listening') && a.rawScore > (skillBests[k]?.score ?? -1)) {
      skillBests[k] = { score: a.rawScore, total: a.total }
    }
  }
  for (const [k, rows] of [['writing', writingAttempts], ['speaking', speakingAttempts]] as const) {
    for (const r of rows ?? []) {
      if (r.status === 'done' && r.scope === 'full' && r.rating != null && r.rating > (skillBests[k]?.score ?? -1)) {
        skillBests[k] = { score: r.rating, total: 75 }
      }
    }
  }

  return (
    <div className="space-y-10">
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-heading sm:text-[34px]">
            {hasAttempts ? 'Welcome back' : 'Welcome to Cefrly'}
            {name && (
              <>
                , <span className="text-accent-deep">{name}</span>
              </>
            )}
          </h1>
          <p className="mt-1 text-[15px] font-semibold text-ink-soft">
            {hasAttempts
              ? 'Keep going! You’re building real progress.'
              : 'Let’s find your English level and build from there.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasAttempts && (
            <button
              type="button"
              onClick={openNav}
              className="group inline-flex items-center gap-2 rounded-full bg-linear-to-r from-accent-deep to-brand px-6 py-3 text-sm font-bold text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--color-brand)_26%,transparent)] transition-[filter] hover:brightness-110"
            >
              Start a test
              <ArrowRightIcon
                width={15}
                height={15}
                className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
              />
            </button>
          )}
        </div>
      </div>

      {isLoading && <HomeSkeleton />}

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          Could not load your progress: {(error as Error).message}
        </p>
      )}

      {attempts && !hasAttempts && <NewUserHome exam={exam} />}

      {hasAttempts && (
        <>
          <LevelSnapshot
            best={snapshot!}
            // ?band= previews the earned-band card, so it suppresses the
            // self-assessed override.
            selfLevel={previewBand ? null : profile?.selfLevel}
            exam={exam}
          />

          <section className={chron.length >= 2 ? 'grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.15fr]' : ''}>
            <div className="grid grid-cols-2 gap-4">
              <StatTile Icon={ClipboardIcon} label="Mocks taken" value={String(fullAttempts.length)} delta={deltas.mocks} />
              <StatTile Icon={TrendUpIcon} label="Average" value={`${avg}/${MAX}`} delta={deltas.avg} />
              <StatTile
                Icon={StarIcon}
                label="Best"
                value={`${best!.rawScore}/${MAX}`}
                sub={BAND_INFO[best!.band].label}
                delta={deltas.best}
              />
              <StatTile
                Icon={ClockIcon}
                label="Latest"
                value={`${latest!.rawScore}/${MAX}`}
                sub={BAND_INFO[latest!.band].label}
                delta={deltas.latest}
              />
            </div>
            {chron.length >= 2 && (
              <div className={`${CARD} p-5`}>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-extrabold text-heading">Score trend</p>
                  <p className="tnum rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-ink-soft ring-1 ring-line">
                    Last {trend.length} attempts
                  </p>
                </div>
                <div className="mt-3">
                  <ScoreChart scores={trend} max={MAX} />
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <SkillsRoadmap weakAreas={profile?.weakAreas} bests={skillBests} />

      {hasAnyAttempts && <RecentActivity attempts={attempts!} />}
    </div>
  )
}
