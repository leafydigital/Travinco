export default function DashboardRootLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-5">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-ink-200/60 animate-pulse" />
          <div className="h-4 w-72 rounded bg-ink-100 animate-pulse" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-28 rounded-xl bg-ink-100 animate-pulse" />
        </div>
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="h-10 w-full max-w-md rounded-xl bg-ink-100 animate-pulse" />
        <div className="h-10 w-44 rounded-xl bg-ink-100 animate-pulse" />
      </div>

      {/* Table Card Skeleton */}
      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-xs">
        <div className="border-b border-ink-100 bg-sand-50/40 px-5 py-3.5">
          <div className="h-4 w-36 rounded bg-ink-100 animate-pulse" />
        </div>
        <div className="divide-y divide-ink-50 p-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-12 rounded-lg bg-ink-100" />
                <div className="space-y-1.5">
                  <div className="h-4 w-44 rounded bg-ink-200/70" />
                  <div className="h-3 w-28 rounded bg-ink-100" />
                </div>
              </div>
              <div className="hidden sm:block h-5 w-24 rounded-full bg-ink-100" />
              <div className="hidden md:block h-4 w-20 rounded bg-ink-100" />
              <div className="h-7 w-20 rounded-lg bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
