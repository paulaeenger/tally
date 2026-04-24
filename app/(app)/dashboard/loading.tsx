// Target path: app/(app)/dashboard/loading.tsx (NEW FILE)

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-subtle" />
        <div className="h-9 w-48 animate-pulse rounded bg-subtle" />
        <div className="h-4 w-64 animate-pulse rounded bg-subtle" />
      </div>

      {/* Summary cards row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="h-3 w-16 animate-pulse rounded bg-subtle" />
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-subtle" />
            <div className="mt-2 h-3 w-12 animate-pulse rounded bg-subtle" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="card p-6">
        <div className="h-3 w-24 animate-pulse rounded bg-subtle" />
        <div className="mt-4 h-48 animate-pulse rounded bg-subtle" />
      </div>

      {/* Recent transactions */}
      <div className="card p-6">
        <div className="h-3 w-32 animate-pulse rounded bg-subtle" />
        <div className="mt-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-subtle" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 animate-pulse rounded bg-subtle" />
                  <div className="h-3 w-16 animate-pulse rounded bg-subtle" />
                </div>
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-subtle" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
