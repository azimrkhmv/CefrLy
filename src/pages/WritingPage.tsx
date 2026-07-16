import { useState } from 'react'
import { TabStrip } from '../components/TabStrip'
import { Dropdown } from '../components/Dropdown'
import { Toast } from '../components/Toast'
import { WritingTaskGrid } from '../components/writing/WritingTaskGrid'
import { WritingCustomTab } from '../components/writing/WritingCustomTab'
import { AddCustomModal } from '../components/writing/AddCustomModal'
import { useWritingItems } from '../lib/writingCatalog'
import { countAttempts, useWritingAttempts } from '../lib/writingAttempts'
import { removeCustomQuestion } from '../lib/writingCustom'
import type { WritingTaskType } from '../types/test'

/** The catalog tabs: the Mock Test, one per single-task drill, and the student's
 *  own saved prompts. Task keys reuse WritingTaskType so they map straight onto
 *  a task's `taskType`. */
export type WritingTab = 'mock' | WritingTaskType | 'custom'

const TABS: { key: WritingTab; label: string }[] = [
  { key: 'mock', label: 'Mock Test' },
  { key: 'task_1_1', label: 'Task 1.1' },
  { key: 'task_1_2', label: 'Task 1.2' },
  { key: 'part_2', label: 'Task 2' },
  { key: 'custom', label: 'Custom Question' },
]

type StatusFilter = 'all' | 'todo' | 'done'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All tasks' },
  { value: 'todo', label: 'Not started' },
  { value: 'done', label: 'Completed' },
]

export function WritingPage() {
  const [tab, setTab] = useState<WritingTab>('mock')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [modal, setModal] = useState<{ taskType: WritingTaskType } | null>(null)
  const [toast, setToast] = useState(false)

  const { items } = useWritingItems(tab)
  const attempts = useWritingAttempts()
  const attemptCount = (id: string) => countAttempts(attempts, id)

  const shown =
    status === 'all'
      ? items
      : items.filter((it) =>
          status === 'done' ? attemptCount(it.id) > 0 : attemptCount(it.id) === 0,
        )

  const openAddCustom = (taskType: WritingTaskType = 'task_1_1') => setModal({ taskType })
  const onCreated = () => {
    setTab('custom')
    setStatus('all')
    setToast(true)
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <TabStrip ariaLabel="Writing task type" tabs={TABS} value={tab} onChange={setTab} />
        <Dropdown
          ariaLabel="Filter tasks"
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
        />
      </div>

      {tab === 'custom' ? (
        <WritingCustomTab
          items={shown}
          attemptCount={attemptCount}
          onAdd={() => openAddCustom()}
          onDelete={removeCustomQuestion}
        />
      ) : (
        <WritingTaskGrid
          tab={tab}
          items={shown}
          attemptCount={attemptCount}
          onAddCustom={openAddCustom}
        />
      )}

      {modal && (
        <AddCustomModal
          initialTaskType={modal.taskType}
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
