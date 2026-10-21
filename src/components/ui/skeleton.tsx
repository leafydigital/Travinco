import { cn } from '@/lib/utils/cn';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-ink-200/70', className)}
      {...props}
    />
  );
}

/**
 * Skeleton for atmospheric top hero section across Packages, Destinations, Blog, and About
 */
export function HeroSectionSkeleton() {
  return (
    <section className="relative overflow-hidden bg-navy-950 pt-36 pb-20 sm:pt-44 sm:pb-24 text-white">
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/90 via-navy-900/60 to-navy-950/95" />
      <div className="container-page relative z-10 mx-auto px-4 flex flex-col items-center text-center">
        {/* Shimmer Pill Badge */}
        <div className="h-6 w-36 rounded-full bg-white/10 animate-pulse mb-4" />
        {/* Shimmer Main Title */}
        <div className="h-10 sm:h-14 w-64 sm:w-96 rounded-2xl bg-white/15 animate-pulse mb-4" />
        {/* Shimmer Subtitle */}
        <div className="h-4 w-full max-w-lg rounded-lg bg-white/10 animate-pulse mb-2" />
        <div className="h-4 w-full max-w-md rounded-lg bg-white/10 animate-pulse mb-6" />
        {/* Shimmer Highlights */}
        <div className="flex gap-4 pt-2">
          <div className="h-4 w-28 rounded-md bg-white/10 animate-pulse" />
          <div className="h-4 w-28 rounded-md bg-white/10 animate-pulse" />
          <div className="h-4 w-28 rounded-md bg-white/10 animate-pulse" />
        </div>
      </div>
    </section>
  );
}

/**
 * Skeleton for responsive 3-column card grid (packages, destinations, blogs)
 */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-ink-100 bg-white p-4 sm:p-5 space-y-4 shadow-xs"
        >
          {/* Card Image Thumbnail */}
          <div className="aspect-[16/10] w-full rounded-2xl bg-ink-100 animate-pulse" />
          <div className="space-y-2.5 pt-1">
            {/* Tag / Category */}
            <div className="h-4 w-24 rounded-full bg-ink-100 animate-pulse" />
            {/* Card Title */}
            <div className="h-6 w-4/5 rounded-lg bg-ink-200/80 animate-pulse" />
            {/* Description lines */}
            <div className="h-3.5 w-full rounded bg-ink-100 animate-pulse" />
            <div className="h-3.5 w-3/4 rounded bg-ink-100 animate-pulse" />
          </div>
          {/* Card Footer Bar */}
          <div className="pt-3 border-t border-ink-100 flex items-center justify-between">
            <div className="h-4 w-20 rounded bg-ink-100 animate-pulse" />
            <div className="h-7 w-7 rounded-full bg-ink-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
