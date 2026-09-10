import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { DestinationForm } from '../destination-form';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';

export default async function EditDestinationPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = await createClient();
  const { data: destination } = await supabase.from('destinations').select('*').eq('id', params.id).single();

  if (!destination) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink-900">{destination.name}</h1>
          <StatusBadge status={destination.status} />
        </div>
        <Link href="/admin/destinations" className="btn-outline">
          Back
        </Link>
      </div>
      <DestinationForm
        destinationId={destination.id}
        initialValues={{
          name: destination.name,
          slug: destination.slug,
          country: destination.country,
          description: destination.description,
          cover_image_url: destination.cover_image_url,
          is_featured: destination.is_featured,
          meta_title: destination.meta_title,
          meta_description: destination.meta_description,
        }}
      />
    </div>
  );
}
