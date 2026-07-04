// Shimmer placeholders shown while server data loads. Purely decorative:
// hidden from the accessibility tree, with a polite status line for readers.

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton block rounded ${className}`} aria-hidden />
}

export function TestCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-white p-6" aria-hidden>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-2.5 h-4 w-1/2" />
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-16 rounded-md" />
      </div>
    </div>
  )
}

export function TestGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      <p className="sr-only" role="status">
        Loading tests…
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <TestCardSkeleton key={i} />
        ))}
      </div>
    </>
  )
}

export function AttemptListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      <p className="sr-only" role="status">
        Loading your results…
      </p>
      <div className="space-y-3" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>
        ))}
      </div>
    </>
  )
}
