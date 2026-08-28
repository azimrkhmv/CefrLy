import type { SpeakingPartType, SpeakingTest } from '../types/test'
import type { SpeakingTab } from '../pages/SpeakingPage'
import { SPEAKING_FIXTURES } from './speakingFixtures'
import { isCustomSpeakingId, useCustomSpeakingTests } from './speakingCustom'

// ---------------------------------------------------------------------------
// Catalog selectors — turn the typed SpeakingTest list (fixtures + the student's
// custom questions) into the flat card view-model the grid renders, grouped by
// the active tab. Pure functions + one thin hook; swapping the fixture source for
// a fetched list later touches only `allSpeakingTests()`. Mirror of
// writingCatalog.
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

/** All speaking tests currently available (fixtures + the student's custom set). */
export function allSpeakingTests(custom: SpeakingTest[]): SpeakingTest[] {
  return [...SPEAKING_FIXTURES, ...custom]
}

/** Resolve one test by id from either source (used by the speaking screen). */
export function findSpeakingTest(id: string, custom: SpeakingTest[]): SpeakingTest | undefined {
  return allSpeakingTests(custom).find((t) => t.id === id)
}

/** The cards to show for a given tab. Custom questions live ONLY under the
 *  Custom tab; the part tabs show the published drills (+ an Add tile the grid
 *  adds itself). */
export function speakingItemsForTab(
  tab: SpeakingTab,
  custom: SpeakingTest[],
): SpeakingCatalogItem[] {
  if (tab === 'custom') return custom.map(toCatalogItem)
  if (tab === 'mock')
    return SPEAKING_FIXTURES.filter((t) => (t.scope ?? 'full') === 'full').map(toCatalogItem)
  return SPEAKING_FIXTURES.filter(
    (t) => t.scope === 'part' && t.tasks[0]?.partType === tab,
  ).map(toCatalogItem)
}

/** Reactive items for the active tab (re-renders when custom questions change). */
export function useSpeakingItems(tab: SpeakingTab): {
  items: SpeakingCatalogItem[]
  customCount: number
} {
  const custom = useCustomSpeakingTests()
  return { items: speakingItemsForTab(tab, custom), customCount: custom.length }
}
