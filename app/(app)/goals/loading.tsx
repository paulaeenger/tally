// Target path: app/(app)/goals/loading.tsx (NEW FILE)

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-subtle" />
          <div className="h-9 w-20 animate-pulse rounded bg-subtle" />
          <div className="h-4 w-56 animate-pulse rounded bg-subtle" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-lg bg-subtle" />
      </div>

      {/* Goal cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-subtle" />
                <div className="h-3 w-24 animate-pulse rounded bg-subtle" />
              </div>
              <div className="h-8 w-8 animate-pulse rounded-full bg-subtle" />
            </div>

            <div className="mt-5">
              <div className="h-2.5 w-full animate-pulse rounded-full bg-subtle" />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="h-3 w-24 animate-pulse rounded bg-subtle" />
              <div className="h-3 w-16 animate-pulse rounded bg-subtle" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
