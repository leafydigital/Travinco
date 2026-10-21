export default function BookingsLoading() {
  return (
    <div className="container-page max-w-4xl py-24 sm:py-28 space-y-6 animate-in fade-in duration-300">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-ink-100 animate-pulse" />
        <div className="h-8 w-60 rounded-xl bg-ink-200/80 animate-pulse" />
      </div>

      <div className="space-y-4 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <div className="h-4 w-28 rounded-full bg-ink-100 animate-pulse" />
              <div className="h-6 w-3/5 rounded-lg bg-ink-200/80 animate-pulse" />
              <div className="h-4 w-40 rounded bg-ink-100 animate-pulse" />
            </div>
            <div className="h-10 w-28 rounded-xl bg-ink-100 animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
