import { createContext, useContext } from 'react'

/**
 * Lets a page open the section menu (the sidebar drawer) instead of jumping
 * straight into one skill — the Home "Start a test" CTA uses it so the student
 * picks Reading / Listening / Speaking themselves.
 */
export const NavDrawerContext = createContext<{ open: () => void } | null>(null)

export function useNavDrawer() {
  return useContext(NavDrawerContext)?.open
}
