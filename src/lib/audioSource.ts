import { createContext, useContext } from 'react'
import type { AudioSource } from './api'

// Which session (or reviewed attempt) the listening players on this screen
// belong to. The players need it to ask listening-audio for a signed URL — the
// audio bucket is private, so there is no URL without it. TestPage and
// ReviewPage provide it; a player rendered without it has nothing to play.
export const AudioSourceContext = createContext<AudioSource | null>(null)

export const useAudioSource = () => useContext(AudioSourceContext)
