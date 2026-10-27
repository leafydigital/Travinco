export default function ActivitiesLoading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Header controls skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 rounded-lg bg-ink-100 animate-pulse" />
          <div className="h-9 w-40 rounded-lg bg-ink-100 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-36 rounded-lg bg-ink-100 animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-ink-100 animate-pulse" />
        </div>
      </div>

      {/* Search Bar skeleton */}
      <div className="card p-3 bg-white">
        <div className="flex items-center gap-2">
          <div className="h-10 flex-1 rounded-lg bg-ink-100 animate-pulse" />
          <div className="h-10 w-24 rounded-lg bg-ink-100 animate-pulse" />
          <div className="h-10 w-24 rounded-lg bg-ink-100 animate-pulse" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="card overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/70 text-xs font-semibold uppercase tracking-wider text-ink-600">
              <tr>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Place Activities</th>
                <th className="px-4 py-3">Categories</th>
                <th className="px-4 py-3">Preferred Types</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <div className="h-5 w-24 rounded-md bg-ink-100 animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-44 rounded bg-ink-200/70 animate-pulse mb-1" />
                    <div className="h-3 w-64 rounded bg-ink-100 animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-5 w-20 rounded-full bg-ink-100 animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-5 w-20 rounded-full bg-ink-100 animate-pulse" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="h-8 w-16 rounded bg-ink-100 animate-pulse ml-auto" />
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
