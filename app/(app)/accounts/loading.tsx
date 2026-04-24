// Target path: app/(app)/accounts/loading.tsx (NEW FILE)

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-subtle" />
          <div className="h-9 w-32 animate-pulse rounded bg-subtle" />
          <div className="h-4 w-48 animate-pulse rounded bg-subtle" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-subtle" />
      </div>

      {/* Accounts grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-subtle" />
                <div className="h-5 w-32 animate-pulse rounded bg-subtle" />
              </div>
              <div className="h-8 w-8 animate-pulse rounded-lg bg-subtle" />
            </div>
            <div className="mt-5">
              <div className="h-7 w-28 animate-pulse rounded bg-subtle" />
              <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-subtle" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
