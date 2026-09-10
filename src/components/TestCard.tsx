import { Link } from 'react-router-dom'
import type { TestCatalogEntry } from '../types/attempt'
import type { OpenSession } from '../types/test'
import { LockIcon } from './icons'
import { SkillTile } from './SkillTile'
import { useScreenTooSmallForExam } from '../lib/screen'

/** "23 min left" for a running attempt; a paused practice clock is frozen, so
 *  it reports the time it still has rather than counting down. */
function timeLeftLabel(session: OpenSession): string {
  const base = new Date(session.expiresAt).getTime()
  const at = session.pausedAt ? new Date(session.pausedAt).getTime() : Date.now()
  const minutes = Math.max(0, Math.round((base - at) / 60000))
  if (session.pausedAt) return `${minutes} min left · paused`
  return minutes >= 1 ? `${minutes} min left` : 'less than a minute left'
}

export interface TestAttemptInfo {
  count: number
  best: number | null
}

export function TestCard({
  test,
  attemptInfo,
  locked = false,
  openSession,
  onTooSmall,
}: {
  test: TestCatalogEntry
  attemptInfo?: TestAttemptInfo
  /** True when the test is premium and the signed-in user's plan can't open it. */
  locked?: boolean
  /** An attempt still running on this test. Leaving an exam with the browser's
   *  Back button keeps its clock going, and the catalog used to show a plain
   *  "Start" as if nothing were in progress. */
  openSession?: OpenSession
  /** Called instead of opening the exam when a full paper is tapped on a screen
   *  too small to sit it — the catalog answers with the mascot's alert. */
  onTooSmall?: () => void
}) {
  const isPart = test.scope === 'part'
  const isPremium = (test.access ?? 'premium') === 'premium'
  const attemptsLabel =
    attemptInfo && attemptInfo.count > 0
      ? `Best score ${attemptInfo.best}${isPart ? '' : '/35'} · ${attemptInfo.count} attempt${attemptInfo.count > 1 ? 's' : ''}`
      : 'No attempts yet'
  // A full paper is desktop-only (see lib/screen). Said on the card, not after
  // the student has already tapped through to the exam.
  const screenTooSmall = useScreenTooSmallForExam()
  // An attempt already running is never blocked — leaving a clock ticking with
  // no way back to it would be worse than a cramped screen.
  const needsBiggerScreen = screenTooSmall && !isPart && !openSession

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-brand/30 hover:shadow-soft">
      {/* The skill's sign, the same one Writing and Speaking task cards wear.
          It replaces the old "READING"/"LISTENING" word chip: a catalog only
          ever lists one skill, so the tile says it without spending a pill. */}
      <div className="flex items-start gap-3">
        <SkillTile skill={test.skill} />
        <div className="min-w-0 pt-0.5">
          <h3 className="text-base font-extrabold leading-snug text-heading">{test.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              {isPart ? `Part ${test.part_number} practice` : 'Full mock test'}
            </span>
            {/* Access badge: green "Free" for everyone, brand "Premium" for paid. */}
            {isPremium ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                <LockIcon width={11} height={11} />
                Premium
              </span>
            ) : (
              <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                Free
              </span>
            )}
            {openSession && (
              <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-800">
                In progress
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-semibold text-ink-soft">
            {test.target_levels.join(' · ')} — {Math.round(test.duration_sec / 60)} minutes
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="tnum text-sm text-ink-soft">
          {openSession ? (
            <span className="font-bold text-amber-800">{timeLeftLabel(openSession)}</span>
          ) : (
            attemptsLabel
          )}
        </p>
        {needsBiggerScreen && !locked && onTooSmall ? (
          // Reads as Start, but stops short of the exam: start-session would
          // spend a session (and, on a premium test, an allowance) on an
          // attempt this screen can't hold. The dialog explains why.
          <button
            type="button"
            onClick={onTooSmall}
            className="shrink-0 rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
          >
            Start
          </button>
        ) : locked ? (
          // Premium test the user can't open yet → send them to pricing, not the
          // exam (start-session would refuse it anyway with an upgrade prompt).
          <Link
            to="/pricing"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-brand bg-brand-soft px-4 py-2 text-sm font-bold text-brand transition-colors hover:bg-brand/10"
          >
            <LockIcon width={14} height={14} />
            Unlock
          </Link>
        ) : (
          <Link
            to={`/test/${test.id}`}
            className="shrink-0 rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
          >
            {openSession ? 'Resume' : 'Start'}
          </Link>
        )}
      </div>
    </div>
  )
}
