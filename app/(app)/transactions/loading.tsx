// Target path: app/(app)/transactions/loading.tsx (NEW FILE)

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-subtle" />
          <div className="h-9 w-40 animate-pulse rounded bg-subtle" />
          <div className="h-4 w-56 animate-pulse rounded bg-subtle" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-subtle" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-subtle" />
        </div>
      </div>

      {/* Transaction list */}
      <div className="card overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0 sm:px-6"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-subtle" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 animate-pulse rounded bg-subtle" />
                <div className="h-3 w-20 animate-pulse rounded bg-subtle" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-3 w-16 animate-pulse rounded bg-subtle" />
              <div className="h-4 w-20 animate-pulse rounded bg-subtle" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
