export default function TransportLoading() {
  return (
    <div className="space-y-5">
      {/* 1. Header Structure */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Transportation</h1>
          <p className="text-sm text-ink-500">
            Vehicles and transport companies. Quotations charge the amount, then extra kilometres above the free limit at the per-km rate.
          </p>
        </div>
        <div className="h-9 w-28 animate-pulse rounded bg-ink-100" />
      </div>

      {/* 2. Filters & Search Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <div className="input w-full bg-ink-50/50 text-ink-400">Search vehicle, company, contact, phone…</div>
        </div>
        <div className="input w-44 bg-ink-50/50 text-ink-400">All car types</div>
        <div className="btn-outline opacity-70">Refresh</div>
      </div>

      {/* 3. Table Skeleton */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Car type</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Free km</th>
                <th className="px-5 py-3 text-right">Extra / km</th>
                <th className="px-5 py-3 text-right">Bata / day</th>
                <th className="px-5 py-3 text-center">Active</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-ink-50 last:border-0">
                  <td className="px-5 py-3">
                    <div className="h-4 w-28 animate-pulse rounded bg-ink-200/70 mb-1.5" />
                    <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-4 w-28 animate-pulse rounded bg-ink-200/70 mb-1.5" />
                    <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-ink-200/70 mb-1.5" />
                    <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="h-4 w-16 animate-pulse rounded bg-ink-100 ml-auto" />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="h-4 w-16 animate-pulse rounded bg-ink-100 ml-auto" />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="h-4 w-12 animate-pulse rounded bg-ink-100 ml-auto" />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="h-4 w-12 animate-pulse rounded bg-ink-100 ml-auto" />
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
