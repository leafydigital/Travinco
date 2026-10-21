export default function PackageDetailLoading() {
  return (
    <div className="container-page py-24 sm:py-28 space-y-8 animate-in fade-in duration-300">
      {/* Breadcrumb Skeleton */}
      <div className="h-4 w-48 rounded bg-ink-100 animate-pulse" />

      {/* Hero Gallery Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 aspect-[16/10] rounded-3xl bg-ink-200/60 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
          <div className="aspect-[16/10] rounded-2xl bg-ink-100 animate-pulse" />
          <div className="aspect-[16/10] rounded-2xl bg-ink-100 animate-pulse" />
        </div>
      </div>

      {/* Main Content & Booking Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        <div className="lg:col-span-2 space-y-6">
          {/* Title & Metadata */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="h-6 w-24 rounded-full bg-ink-100 animate-pulse" />
              <div className="h-6 w-28 rounded-full bg-ink-100 animate-pulse" />
            </div>
            <div className="h-9 w-4/5 rounded-xl bg-ink-200/80 animate-pulse" />
            <div className="h-4 w-full rounded bg-ink-100 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-ink-100 animate-pulse" />
          </div>

          {/* Itinerary Day Cards */}
          <div className="space-y-4 pt-4 border-t border-ink-100">
            <div className="h-6 w-36 rounded bg-ink-200/80 animate-pulse" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-ink-100 p-5 space-y-2 bg-white">
                <div className="h-5 w-40 rounded bg-ink-200/80 animate-pulse" />
                <div className="h-4 w-full rounded bg-ink-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Sticky Booking Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-6 rounded-3xl border border-ink-100 bg-white space-y-5 shadow-lg">
            <div className="space-y-2">
              <div className="h-4 w-20 rounded bg-ink-100 animate-pulse" />
              <div className="h-9 w-36 rounded-lg bg-ink-200/80 animate-pulse" />
            </div>
            <div className="h-12 w-full rounded-xl bg-brand-200/60 animate-pulse" />
            <div className="h-10 w-full rounded-xl bg-ink-100 animate-pulse" />
            <div className="space-y-2 pt-2 border-t border-ink-100">
              <div className="h-4 w-full rounded bg-ink-100 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-ink-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
