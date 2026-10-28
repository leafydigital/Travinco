import { HeroSectionSkeleton, CardGridSkeleton } from '@/components/ui/skeleton';

/**
 * Instant feedback while a public page is being fetched on navigation
 * (header & footer from the layout stay visible). Most pages are served
 * from cache, so this usually flashes briefly or not at all.
 */
export default function PublicLoading() {
  return (
    <div className="animate-in fade-in duration-150">
      <HeroSectionSkeleton />
      <section className="container-page py-12 sm:py-16">
        <CardGridSkeleton count={6} />
      </section>
    </div>
  );
}
