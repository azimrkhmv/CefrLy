import { create } from 'zustand'

// Listening playback state, keyed by the audio object path. It lives OUTSIDE the
// AudioPlayer component so play counts + preview survive part navigation (the
// exam renders one part at a time and unmounts the rest). Without this a student
// could reset their remaining plays by switching parts and coming back.
interface AudioState {
  /** assetPath -> number of plays already used. */
  plays: Record<string, number>
  /** assetPath -> the pre-listening preview countdown has finished. */
  previewed: Record<string, boolean>
  /** Playback volume 0..1, shared by every listening player and remembered
   *  across attempts (localStorage). reset() leaves it alone on purpose. */
  volume: number
  usePlay: (assetPath: string) => void
  markPreviewed: (assetPath: string) => void
  setVolume: (volume: number) => void
  reset: () => void
}

const VOLUME_KEY = 'cefrly-volume'

function savedVolume(): number {
  const v = Number(localStorage.getItem(VOLUME_KEY))
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1
}

export const useAudioStore = create<AudioState>((set) => ({
  plays: {},
  previewed: {},
  volume: savedVolume(),
  usePlay: (assetPath) =>
    set((state) => ({ plays: { ...state.plays, [assetPath]: (state.plays[assetPath] ?? 0) + 1 } })),
  markPreviewed: (assetPath) =>
    set((state) => ({ previewed: { ...state.previewed, [assetPath]: true } })),
  setVolume: (volume) => {
    localStorage.setItem(VOLUME_KEY, String(volume))
    set({ volume })
  },
  reset: () => set({ plays: {}, previewed: {} }),
}))
