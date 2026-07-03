import { create } from 'zustand'

// In-test state only. Keyed by item id; values are option keys ('A'), typed
// words, or tfng values ('true' | 'false' | 'not_given').
interface AnswersState {
  answers: Record<string, string>
  setAnswer: (itemId: string, value: string) => void
  /** Restore a saved draft (e.g. after a page refresh). */
  hydrate: (answers: Record<string, string>) => void
  reset: () => void
}

export const useAnswersStore = create<AnswersState>((set) => ({
  answers: {},
  setAnswer: (itemId, value) =>
    set((state) => ({ answers: { ...state.answers, [itemId]: value } })),
  hydrate: (answers) => set({ answers }),
  reset: () => set({ answers: {} }),
}))
