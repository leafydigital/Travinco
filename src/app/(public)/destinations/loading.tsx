import { HeroSectionSkeleton, CardGridSkeleton } from '@/components/ui/skeleton';

export default function DestinationsLoading() {
  return (
    <div className="min-h-screen bg-sand-50/40">
      {/* Top Hero Section Skeleton */}
      <HeroSectionSkeleton />

      {/* Floating Search Bar Skeleton */}
      <div className="container-page -mt-8 relative z-20">
        <div className="rounded-2xl sm:rounded-3xl border border-ink-100 bg-white p-4 sm:p-5 shadow-lg">
          <div className="h-12 w-full rounded-xl bg-ink-100 animate-pulse" />
        </div>
      </div>

      {/* Destinations Grid Area */}
      <div className="container-page py-12">
        <CardGridSkeleton count={6} />
      </div>
    </div>
  );
}
