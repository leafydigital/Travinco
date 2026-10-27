export default function MasterLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-5">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-200/60" />
          <div className="h-4 w-96 animate-pulse rounded bg-ink-100" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-xl bg-ink-100" />
      </div>
      <div className="card p-6 rounded-2xl border border-ink-200/80 bg-white shadow-xs">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-ink-100/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
