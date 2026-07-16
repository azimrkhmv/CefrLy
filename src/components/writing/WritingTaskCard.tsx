import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import type { WritingTaskType } from '../../types/test'
import type { WritingCatalogItem } from '../../lib/writingCatalog'
import { TASK_LABEL } from '../../lib/writingFixtures'
import { hasWritingDraft } from '../../lib/writingDraft'
import { ClipboardIcon, CloseIcon, PenIcon, PlayIcon, StarIcon, UsersIcon } from '../icons'

type IconProps = { width?: number; height?: number }

const TILE: Record<
  WritingTaskType | 'full',
  { cls: string; Icon: (p: IconProps) => ReactElement }
> = {
  task_1_1: { cls: 'bg-brand-soft text-brand', Icon: PenIcon },
  task_1_2: { cls: 'bg-sun-soft text-sun-ink', Icon: PenIcon },
  part_2: { cls: 'bg-emerald-50 text-emerald-800', Icon: UsersIcon },
  full: { cls: 'bg-brand text-white', Icon: ClipboardIcon },
}

const minutes = (sec: number) => Math.round(sec / 60)

export function WritingTaskCard({
  item,
  attempts,
  inProgress = false,
  onDelete,
}: {
  item: WritingCatalogItem
  attempts: number
  inProgress?: boolean
  onDelete?: () => void
}) {
  const kind = item.scope === 'full' ? 'full' : (item.taskType as WritingTaskType)
  const { cls, Icon } = TILE[kind]
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
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${cls}`}>
          <Icon width={20} height={20} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="truncate font-extrabold leading-snug text-heading">{item.title}</h3>
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
        <Link
          to={`/writing/task/${item.id}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-brand transition-colors hover:border-brand hover:bg-brand-soft"
        >
          <PlayIcon width={14} height={14} />
          {cta}
        </Link>
      </div>
    </div>
  )
}
