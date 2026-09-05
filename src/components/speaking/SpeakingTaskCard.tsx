import { Link } from 'react-router-dom'
import type { SpeakingCatalogItem } from '../../lib/speakingCatalog'
import { PART_LABEL } from '../../lib/speakingFixtures'
import { hasSpeakingDraft } from '../../lib/speakingDraft'
import { CloseIcon, LockIcon, MicIcon, PlayIcon, StarIcon } from '../icons'

// ONE tile for every speaking card — the yellow microphone, whatever the part
// (owner call). Writing colour-codes its tiles per task type; Speaking
// deliberately does not: the mic IS the section's mark.
const TILE = 'bg-sun-soft text-sun-ink'

/** Speaking parts run in seconds, not tens of minutes — show "90 sec" under two
 *  minutes so a 1.5-minute drill doesn't round to a misleading "2 min". */
const duration = (sec: number) => (sec < 120 ? `${sec} sec` : `${Math.round(sec / 60)} min`)

export function SpeakingTaskCard({
  item,
  attempts,
  inProgress = false,
  /** True when this student's plan cannot get an AI check. Speaking practice
   *  itself is always free — only the band score and feedback are paid, and
   *  saying so on the card beats letting them find out after speaking. */
  checkLocked = false,
  lockLabel = 'AI check on Pro',
  onBlocked,
  onDelete,
}: {
  item: SpeakingCatalogItem
  attempts: number
  inProgress?: boolean
  checkLocked?: boolean
  /** Why it is locked, in three words. */
  lockLabel?: string
  /** Called instead of opening the paper when the plan cannot use it. */
  onBlocked?: () => void
  onDelete?: () => void
}) {
  const chip = item.scope === 'full' ? 'Full mock test' : PART_LABEL[item.partType!]
  // NOT "Resume": speaking recordings never survive leaving the page, so an
  // unfinished attempt restarts from question 1. Promising otherwise is a lie
  // the student only discovers after submitting a half-empty paper.
  const unfinished = inProgress || hasSpeakingDraft(item.id)
  const cta = unfinished ? 'Start again' : attempts > 0 ? 'Retake' : 'Start'

  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-md motion-safe:transition-transform motion-safe:hover:-translate-y-0.5">
      {item.recommended && (
        <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white shadow-card">
          <StarIcon width={12} height={12} />
          Recommended
        </span>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.title}`}
          className="absolute right-3 top-3 rounded-lg p-1 text-ink-faint opacity-0 transition-opacity hover:bg-page hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <CloseIcon width={15} height={15} />
        </button>
      )}

      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TILE}`}>
          <MicIcon width={20} height={20} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="line-clamp-2 font-extrabold leading-snug text-heading">{item.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
              {chip}
            </span>
            <span className="tnum text-xs text-ink-soft">{duration(item.durationSec)}</span>
            {item.prepSec ? (
              <span className="tnum text-xs text-ink-soft">· {item.prepSec}s prep</span>
            ) : null}
            {checkLocked && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-page px-2 py-0.5 text-xs font-bold text-ink-soft"
                title="Practice is free. The AI band score and feedback need Pro or Premium."
              >
                <LockIcon width={11} height={11} />
                {lockLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 pt-1">
        <span className="text-sm text-ink-soft">
          {attempts > 0 ? (
            <span className="font-bold text-emerald-700">
              Completed{attempts > 1 ? ` · ${attempts}×` : ''}
            </span>
          ) : (
            'No attempts yet'
          )}
        </span>
        {/* Locked plans get the wall on the FIRST click, not after ten minutes
            of speaking — the card stays browsable either way. */}
        {checkLocked && onBlocked ? (
          <button
            type="button"
            onClick={onBlocked}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-brand transition-colors hover:border-brand hover:bg-brand-soft"
          >
            <PlayIcon width={14} height={14} />
            {cta}
          </button>
        ) : (
          <Link
            to={`/speaking/task/${item.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-brand transition-colors hover:border-brand hover:bg-brand-soft"
          >
            <PlayIcon width={14} height={14} />
            {cta}
          </Link>
        )}
      </div>
    </div>
  )
}
