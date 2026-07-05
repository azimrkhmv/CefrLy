import type { Skill } from '../types/test'

/** Shared presentation for a test's skill: catalog route, label and chip style.
 *  Keeps the Reading/Listening badge identical across home, catalog and history. */
export const SKILL_META: Record<Skill, { label: string; to: string; chip: string; parts: number }> = {
  reading: {
    label: 'Reading',
    to: '/reading',
    chip: 'bg-brand-soft text-brand',
    parts: 5,
  },
  listening: {
    label: 'Listening',
    to: '/listening',
    chip: 'bg-sun-soft text-sun-ink',
    parts: 6,
  },
}

/** Treat any unknown / legacy value as reading (attempts stored before Phase 3). */
export function skillMeta(skill: string | undefined | null) {
  return skill === 'listening' ? SKILL_META.listening : SKILL_META.reading
}
