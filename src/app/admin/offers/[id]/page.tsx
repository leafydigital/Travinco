import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { OfferForm } from '../offer-form';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';

export default async function EditOfferPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = await createClient();
  const [{ data: offer }, { data: packages }] = await Promise.all([
    supabase.from('offers').select('*').eq('id', params.id).single(),
    supabase.from('travel_packages').select('id, title, base_price, currency').order('title'),
  ]);

  if (!offer) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink-900">{offer.title}</h1>
          <StatusBadge status={offer.status} />
        </div>
        <Link href="/admin/offers" className="btn-outline">
          Back
        </Link>
      </div>
      <OfferForm
        offerId={offer.id}
        packages={packages ?? []}
        initialValues={{
          title: offer.title,
          slug: offer.slug,
          description: offer.description,
          package_id: offer.package_id,
          event_id: offer.event_id,
          discount_percent: offer.discount_percent,
          discount_flat: offer.discount_flat,
          valid_from: offer.valid_from,
          valid_to: offer.valid_to,
          image_url: offer.image_url,
          terms: offer.terms,
        }}
      />
    </div>
  );
}
