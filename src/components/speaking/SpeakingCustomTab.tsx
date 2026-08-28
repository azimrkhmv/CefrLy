import type { SpeakingCatalogItem } from '../../lib/speakingCatalog'
import { hasSpeakingDraft } from '../../lib/speakingDraft'
import { EmptyState } from '../EmptyState'
import { PlusIcon } from '../icons'
import { SpeakingTaskCard } from './SpeakingTaskCard'

export function SpeakingCustomTab({
  items,
  attemptCount,
  onAdd,
  onDelete,
}: {
  items: SpeakingCatalogItem[]
  attemptCount: (id: string) => number
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div>
      {/* The full-width add bar — click anywhere on it to open the modal. */}
      <button
        type="button"
        onClick={onAdd}
        className="mb-6 flex w-full items-center gap-3.5 rounded-2xl border border-line bg-white p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft/40"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white">
          <PlusIcon width={20} height={20} />
        </span>
        <span className="font-bold text-ink">
          Click + to add a question you&rsquo;ve found online or created yourself.
        </span>
      </button>

      {items.length === 0 ? (
        <EmptyState
          pose="nap"
          title="Just waiting here for you to add your first question."
          hint="Paste a prompt you found elsewhere and practise speaking it against the clock."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="reveal"
              style={{ animationDelay: `${Math.min(i, 9) * 0.06}s` }}
            >
              <SpeakingTaskCard
                item={item}
                attempts={attemptCount(item.id)}
                inProgress={hasSpeakingDraft(item.id)}
                onDelete={() => onDelete(item.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
