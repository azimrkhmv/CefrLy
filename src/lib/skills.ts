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
  writing: {
    label: 'Writing',
    to: '/writing',
    chip: 'bg-emerald-50 text-emerald-800',
    // Task 1.1 · Task 1.2 · Task 2 (drives the part-tab count).
    parts: 3,
  },
}

/** Treat any unknown / legacy value as reading (attempts stored before Phase 3). */
export function skillMeta(skill: string | undefined | null) {
  if (skill === 'listening') return SKILL_META.listening
  if (skill === 'writing') return SKILL_META.writing
  return SKILL_META.reading
}
