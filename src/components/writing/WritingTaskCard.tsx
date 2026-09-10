import { Link } from 'react-router-dom'
import type { WritingCatalogItem } from '../../lib/writingCatalog'
import { TASK_LABEL } from '../../lib/writingFixtures'
import { hasWritingDraft } from '../../lib/writingDraft'
import { CloseIcon, PenIcon, PlayIcon, StarIcon } from '../icons'

// ONE TILE FOR EVERY WRITING PAPER. The tile used to change with the task —
// lavender for 1.1, yellow for 1.2, green (and a *people* icon) for Task 2 —
// which made three colours out of one skill and put the wrong sign on the
// essay. Writing is a pen on lavender wherever it appears: the catalog, My
// results, the home roadmap and the report. The part is named by the chip
// underneath; it is not the tile's job to encode it. Speaking already works
// this way (SpeakingTaskCard's single TILE constant).
const TILE = 'bg-brand-soft text-brand'

const minutes = (sec: number) => Math.round(sec / 60)

export function WritingTaskCard({
  item,
  attempts,
  inProgress = false,
  onDelete,
  checkLocked = false,
  onBlocked,
}: {
  item: WritingCatalogItem
  attempts: number
  inProgress?: boolean
  onDelete?: () => void
  /** This student's plan cannot get an AI check. */
  checkLocked?: boolean
  /** Called instead of opening the paper when the plan cannot use it. */
  onBlocked?: () => void
}) {
  const chip = item.scope === 'full' ? 'Full mock test' : TASK_LABEL[item.taskType!]
  const resume = inProgress || hasWritingDraft(item.id)
  const cta = resume ? 'Resume' : attempts > 0 ? 'Retake' : 'Start'

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
          <PenIcon width={20} height={20} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="line-clamp-2 font-extrabold leading-snug text-heading">{item.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
              {chip}
            </span>
            <span className="tnum text-xs text-ink-soft">{minutes(item.durationSec)} min</span>
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
        {/* The wall lands on the first click, not after the student has written
            250 words for a check they cannot get. */}
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
            to={`/writing/task/${item.id}`}
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
