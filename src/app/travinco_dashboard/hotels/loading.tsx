export default function HotelsLoading() {
  return (
    <div className="space-y-5">
      {/* 1. Header Structure */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Hotels</h1>
          <p className="text-sm text-ink-500">
            Contact details, rooms and Rate Master prices. Rates are imported under Master.
          </p>
        </div>
        <div className="h-9 w-28 animate-pulse rounded bg-ink-100" />
      </div>

      {/* 2. Filters Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <div className="input w-full bg-ink-50/50 text-ink-400">Search hotel, contact, phone, area…</div>
        </div>
        <div className="input w-36 bg-ink-50/50 text-ink-400">All locations</div>
        <div className="input w-36 bg-ink-50/50 text-ink-400">All categories</div>
        <div className="input w-40 bg-ink-50/50 text-ink-400">Any contact status</div>
        <div className="btn-outline opacity-70">Refresh</div>
      </div>

      {/* 3. Table Skeleton */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Hotel</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3 text-right">Rooms</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-ink-50 last:border-0">
                  <td className="px-5 py-3">
                    <div className="h-4 w-32 animate-pulse rounded bg-ink-200/70 mb-1.5" />
                    <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-4 w-28 animate-pulse rounded bg-ink-200/70 mb-1.5" />
                    <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="h-4 w-8 animate-pulse rounded bg-ink-100 ml-auto" />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="h-8 w-16 animate-pulse rounded bg-ink-100 ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
