import type { AudioAsset } from '../../types/test'
import { AudioPlayer } from './AudioPlayer'
import { PracticeAudioPlayer } from './PracticeAudioPlayer'

// Picks the right listening player for the session mode:
//   simulation -> AudioPlayer (locked: preview gate + play cap, no pause/seek)
//   practice   -> PracticeAudioPlayer (play/pause, ±10s, scrub, no limit)
export function ListeningAudio({
  audio,
  label,
  practice,
}: {
  audio: AudioAsset
  label: string
  practice: boolean
}) {
  return practice ? (
    <PracticeAudioPlayer audio={audio} label={label} />
  ) : (
    <AudioPlayer audio={audio} label={label} />
  )
}
