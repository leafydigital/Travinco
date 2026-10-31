export default function InvoicesLoading() {
  return (
    <div className="space-y-5">
      {/* 1. Header Structure */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Invoices</h1>
          <p className="text-sm text-ink-500">Created from quotations with “Convert to Invoice”.</p>
        </div>
      </div>

      {/* 2. Filter Pills Skeleton */}
      <div className="flex flex-wrap gap-1.5">
        {['All', 'Issued', 'Partially Paid', 'Paid', 'Cancelled'].map((label, idx) => (
          <div
            key={label}
            className={`badge capitalize ${
              idx === 0
                ? 'bg-brand-700 text-white'
                : 'bg-white text-ink-600 ring-1 ring-ink-200'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 3. Search Bar Skeleton */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
        <div className="relative min-w-[200px] sm:min-w-[220px] max-w-md flex-1 w-full">
          <div className="input w-full bg-ink-50/50 text-ink-400">Search invoice number, guest, phone…</div>
        </div>
        <div className="btn-outline w-full sm:w-auto opacity-70">Refresh</div>
      </div>

      {/* 4. Table Skeleton */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Quote #</th>
                <th className="px-5 py-3">Bill to</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Balance</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-3.5"><div className="h-4 w-28 rounded bg-ink-200/70" /></td>
                  <td className="px-5 py-3.5"><div className="h-4 w-24 rounded bg-ink-100" /></td>
                  <td className="px-5 py-3.5">
                    <div className="h-4 w-32 rounded bg-ink-200/70 mb-1.5" />
                    <div className="h-3 w-24 rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-3.5"><div className="h-4 w-20 rounded bg-ink-100" /></td>
                  <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 rounded bg-ink-200/70 ml-auto" /></td>
                  <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 rounded bg-ink-100 ml-auto" /></td>
                  <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 rounded bg-ink-100 ml-auto" /></td>
                  <td className="px-5 py-3.5"><div className="h-6 w-16 rounded-full bg-ink-100" /></td>
                  <td className="px-5 py-3.5 text-right"><div className="h-8 w-16 rounded bg-ink-100 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
