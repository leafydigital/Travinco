import { HeroSectionSkeleton, CardGridSkeleton } from '@/components/ui/skeleton';

export default function PackagesLoading() {
  return (
    <div className="min-h-screen bg-sand-50/40">
      {/* Top Hero Section Skeleton */}
      <HeroSectionSkeleton />

      {/* Floating Filter Bar Skeleton */}
      <div className="container-page -mt-8 relative z-20">
        <div className="rounded-2xl sm:rounded-3xl border border-ink-100 bg-white p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row gap-3">
          <div className="h-12 flex-1 rounded-xl bg-ink-100 animate-pulse" />
          <div className="h-12 w-full sm:w-44 rounded-xl bg-ink-100 animate-pulse" />
          <div className="h-12 w-full sm:w-44 rounded-xl bg-ink-100 animate-pulse" />
        </div>
      </div>

      {/* Packages Grid Area */}
      <div className="container-page py-12">
        <CardGridSkeleton count={6} />
      </div>
    </div>
  );
}
