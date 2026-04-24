// Target path: app/(app)/settings/loading.tsx (NEW FILE)

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-subtle" />
        <div className="h-9 w-24 animate-pulse rounded bg-subtle" />
        <div className="h-4 w-48 animate-pulse rounded bg-subtle" />
      </div>

      {/* Profile card */}
      <div className="card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 animate-pulse rounded-full bg-subtle" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-40 animate-pulse rounded bg-subtle" />
            <div className="h-3 w-32 animate-pulse rounded bg-subtle" />
          </div>
        </div>
      </div>

      {/* Household card */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-subtle" />
            <div className="h-6 w-48 animate-pulse rounded bg-subtle" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-subtle" />
        </div>
        <div className="mt-5 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-subtle" />
          <div className="h-4 w-28 animate-pulse rounded bg-subtle" />
        </div>
      </div>

      {/* Settings list */}
      <div className="card p-5 sm:p-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-border py-3 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-subtle" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 animate-pulse rounded bg-subtle" />
                <div className="h-3 w-48 animate-pulse rounded bg-subtle" />
              </div>
            </div>
            <div className="h-6 w-16 animate-pulse rounded bg-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
