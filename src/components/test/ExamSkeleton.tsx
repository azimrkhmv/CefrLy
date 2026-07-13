import { Skeleton } from '../Skeleton'

// Shimmer that mimics the exam shell (top bar + a passage/questions card) so a
// load or a resume reads as the paper arriving, not a blank "Loading…" screen.
// Rendered inside TestPage's <ExamScreen> full-viewport wrapper.
export function ExamSkeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Loading the test…
      </p>
      <header className="shrink-0 border-b border-line bg-white" aria-hidden>
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-20 rounded-xl" />
            <Skeleton className="h-5 w-44" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto" aria-hidden>
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8">
          <Skeleton className="h-11 w-72 rounded-xl" />
          <div className="space-y-6 rounded-2xl border border-line bg-white p-6 shadow-card">
            <div className="space-y-2.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-8/12" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
