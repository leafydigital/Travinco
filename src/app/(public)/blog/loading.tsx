import { HeroSectionSkeleton, CardGridSkeleton } from '@/components/ui/skeleton';

export default function BlogLoading() {
  return (
    <div className="min-h-screen bg-sand-50/40 pb-20">
      {/* Top Hero Section Skeleton */}
      <HeroSectionSkeleton />

      <div className="container-page pt-12 sm:pt-16 space-y-12">
        {/* Featured Story Skeleton Card */}
        <div className="rounded-3xl border border-ink-100 bg-white shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
            <div className="lg:col-span-7 min-h-[300px] sm:min-h-[380px] bg-ink-100 animate-pulse" />
            <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="h-4 w-32 rounded bg-ink-100 animate-pulse" />
                <div className="h-8 w-4/5 rounded-lg bg-ink-200/80 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-ink-100 animate-pulse" />
                  <div className="h-4 w-full rounded bg-ink-100 animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-ink-100 animate-pulse" />
                </div>
              </div>
              <div className="pt-4 border-t border-ink-100 flex items-center justify-between">
                <div className="h-5 w-28 rounded bg-ink-100 animate-pulse" />
                <div className="h-8 w-8 rounded-full bg-ink-100 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Story Grid Skeleton */}
        <CardGridSkeleton count={6} />
      </div>
    </div>
  );
}
