import type { WritingTaskType } from '../../types/test'
import type { WritingCatalogItem } from '../../lib/writingCatalog'
import { hasWritingDraft } from '../../lib/writingDraft'
import { EmptyState } from '../EmptyState'
import { PlusIcon } from '../icons'
import { WritingTaskCard } from './WritingTaskCard'

/** The dashed "Add Custom Task" tile — the first cell on every task-type tab. */
function AddCustomTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-[9rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white p-5 text-center transition-colors hover:border-brand hover:bg-brand-soft/40"
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
        <PlusIcon width={20} height={20} />
      </span>
      <span className="font-extrabold text-heading">Add Custom Task</span>
      <span className="text-sm text-ink-soft">Add a question you've found elsewhere</span>
    </button>
  )
}

export function WritingTaskGrid({
  tab,
  items,
  attemptCount,
  onAddCustom,
}: {
  tab: 'mock' | WritingTaskType
  items: WritingCatalogItem[]
  attemptCount: (id: string) => number
  onAddCustom: (taskType: WritingTaskType) => void
}) {
  const showAddTile = tab !== 'mock'

  if (tab === 'mock' && items.length === 0) {
    return (
      <EmptyState
        pose="nap"
        title="No writing mock published yet"
        hint="Check back soon — full writing papers are on the way."
      />
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {showAddTile && (
        <div className="reveal">
          <AddCustomTile onClick={() => onAddCustom(tab)} />
        </div>
      )}
      {items.map((item, i) => (
        <div
          key={item.id}
          className="reveal"
          style={{ animationDelay: `${Math.min(i + (showAddTile ? 1 : 0), 9) * 0.06}s` }}
        >
          <WritingTaskCard
            item={item}
            attempts={attemptCount(item.id)}
            inProgress={hasWritingDraft(item.id)}
          />
        </div>
      ))}
    </div>
  )
}
