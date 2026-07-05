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
  usePlay: (assetPath: string) => void
  markPreviewed: (assetPath: string) => void
  reset: () => void
}

export const useAudioStore = create<AudioState>((set) => ({
  plays: {},
  previewed: {},
  usePlay: (assetPath) =>
    set((state) => ({ plays: { ...state.plays, [assetPath]: (state.plays[assetPath] ?? 0) + 1 } })),
  markPreviewed: (assetPath) =>
    set((state) => ({ previewed: { ...state.previewed, [assetPath]: true } })),
  reset: () => set({ plays: {}, previewed: {} }),
}))
