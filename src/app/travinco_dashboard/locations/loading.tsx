export default function LocationsLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
          <div className="h-9 w-64 rounded-lg bg-ink-100 animate-pulse" />
          <div className="h-9 w-36 rounded-lg bg-ink-100 animate-pulse" />
          <div className="h-9 w-20 rounded-lg bg-ink-100 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-36 rounded-lg bg-ink-100 animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-ink-100 animate-pulse" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">State</th>
                <th className="px-5 py-3">Part of</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3 text-right">Hotels</th>
                <th className="px-5 py-3 text-right">Activities</th>
                <th className="px-5 py-3 text-center">Active</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-ink-50 last:border-0">
                  <td className="px-5 py-3">
                    <div className="h-4 w-36 animate-pulse rounded bg-ink-200/70 mb-1.5" />
                    <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-4 w-20 animate-pulse rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-ink-100" />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="h-4 w-8 animate-pulse rounded bg-ink-100 ml-auto" />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="h-4 w-8 animate-pulse rounded bg-ink-100 ml-auto" />
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="h-5 w-12 animate-pulse rounded-full bg-ink-100 mx-auto" />
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
