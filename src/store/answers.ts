import { create } from 'zustand'

// In-test state only. `answers` keyed by item id; values are option keys ('A'),
// typed words, or tfng values ('true' | 'false' | 'not_given').
// `marked` holds the question ids the user flagged for review.
interface AnswersState {
  answers: Record<string, string>
  marked: Record<string, boolean>
  setAnswer: (itemId: string, value: string) => void
  toggleMarked: (itemId: string) => void
  /** Restore a saved draft (e.g. after a page refresh). */
  hydrate: (answers: Record<string, string>, marked?: Record<string, boolean>) => void
  reset: () => void
}

export const useAnswersStore = create<AnswersState>((set) => ({
  answers: {},
  marked: {},
  setAnswer: (itemId, value) =>
    set((state) => ({ answers: { ...state.answers, [itemId]: value } })),
  toggleMarked: (itemId) =>
    set((state) => {
      const marked = { ...state.marked }
      if (marked[itemId]) delete marked[itemId]
      else marked[itemId] = true
      return { marked }
    }),
  hydrate: (answers, marked = {}) => set({ answers, marked }),
  reset: () => set({ answers: {}, marked: {} }),
}))
