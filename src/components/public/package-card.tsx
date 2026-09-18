import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Clock, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

export type PackageCardData = {
  slug: string;
  title: string;
  cover_image_url: string | null;
  duration_days: number;
  duration_nights: number;
  base_price: number;
  discount_price: number | null;
  currency: string;
  short_description: string | null;
  destinationName?: string;
  hasActiveOffer?: boolean;
};

export function PackageCard({ pkg }: { pkg: PackageCardData }) {
  return (
    <Link
      href={`/packages/${pkg.slug}`}
      className="card-hover group overflow-hidden"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-100">
        {pkg.cover_image_url ? (
          <Image
            src={pkg.cover_image_url}
            alt={pkg.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-300">No image</div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          {pkg.destinationName && (
            <span className="badge-destination bg-white/95 shadow-sm">
              <MapPin className="mr-1 h-3 w-3" /> {pkg.destinationName}
            </span>
          )}
          {pkg.hasActiveOffer && (
            <span className="badge-discount shadow-sm">
              <Sparkles className="mr-1 h-3 w-3" /> Special offer
            </span>
          )}
        </div>
        <span className="badge-duration absolute bottom-3 left-3 bg-white/95 shadow-sm">
          <Clock className="mr-1 h-3 w-3" />
          {pkg.duration_days}D / {pkg.duration_nights}N
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-display text-base font-semibold text-ink-900 line-clamp-2">
          {pkg.title}
        </h3>
        {pkg.short_description && (
          <p className="mt-1 text-sm text-ink-500 line-clamp-2">{pkg.short_description}</p>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
          <div>
            {pkg.discount_price ? (
              <>
                <span className="block text-xs text-ink-400 line-through">
                  {formatCurrency(pkg.base_price, pkg.currency)}
                </span>
                <span className="font-semibold text-brand-700">
                  {formatCurrency(pkg.discount_price, pkg.currency)}
                </span>
              </>
            ) : (
              <span className="font-semibold text-brand-700">
                {formatCurrency(pkg.base_price, pkg.currency)}
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-coral-600 transition-transform group-hover:translate-x-0.5">
            View details →
          </span>
        </div>
      </div>
    </Link>
  );
}
