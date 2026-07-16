import type { WritingTaskType, WritingTest } from '../types/test'
import type { WritingTab } from '../pages/WritingPage'
import { WRITING_FIXTURES } from './writingFixtures'
import { isCustomWritingId, useCustomWritingTests } from './writingCustom'

// ---------------------------------------------------------------------------
// Catalog selectors — turn the typed WritingTest list (fixtures + the student's
// custom questions) into the flat card view-model the grid renders, grouped by
// the active tab. Pure functions + one thin hook; swapping the fixture source
// for a fetched list later touches only `allWritingTests()`.
// ---------------------------------------------------------------------------

export interface WritingCatalogItem {
  id: string
  title: string
  scope: 'full' | 'part'
  /** Undefined for a full Mock paper; set for single-task cards (drives the chip). */
  taskType?: WritingTaskType
  durationSec: number
  minWords?: number
  recommended?: boolean
  custom?: boolean
}

export function toCatalogItem(test: WritingTest): WritingCatalogItem {
  const scope = test.scope ?? 'full'
  const firstTask = test.tasks[0]
  return {
    id: test.id,
    title: test.title,
    scope,
    taskType: scope === 'part' ? firstTask?.taskType : undefined,
    durationSec: test.durationSec,
    minWords: scope === 'part' ? firstTask?.minWords : undefined,
    recommended: test.tasks.some((t) => t.recommended),
    custom: isCustomWritingId(test.id),
  }
}

/** All writing tests currently available (fixtures + the student's custom set). */
export function allWritingTests(custom: WritingTest[]): WritingTest[] {
  return [...WRITING_FIXTURES, ...custom]
}

/** Resolve one test by id from either source (used by the writing screen). */
export function findWritingTest(id: string, custom: WritingTest[]): WritingTest | undefined {
  return allWritingTests(custom).find((t) => t.id === id)
}

/** The cards to show for a given tab. Custom questions live ONLY under the
 *  Custom tab; the task-type tabs show the published drills (+ an Add tile the
 *  grid adds itself). */
export function writingItemsForTab(tab: WritingTab, custom: WritingTest[]): WritingCatalogItem[] {
  if (tab === 'custom') return custom.map(toCatalogItem)
  if (tab === 'mock')
    return WRITING_FIXTURES.filter((t) => (t.scope ?? 'full') === 'full').map(toCatalogItem)
  return WRITING_FIXTURES.filter(
    (t) => t.scope === 'part' && t.tasks[0]?.taskType === tab,
  ).map(toCatalogItem)
}

/** Reactive items for the active tab (re-renders when custom questions change). */
export function useWritingItems(tab: WritingTab): {
  items: WritingCatalogItem[]
  customCount: number
} {
  const custom = useCustomWritingTests()
  return { items: writingItemsForTab(tab, custom), customCount: custom.length }
}
