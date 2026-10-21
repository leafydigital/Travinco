import { HeroSectionSkeleton, CardGridSkeleton } from '@/components/ui/skeleton';

export default function PublicLoading() {
  return (
    <div className="min-h-screen bg-sand-50/40">
      {/* Top Hero Section Skeleton */}
      <HeroSectionSkeleton />

      {/* Main Content Skeleton Area */}
      <div className="container-page py-12">
        <CardGridSkeleton count={6} />
      </div>
    </div>
  );
}
