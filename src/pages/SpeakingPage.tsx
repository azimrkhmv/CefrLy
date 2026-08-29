import { useState } from 'react'
import { TabStrip } from '../components/TabStrip'
import { TestGridSkeleton } from '../components/Skeleton'
import { Dropdown } from '../components/Dropdown'
import { Toast } from '../components/Toast'
import { SpeakingTaskGrid } from '../components/speaking/SpeakingTaskGrid'
import { SpeakingCustomTab } from '../components/speaking/SpeakingCustomTab'
import { AddCustomModal } from '../components/speaking/AddCustomModal'
import { useSpeakingItems } from '../lib/speakingCatalog'
import { countAttempts, useSpeakingAttempts } from '../lib/speakingAttempts'
import { fetchSpeakingAttempts } from '../lib/speakingGrading'
import { hasPremiumAccess } from '../lib/plans'
import { useAuth } from '../lib/auth'
import { useQuery } from '@tanstack/react-query'
import { removeCustomQuestion } from '../lib/speakingCustom'
import type { SpeakingPartType } from '../types/test'

/** The catalog tabs: the Mock Test, one per single-part drill, and the student's
 *  own saved prompts. Part keys reuse SpeakingPartType so they map straight onto
 *  a task's `partType`. */
export type SpeakingTab = 'mock' | SpeakingPartType | 'custom'

const TABS: { key: SpeakingTab; label: string }[] = [
  { key: 'mock', label: 'Mock Test' },
  { key: 'part_1_1', label: 'Part 1.1' },
  { key: 'part_1_2', label: 'Part 1.2' },
  { key: 'part_2', label: 'Part 2' },
  { key: 'part_3', label: 'Part 3' },
  { key: 'custom', label: 'Custom Question' },
]

type StatusFilter = 'all' | 'todo' | 'done'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All tasks' },
  { value: 'todo', label: 'Not started' },
  { value: 'done', label: 'Completed' },
]

export function SpeakingPage() {
  const [tab, setTab] = useState<SpeakingTab>('mock')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [modal, setModal] = useState<{ partType: SpeakingPartType } | null>(null)
  const [toast, setToast] = useState(false)
  const { plan } = useAuth()

  const { items, isLoading, error } = useSpeakingItems(tab)
  // Attempts live in two stores that never overlap: ungraded ones locally, graded
  // ones on the server. A card's count is the sum, or a checked attempt would
  // make the card look untouched again.
  const attempts = useSpeakingAttempts()
  const { data: gradedRows } = useQuery({
    queryKey: ['speaking-attempts'],
    queryFn: fetchSpeakingAttempts,
  })
  const graded = gradedRows ?? []
  const attemptCount = (id: string) =>
    countAttempts(attempts, id) + graded.filter((g) => g.test_id === id).length

  const shown =
    status === 'all'
      ? items
      : items.filter((it) =>
          status === 'done' ? attemptCount(it.id) > 0 : attemptCount(it.id) === 0,
        )

  const openAddCustom = (partType: SpeakingPartType = 'part_1_1') => setModal({ partType })
  const onCreated = () => {
    setTab('custom')
    setStatus('all')
    setToast(true)
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <TabStrip ariaLabel="Speaking part" tabs={TABS} value={tab} onChange={setTab} />
        <Dropdown
          ariaLabel="Filter tasks"
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
        />
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Speaking papers could not be loaded. Check your connection and refresh.
        </p>
      )}

      {isLoading ? (
        <TestGridSkeleton />
      ) : tab === 'custom' ? (
        <SpeakingCustomTab
          items={shown}
          attemptCount={attemptCount}
          onAdd={() => openAddCustom()}
          onDelete={removeCustomQuestion}
        />
      ) : (
        <SpeakingTaskGrid
          tab={tab}
          items={shown}
          attemptCount={attemptCount}
          checkLocked={!hasPremiumAccess(plan)}
          onAddCustom={openAddCustom}
        />
      )}

      {modal && (
        <AddCustomModal
          initialPartType={modal.partType}
          onClose={() => setModal(null)}
          onCreated={onCreated}
        />
      )}
      {toast && (
        <Toast
          title="New task added successfully"
          message="Your custom task has been saved."
          onDone={() => setToast(false)}
        />
      )}
    </div>
  )
}
