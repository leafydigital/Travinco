export function AdminPageSkeleton({
  titleWidth = 'w-48',
  showStats = true,
  rowCount = 8,
}: {
  titleWidth?: string;
  showStats?: boolean;
  rowCount?: number;
}) {
  return (
    <div className="space-y-6 antialiased animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-5">
        <div className="space-y-2">
          <div className={`h-8 ${titleWidth} rounded-xl bg-ink-200/70`} />
          <div className="h-4 w-64 rounded-md bg-ink-100" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 rounded-xl bg-ink-200/60" />
          <div className="h-10 w-36 rounded-xl bg-brand-200/50" />
        </div>
      </div>

      {/* Optional Stats Cards Skeleton */}
      {showStats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="card p-4 rounded-2xl border border-ink-200/70 bg-white space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 rounded bg-ink-100" />
                <div className="h-8 w-8 rounded-xl bg-ink-100" />
              </div>
              <div className="h-7 w-28 rounded-lg bg-ink-200/70" />
              <div className="h-3 w-36 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      )}

      {/* Filter / Search Toolbar Skeleton */}
      <div className="card p-4 space-y-3 rounded-2xl border border-ink-200/70 bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-10 w-full sm:w-80 rounded-xl bg-ink-100" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 rounded-lg bg-ink-100" />
            <div className="h-9 w-28 rounded-lg bg-ink-100" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 pt-1">
          <div className="h-9 rounded-lg bg-ink-100" />
          <div className="h-9 rounded-lg bg-ink-100" />
          <div className="h-9 rounded-lg bg-ink-100" />
          <div className="h-9 rounded-lg bg-ink-100" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="card overflow-hidden rounded-2xl border border-ink-200/70 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 bg-sand-50/40 px-4 py-3">
          <div className="h-4 w-44 rounded bg-ink-100" />
          <div className="h-6 w-24 rounded bg-ink-100" />
        </div>
        <div className="divide-y divide-ink-100">
          {Array.from({ length: rowCount }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5 gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-9 w-9 rounded-xl bg-ink-100 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-48 rounded bg-ink-200/60" />
                  <div className="h-3 w-32 rounded bg-ink-100" />
                </div>
              </div>
              <div className="h-6 w-20 rounded-full bg-ink-100 shrink-0 hidden sm:block" />
              <div className="h-4 w-28 rounded bg-ink-100 shrink-0 hidden md:block" />
              <div className="h-5 w-16 rounded bg-ink-200/60 shrink-0" />
              <div className="h-8 w-8 rounded-lg bg-ink-100 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminDetailSkeleton({
  titleWidth = 'w-60',
}: {
  titleWidth?: string;
}) {
  return (
    <div className="space-y-6 antialiased animate-pulse">
      {/* Breadcrumb & Header */}
      <div className="space-y-3 border-b border-ink-100 pb-5">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-16 rounded bg-ink-100" />
          <div className="h-3.5 w-3 rounded bg-ink-100" />
          <div className="h-3.5 w-24 rounded bg-ink-100" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className={`h-8 ${titleWidth} rounded-xl bg-ink-200/70`} />
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-24 rounded-xl bg-ink-100" />
            <div className="h-9 w-32 rounded-xl bg-brand-200/50" />
          </div>
        </div>
      </div>

      {/* Detail Layout: 2 Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6 rounded-2xl border border-ink-200/70 bg-white space-y-4">
            <div className="h-5 w-36 rounded bg-ink-200/60" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 rounded-xl bg-ink-100" />
              <div className="h-10 rounded-xl bg-ink-100" />
            </div>
            <div className="h-28 rounded-xl bg-ink-100" />
          </div>

          <div className="card p-6 rounded-2xl border border-ink-200/70 bg-white space-y-4">
            <div className="h-5 w-44 rounded bg-ink-200/60" />
            <div className="space-y-3">
              <div className="h-12 rounded-xl bg-ink-100" />
              <div className="h-12 rounded-xl bg-ink-100" />
              <div className="h-12 rounded-xl bg-ink-100" />
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <div className="card p-5 rounded-2xl border border-ink-200/70 bg-white space-y-4">
            <div className="h-5 w-28 rounded bg-ink-200/60" />
            <div className="space-y-2.5">
              <div className="h-4 w-full rounded bg-ink-100" />
              <div className="h-4 w-3/4 rounded bg-ink-100" />
              <div className="h-4 w-1/2 rounded bg-ink-100" />
            </div>
          </div>
          <div className="card p-5 rounded-2xl border border-ink-200/70 bg-white space-y-3">
            <div className="h-5 w-32 rounded bg-ink-200/60" />
            <div className="h-32 rounded-xl bg-ink-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
