import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { formatDate } from '@/lib/utils/format';
import { MapPin } from 'lucide-react';

export const metadata: Metadata = { title: 'Events' };

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .order('event_date', { ascending: true });

  return (
    <div className="container-page pt-32 pb-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink-900">Events</h1>
        <p className="mt-2 text-ink-500">Travel meetups, launches and seasonal happenings</p>
      </div>

      {(events ?? []).length === 0 ? (
        <p className="py-16 text-center text-ink-400">No upcoming events right now — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(events ?? []).map((e) => (
            <div key={e.id} className="card-hover overflow-hidden">
              <div className="relative aspect-video overflow-hidden bg-ink-100">
                {e.image_url && <Image src={e.image_url} alt={e.title} fill className="object-cover transition-transform duration-300 hover:scale-105" />}
                {e.event_date && (
                  <span className="badge-event absolute left-3 top-3 shadow-sm">
                    {formatDate(e.event_date)}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h2 className="font-display text-lg font-semibold text-ink-900">{e.title}</h2>
                {e.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                    <MapPin className="h-3.5 w-3.5" /> {e.location}
                  </p>
                )}
                {e.description && <p className="mt-2 text-sm text-ink-500 line-clamp-3">{e.description}</p>}
                {e.cta_label && (
                  <Link href={e.cta_url || '/contact'} className="btn-cta mt-3 w-full">
                    {e.cta_label}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
