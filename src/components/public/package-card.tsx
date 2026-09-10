import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Clock } from 'lucide-react';
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
};

export function PackageCard({ pkg }: { pkg: PackageCardData }) {
  return (
    <Link
      href={`/packages/${pkg.slug}`}
      className="card group overflow-hidden transition-shadow hover:shadow-md"
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
        {pkg.discount_price && (
          <span className="absolute left-3 top-3 badge bg-red-600 text-white">
            Special offer
          </span>
        )}
      </div>
      <div className="p-4">
        {pkg.destinationName && (
          <p className="flex items-center gap-1 text-xs font-medium text-brand-600">
            <MapPin className="h-3.5 w-3.5" /> {pkg.destinationName}
          </p>
        )}
        <h3 className="mt-1 font-display text-base font-semibold text-ink-900 line-clamp-2">
          {pkg.title}
        </h3>
        {pkg.short_description && (
          <p className="mt-1 text-sm text-ink-500 line-clamp-2">{pkg.short_description}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-ink-400">
            <Clock className="h-3.5 w-3.5" />
            {pkg.duration_days}D / {pkg.duration_nights}N
          </span>
          <div className="text-right">
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
        </div>
      </div>
    </Link>
  );
}
