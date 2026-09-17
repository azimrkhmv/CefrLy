import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { WritingTaskType, WritingTest } from '../types/test'
import type { WritingTab } from '../pages/WritingPage'
import { fetchSamplePrompts } from './api'
import { writingTestsFromSamples } from './writingFromSamples'
import { isCustomWritingId, useCustomWritingTests } from './writingCustom'

// ---------------------------------------------------------------------------
// Catalog selectors — turn the WritingTest list into the flat card view-model
// the grid renders, grouped by the active tab.
//
// The papers come from the SAMPLES LIBRARY (see writingFromSamples), the same
// source and the same `['sample-prompts']` query as Speaking, so opening either
// section warms the other. The student's own custom questions merge on top.
// ---------------------------------------------------------------------------

export interface WritingCatalogItem {
  id: string
  title: string
  scope: 'full' | 'part'
  /** Undefined for a full Mock paper; set for single-task cards (drives the chip). */
  taskType?: WritingTaskType
  durationSec: number
  minWords?: number
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
    custom: isCustomWritingId(test.id),
  }
}

/** The cards to show for a given tab. Custom questions live ONLY under the
 *  Custom tab; the task-type tabs show the published drills (+ an Add tile the
 *  grid adds itself). */
export function writingItemsForTab(
  tab: WritingTab,
  published: WritingTest[],
  custom: WritingTest[],
): WritingCatalogItem[] {
  if (tab === 'custom') return custom.map(toCatalogItem)
  if (tab === 'mock')
    return published.filter((t) => (t.scope ?? 'full') === 'full').map(toCatalogItem)
  return published
    .filter((t) => t.scope === 'part' && t.tasks[0]?.taskType === tab)
    .map(toCatalogItem)
}

/** Every published writing paper, derived from the samples library. */
export function useWritingTests() {
  // Prompts, NOT the full samples: the papers are visible on every plan, and
  // the model answers are the part that is paid for.
  const query = useQuery({ queryKey: ['sample-prompts'], queryFn: fetchSamplePrompts })
  const tests = useMemo(
    () => (query.data ? writingTestsFromSamples(query.data) : []),
    [query.data],
  )
  return { tests, isLoading: query.isLoading, error: query.error as Error | null }
}

/** Reactive items for the active tab (re-renders when custom questions change). */
export function useWritingItems(tab: WritingTab): {
  items: WritingCatalogItem[]
  customCount: number
  isLoading: boolean
  error: Error | null
} {
  const custom = useCustomWritingTests()
  const { tests, isLoading, error } = useWritingTests()
  const items = useMemo(() => writingItemsForTab(tab, tests, custom), [tab, tests, custom])
  // Custom questions are local, so their tab never waits on the network.
  return { items, customCount: custom.length, isLoading: tab !== 'custom' && isLoading, error }
}

/** Resolve one paper by id — published or the student's own. */
export function useWritingTest(id: string | undefined): {
  test: WritingTest | undefined
  isLoading: boolean
} {
  const custom = useCustomWritingTests()
  const { tests, isLoading } = useWritingTests()
  const test = useMemo(
    () => (id ? [...tests, ...custom].find((t) => t.id === id) : undefined),
    [id, tests, custom],
  )
  // A custom paper resolves immediately; only a published one waits on samples.
  return { test, isLoading: !test && isLoading }
}
