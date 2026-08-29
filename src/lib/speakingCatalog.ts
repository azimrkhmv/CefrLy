import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SpeakingPartType, SpeakingTest } from '../types/test'
import type { SpeakingTab } from '../pages/SpeakingPage'
import { fetchSamples } from './api'
import { speakingTestsFromSamples } from './speakingFromSamples'
import { isCustomSpeakingId, useCustomSpeakingTests } from './speakingCustom'

// ---------------------------------------------------------------------------
// Catalog selectors — turn the SpeakingTest list into the flat card view-model
// the grid renders, grouped by the active tab.
//
// The papers come from the SAMPLES LIBRARY (see speakingFromSamples): the
// owner's real Multilevel tests already live in the `samples` table, so adding a
// sample there adds a speaking paper here with no second copy to maintain. The
// student's own custom prompts are merged on top. The `['samples']` query key is
// shared with /samples, so opening either page warms the other.
// ---------------------------------------------------------------------------

export interface SpeakingCatalogItem {
  id: string
  title: string
  scope: 'full' | 'part'
  /** Undefined for a full Mock paper; set for single-part cards (drives the chip). */
  partType?: SpeakingPartType
  durationSec: number
  /** Preparation window of the single part (undefined for the full mock). */
  prepSec?: number
  recommended?: boolean
  custom?: boolean
}

export function toCatalogItem(test: SpeakingTest): SpeakingCatalogItem {
  const scope = test.scope ?? 'full'
  const firstTask = test.tasks[0]
  return {
    id: test.id,
    title: test.title,
    scope,
    partType: scope === 'part' ? firstTask?.partType : undefined,
    durationSec: test.durationSec,
    prepSec: scope === 'part' ? firstTask?.prepSec : undefined,
    recommended: test.tasks.some((t) => t.recommended),
    custom: isCustomSpeakingId(test.id),
  }
}

/** The cards to show for a given tab. Custom questions live ONLY under the
 *  Custom tab; the part tabs show the published drills (+ an Add tile the grid
 *  adds itself). */
export function speakingItemsForTab(
  tab: SpeakingTab,
  published: SpeakingTest[],
  custom: SpeakingTest[],
): SpeakingCatalogItem[] {
  if (tab === 'custom') return custom.map(toCatalogItem)
  if (tab === 'mock')
    return published.filter((t) => (t.scope ?? 'full') === 'full').map(toCatalogItem)
  return published
    .filter((t) => t.scope === 'part' && t.tasks[0]?.partType === tab)
    .map(toCatalogItem)
}

/** Every published speaking paper, derived from the samples library. */
export function useSpeakingTests() {
  const query = useQuery({ queryKey: ['samples'], queryFn: fetchSamples })
  const tests = useMemo(
    () => (query.data ? speakingTestsFromSamples(query.data) : []),
    [query.data],
  )
  return { tests, isLoading: query.isLoading, error: query.error as Error | null }
}

/** Reactive items for the active tab (re-renders when custom questions change). */
export function useSpeakingItems(tab: SpeakingTab): {
  items: SpeakingCatalogItem[]
  customCount: number
  isLoading: boolean
  error: Error | null
} {
  const custom = useCustomSpeakingTests()
  const { tests, isLoading, error } = useSpeakingTests()
  const items = useMemo(
    () => speakingItemsForTab(tab, tests, custom),
    [tab, tests, custom],
  )
  // Custom prompts are local, so their tab never waits on the network.
  return { items, customCount: custom.length, isLoading: tab !== 'custom' && isLoading, error }
}

/** Resolve one paper by id — published or the student's own. */
export function useSpeakingTest(id: string | undefined): {
  test: SpeakingTest | undefined
  isLoading: boolean
} {
  const custom = useCustomSpeakingTests()
  const { tests, isLoading } = useSpeakingTests()
  const test = useMemo(
    () => (id ? [...tests, ...custom].find((t) => t.id === id) : undefined),
    [id, tests, custom],
  )
  // A custom paper resolves immediately; only a published one waits on samples.
  return { test, isLoading: !test && isLoading }
}
