import { Skeleton } from './Skeleton'

/**
 * Shown while a lazily-loaded route chunk is fetched. Routes are code-split
 * (see App.tsx), so this replaces the page body — never the shell — for the
 * one network round-trip it takes to pull the chunk. Shimmer, not "Loading…",
 * per the design system.
 */
export function RouteFallback() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <Skeleton className="h-8 w-56 rounded-xl" />
      <Skeleton className="h-4 w-80 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  )
}

/** Full-screen variant for routes that render outside the app shell. */
export function FullScreenFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <div className="w-full max-w-md space-y-4 px-6" aria-busy="true">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  )
}
