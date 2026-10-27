export default function PluginsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-ink-200/60 animate-pulse" />
          <div className="h-4 w-96 rounded bg-ink-100 animate-pulse" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-ink-100 animate-pulse" />
      </div>

      {/* Filter and Search Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="h-10 w-full max-w-md rounded-xl bg-ink-100 animate-pulse" />
        <div className="h-10 w-48 rounded-xl bg-ink-100 animate-pulse" />
      </div>

      {/* Table Skeleton */}
      <div className="overflow-hidden rounded-xl border border-ink-200/80 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink-700">
            <thead className="border-b border-ink-100 bg-ink-50/75 text-xs font-semibold uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-5 py-3.5">Plugin / Widget</th>
                <th className="px-4 py-3.5">Slot Location</th>
                <th className="px-4 py-3.5 text-center">Position</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-4">
                    <div className="h-4 w-40 rounded bg-ink-200/70" />
                    <div className="h-3 w-56 rounded bg-ink-100 mt-1.5" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-5 w-24 rounded-full bg-ink-100" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="h-6 w-8 rounded-md bg-ink-100 mx-auto" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="h-6 w-16 rounded-full bg-ink-100 mx-auto" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-20 rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="h-7 w-28 rounded-lg bg-ink-100 ml-auto" />
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
