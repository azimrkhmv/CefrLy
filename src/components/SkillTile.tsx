import type { Skill } from '../types/test'
import { BookIcon, HeadphonesIcon, MicIcon, PenIcon } from './icons'

/** The sign a card wears so a student knows which paper it is at a glance:
 *  one icon on one tint per skill. Writing and Speaking had it from the start
 *  (their task cards) and My results uses it for every attempt; Reading and
 *  Listening cards were the only ones without.
 *
 *  NOTE the Speaking tint here is rose, while SpeakingTaskCard's own tile is
 *  the yellow mic (owner call) — that divergence predates this file and is not
 *  ours to unify; keep those cards as they are. */
export const SKILL_TILE: Record<
  Skill,
  { tile: string; Icon: (props: { width?: number; height?: number }) => React.ReactElement }
> = {
  reading: { tile: 'bg-brand-soft text-brand', Icon: BookIcon },
  listening: { tile: 'bg-sun-soft text-sun-ink', Icon: HeadphonesIcon },
  writing: { tile: 'bg-brand-soft text-brand', Icon: PenIcon },
  speaking: { tile: 'bg-rose-50 text-rose-800', Icon: MicIcon },
}

/** Same fallback rule as skillMeta: anything unknown or legacy reads as reading. */
export function skillTile(skill: string | undefined | null) {
  if (skill === 'listening') return SKILL_TILE.listening
  if (skill === 'writing') return SKILL_TILE.writing
  if (skill === 'speaking') return SKILL_TILE.speaking
  return SKILL_TILE.reading
}

export function SkillTile({
  skill,
  /** Overrides the skill tint — My results paints the best attempt's tile solid brand. */
  className,
}: {
  skill: string | undefined | null
  className?: string
}) {
  const { tile, Icon } = skillTile(skill)
  return (
    <span
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${className ?? tile}`}
    >
      <Icon width={20} height={20} />
    </span>
  )
}
