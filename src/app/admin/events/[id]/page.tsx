import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { EventForm } from '../event-form';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';

export default async function EditEventPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('*').eq('id', params.id).single();

  if (!event) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink-900">{event.title}</h1>
          <StatusBadge status={event.status} />
        </div>
        <Link href="/admin/events" className="btn-outline">
          Back
        </Link>
      </div>
      <EventForm
        eventId={event.id}
        initialValues={{
          title: event.title,
          slug: event.slug,
          description: event.description,
          location: event.location,
          event_date: event.event_date,
          image_url: event.image_url,
          cta_label: event.cta_label,
          cta_url: event.cta_url,
        }}
      />
    </div>
  );
}
