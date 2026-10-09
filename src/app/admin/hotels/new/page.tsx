import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { HotelForm } from '../hotel-form';

export const metadata: Metadata = { title: 'New hotel — Admin Portal' };

export default async function NewHotelPage() {
  const profile = await requireProfile();
  if (!canEditMasters(profile)) redirect('/admin/hotels');
  const supabase = await createClient();
  const [{ data: locs }, { data: cats }] = await Promise.all([
    supabase.from('locations').select('id, name').order('name'),
    supabase.from('hotel_categories').select('id, name').order('sort_order'),
  ]);
  return (
    <div className="space-y-5 pb-16">
      <div>
        <Link href="/admin/hotels" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Hotels
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-ink-900">New hotel</h1>
        <p className="text-sm text-ink-500">Add a hotel and its contacts. Room rates come from the Rate Master upload under Master.</p>
      </div>
      <HotelForm hotel={null} locations={locs ?? []} categories={cats ?? []} canEdit />
    </div>
  );
}
