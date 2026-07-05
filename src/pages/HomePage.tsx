import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMyAttempts } from '../lib/api'
import { useAuth } from '../lib/auth'
import { BAND_INFO, BAND_ORDER, BAND_THRESHOLDS } from '../lib/bands'
import { skillMeta } from '../lib/skills'
import type { AttemptSummary } from '../types/attempt'
import type { Band } from '../types/test'
import { BandRuler } from '../components/BandRuler'
import { useCountUp } from '../lib/motion'
import {
  ArrowRightIcon,
  BookIcon,
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
// Borderless elevated cards (the "adorned" look): soft lavender shadow + a
// half-opacity hairline so they don't wash out on the pale page.
const CARD = 'rounded-2xl bg-white shadow-soft ring-1 ring-line/50'
const CARD_HERO = 'rounded-2xl bg-white shadow-lift ring-1 ring-line/50'
const KICKER = 'text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft'

// One sitting cat; its speech bubble does the band reactivity.
const RULER_QUIP: Record<Band, string> = {
  below_B1: 'Everyone starts here.',
  B1: 'Climbing nicely.',
  B2: 'Look at you go.',
  C1: 'Top of the scale.',
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

// The mascot that rides the CEFR ruler to the student's score. Decorative — the
// score + "N marks" sentence below stay the accessible source of truth.
function RulerCat({ quip }: { quip: string }) {
  return (
    <span className="flex flex-col items-center">
      <span
        className="bubble-pop mb-1 whitespace-nowrap rounded-2xl bg-brand-soft px-3 py-1 text-xs font-bold text-brand-deep"
        aria-hidden
      >
        {quip}
      </span>
      <img
        src="/cat-sit.png"
        alt=""
        aria-hidden
        draggable={false}
        width={52}
        height={65}
        className="block h-[52px] w-auto select-none"
      />
      <span className="-mt-1 h-1.5 w-9 rounded-full bg-brand/10 blur-[2px]" aria-hidden />
    </span>
  )
}

function StatTile({
  Icon,
  label,
  value,
  sub,
}: {
  Icon: (props: { width?: number; height?: number }) => React.ReactElement
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className={`flex items-center gap-4 p-5 ${CARD}`}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon width={22} height={22} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-soft">{label}</p>
        <p className="mt-0.5 flex items-center gap-2">
          <span className="tnum text-2xl font-extrabold text-heading">{value}</span>
          {sub && (
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand">
              {sub}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

// Sparkline of raw scores over time with faint band-threshold guides and an
// HTML "you are here" dot on the last point (stays round despite the stretch).
function Sparkline({ scores }: { scores: number[] }) {
  const W = 600
  const H = 76
  const pad = 8
  const x = (i: number) => pad + (i / Math.max(1, scores.length - 1)) * (W - 2 * pad)
  const y = (s: number) => H - pad - (s / MAX) * (H - 2 * pad)
  const line = scores.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s).toFixed(1)}`).join(' ')
  const area = `${line} L${x(scores.length - 1).toFixed(1)} ${H - pad} L${x(0).toFixed(1)} ${H - pad} Z`
  const lastPct = { left: (x(scores.length - 1) / W) * 100, top: (y(scores[scores.length - 1]) / H) * 100 }
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[76px] w-full" aria-hidden>
        {[10, 18, 28].map((t) => (
          <line
            key={t}
            x1={0}
            x2={W}
            y1={y(t)}
            y2={y(t)}
            className="text-line"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} className="text-brand" fill="currentColor" opacity={0.09} />
        <path
          d={line}
          className="text-brand"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-2 ring-white"
        style={{ left: `${lastPct.left}%`, top: `${lastPct.top}%` }}
        aria-hidden
      />
    </div>
  )
}

function LevelSnapshot({ best }: { best: AttemptSummary }) {
  const score = useCountUp(best.rawScore)
  const idx = BAND_ORDER.indexOf(best.band)
  const nextBand = idx < BAND_ORDER.length - 1 ? BAND_ORDER[idx + 1] : null
  const toNext = nextBand ? Math.max(0, BAND_THRESHOLDS[nextBand] - best.rawScore) : 0
  const meta = skillMeta(best.skill)
  return (
    <section className={`${CARD_HERO} p-7 sm:p-9`}>
      <p className={KICKER}>Your indicative {meta.label.toLowerCase()} level</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-[40px] font-extrabold leading-none text-heading">
          {BAND_INFO[best.band].label}
        </span>
        <span className="tnum pb-1 text-lg font-bold text-ink-soft">
          {score}/{best.total} best
        </span>
      </div>
      <p className="mt-2 max-w-md text-sm text-ink-soft">{BAND_INFO[best.band].blurb}</p>

      <div className="mt-6 pt-20 sm:pt-24">
        <BandRuler band={best.band} score={best.rawScore} animate topper={<RulerCat quip={RULER_QUIP[best.band]} />} />
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        {nextBand && toNext > 0 ? (
          <>
            <span className="font-extrabold text-brand">
              {toNext} more mark{toNext > 1 ? 's' : ''}
            </span>{' '}
            to reach {BAND_INFO[nextBand].label}.
          </>
        ) : (
          <>You’re at the top of the {meta.label.toLowerCase()} scale — keep it sharp.</>
        )}{' '}
        <Link to={meta.to} className="font-bold text-brand hover:underline">
          Practice →
        </Link>
      </p>
    </section>
  )
}

const SKILLS = [
  { key: 'reading', name: 'Reading', Icon: BookIcon, desc: '35 questions · 5 parts · 60 min', to: '/reading', tile: 'bg-brand-soft text-brand' },
  { key: 'listening', name: 'Listening', Icon: HeadphonesIcon, desc: '35 questions · 6 parts · ~35 min', to: '/listening', tile: 'bg-sun-soft text-sun-ink' },
  { key: 'writing', name: 'Writing', Icon: PenIcon, desc: 'Essay & email tasks', to: null, tile: 'bg-emerald-50 text-emerald-800' },
  { key: 'speaking', name: 'Speaking', Icon: MicIcon, desc: 'Interview & talk', to: null, tile: 'bg-rose-50 text-rose-800' },
] as const

function SkillsRoadmap() {
  return (
    <section>
      <h2 className="mb-4 text-xl font-extrabold text-heading">Your CEFR skills</h2>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {SKILLS.map(({ key, name, Icon, desc, to, tile }) => {
          const available = to !== null
          return (
            <div key={key} className={`${CARD} p-5 ${available ? '' : 'opacity-80'}`}>
              <div className="flex items-center justify-between">
                <span className={`grid h-12 w-12 place-items-center rounded-xl ${tile}`}>
                  <Icon width={22} height={22} />
                </span>
                {available ? (
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand">
                    Available
                  </span>
                ) : (
                  <span className="rounded-full bg-page px-2.5 py-0.5 text-[11px] font-bold lowercase text-ink-soft">
                    soon
                  </span>
                )}
              </div>
              <p className={`mt-3 font-extrabold ${available ? 'text-heading' : 'text-ink-soft'}`}>{name}</p>
              <p className="mt-0.5 text-sm text-ink-soft">{desc}</p>
              {to ? (
                <Link
                  to={to}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  Practice <ArrowRightIcon width={15} height={15} />
                </Link>
              ) : (
                <p className="mt-4 text-sm font-semibold text-ink-soft">Coming soon</p>
              )}
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
              </div>
              <p className="text-sm text-ink-soft">
                {new Date(a.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="tnum text-lg font-extrabold text-heading">
                {a.rawScore}/{a.total}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${BAND_INFO[a.band].className}`}>
                {BAND_INFO[a.band].label}
              </span>
              <Link
                to={`/results/${a.id}`}
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

function NewUserHome() {
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
            <p className="mt-2 max-w-md text-ink-soft">
              Take your first mock reading test — 35 questions, 5 parts, 60 minutes — and get an
              indicative band with an explanation for every answer.
            </p>
            <Link
              to="/reading"
              className="group mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              <PlayIcon width={15} height={15} /> Start your first test
              <ArrowRightIcon
                width={15}
                height={15}
                className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
              />
            </Link>
          </div>
          <img
            src="/cat-read-grey.png"
            alt=""
            aria-hidden
            draggable={false}
            width={150}
            height={163}
            className="h-[150px] w-auto select-none"
          />
        </div>
        <div className="mt-8 max-w-xl pt-20 sm:pt-24">
          <BandRuler demo animate topper={<RulerCat quip="This seat’s waiting for you." />} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-extrabold text-heading">How it works</h2>
        <div className="grid gap-5 sm:grid-cols-3">
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
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    </div>
  )
}

export function HomePage() {
  const { session } = useAuth()
  const {
    data: attempts,
    isLoading,
    error,
  } = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts, enabled: !!session })

  const name = greetingName(
    session?.user.email,
    session?.user.user_metadata as Record<string, unknown> | undefined,
  )
  const hasAttempts = !!attempts && attempts.length > 0

  const best = hasAttempts ? attempts!.reduce((a, b) => (b.rawScore > a.rawScore ? b : a)) : null
  const latest = hasAttempts ? attempts![0] : null
  const avg = hasAttempts
    ? Math.round(attempts!.reduce((sum, a) => sum + a.rawScore, 0) / attempts!.length)
    : 0
  const chron = hasAttempts ? [...attempts!].reverse().map((a) => a.rawScore) : []

  return (
    <div className="space-y-10">
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-heading">
            {hasAttempts ? 'Welcome back' : 'Welcome to Cefrly'}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {hasAttempts
              ? 'Here’s where your CEFR prep stands.'
              : 'Let’s find your English level and build from there.'}
          </p>
        </div>
        {hasAttempts && (
          <Link
            to="/reading"
            className="group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
          >
            Start a test
            <ArrowRightIcon
              width={15}
              height={15}
              className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
            />
          </Link>
        )}
      </div>

      {isLoading && <HomeSkeleton />}

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          Could not load your progress: {(error as Error).message}
        </p>
      )}

      {attempts && !hasAttempts && <NewUserHome />}

      {hasAttempts && (
        <>
          <LevelSnapshot best={best!} />

          <section className={chron.length >= 2 ? 'grid gap-5 lg:grid-cols-[1fr_1.3fr]' : ''}>
            <div className="grid grid-cols-2 gap-5">
              <StatTile Icon={ClipboardIcon} label="Tests taken" value={String(attempts!.length)} />
              <StatTile Icon={TrendUpIcon} label="Average" value={`${avg}/${MAX}`} />
              <StatTile
                Icon={StarIcon}
                label="Best"
                value={`${best!.rawScore}/${MAX}`}
                sub={BAND_INFO[best!.band].label}
              />
              <StatTile
                Icon={ClockIcon}
                label="Latest"
                value={`${latest!.rawScore}/${MAX}`}
                sub={BAND_INFO[latest!.band].label}
              />
            </div>
            {chron.length >= 2 && (
              <div className={`${CARD} p-5`}>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold text-ink-soft">Score trend</p>
                  <p className="tnum text-xs font-semibold text-ink-soft">last {chron.length} attempts</p>
                </div>
                <div className="mt-3">
                  <Sparkline scores={chron} />
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <SkillsRoadmap />

      {hasAttempts && <RecentActivity attempts={attempts!} />}
    </div>
  )
}
