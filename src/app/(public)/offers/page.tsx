import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Offers' };

export default async function OffersPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: offers } = await supabase
    .from('offers')
    .select('*, travel_packages(title, slug)')
    .eq('status', 'published')
    .gte('valid_to', today)
    .order('valid_to', { ascending: true });

  return (
    <div className="container-page pt-32 pb-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink-900">Special offers</h1>
        <p className="mt-2 text-ink-500">Limited-time savings on select packages</p>
      </div>

      {(offers ?? []).length === 0 ? (
        <p className="py-16 text-center text-ink-400">No active offers right now — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(offers ?? []).map((o) => {
            const pkgRaw = o.travel_packages as
              | { title: string; slug: string }
              | { title: string; slug: string }[]
              | null;
            const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] ?? null : pkgRaw;
            return (
              <div key={o.id} className="card-hover overflow-hidden">
                <div className="relative aspect-video overflow-hidden bg-ink-100">
                  {o.image_url && <Image src={o.image_url} alt={o.title} fill className="object-cover transition-transform duration-300 hover:scale-105" />}
                  <span className="badge-discount absolute left-3 top-3 shadow-sm">
                    {o.discount_percent ? `${o.discount_percent}% off` : `₹${o.discount_flat} off`}
                  </span>
                </div>
                <div className="p-4">
                  <h2 className="font-display text-lg font-semibold text-ink-900">{o.title}</h2>
                  {o.description && <p className="mt-1 text-sm text-ink-500 line-clamp-2">{o.description}</p>}
                  <p className="mt-2 text-xs text-ink-400">Valid until {formatDate(o.valid_to)}</p>
                  {pkg && (
                    <Link href={`/packages/${pkg.slug}`} className="btn-cta mt-3 w-full">
                      View {pkg.title}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
