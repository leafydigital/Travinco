import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, Mail, MessageCircle, MapPin, Globe } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, canEditMasters } from '@/lib/tour/access';
import { HotelForm } from '../hotel-form';
import { HotelFollowups } from '../followups';

export const metadata: Metadata = { title: 'Hotel — Admin Portal' };

const money = (v: unknown) => (v == null ? '—' : `₹${Math.round(Number(v)).toLocaleString('en-IN')}`);

export default async function HotelDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  assertTourAccess(profile, 'masters');
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const supabase = await createClient();

  const [{ data: hotel }, { data: locs }, { data: cats }, { data: rates }, { data: followups }] = await Promise.all([
    supabase.from('hotels').select('*').eq('id', id).maybeSingle(),
    supabase.from('locations').select('id, name').order('name'),
    supabase.from('hotel_categories').select('id, name').order('sort_order'),
    supabase.from('v_rate_master').select('*').eq('hotel_id', id).eq('is_active', true).order('room_category').order('season'),
    supabase.from('hotel_followups').select('*').eq('hotel_id', id).order('created_at', { ascending: false }),
  ]);
  if (!hotel) notFound();
  const canEdit = canEditMasters(profile);
  const wa = hotel.whatsapp ? String(hotel.whatsapp).replace(/[^\d]/g, '') : '';

  return (
    <div className="space-y-6 pb-16">
      <div>
        <Link href="/admin/hotels" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Hotels
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-ink-900">{hotel.name}</h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {hotel.phone && <a href={`tel:${hotel.phone}`} className="inline-flex items-center gap-1 text-ink-600 hover:text-brand-700"><Phone className="h-4 w-4" />{hotel.phone}</a>}
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-600 hover:text-brand-700"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
          {(hotel.reservation_email || hotel.email) && <a href={`mailto:${hotel.reservation_email || hotel.email}`} className="inline-flex items-center gap-1 text-ink-600 hover:text-brand-700"><Mail className="h-4 w-4" />{hotel.reservation_email || hotel.email}</a>}
          {hotel.google_maps_url && <a href={hotel.google_maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-600 hover:text-brand-700"><MapPin className="h-4 w-4" />Map</a>}
          {hotel.website && <a href={hotel.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-600 hover:text-brand-700"><Globe className="h-4 w-4" />Website</a>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <HotelForm hotel={hotel} locations={locs ?? []} categories={cats ?? []} canEdit={canEdit} />
        <div className="space-y-6">
          <HotelFollowups hotelId={id} items={followups ?? []} canEdit={canEdit} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="font-semibold text-ink-900">Rooms &amp; current rates</h2>
          <p className="text-sm text-ink-500">From the active Rate Master upload. Per room per night; extra adult / child per person per night.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Season</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3 text-right">CP</th>
                <th className="px-4 py-3 text-right">MAP</th>
                <th className="px-4 py-3 text-right">Extra adult CP / MAP</th>
                <th className="px-4 py-3 text-right">Child bed / no bed</th>
              </tr>
            </thead>
            <tbody>
              {(rates ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-400">No rates for this hotel in the Rate Master yet.</td></tr>
              )}
              {(rates ?? []).map((r) => (
                <tr key={r.rate_id} className="border-b border-ink-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink-800">{r.room_category}<p className="text-xs font-normal text-ink-400">{r.hotel_category}</p></td>
                  <td className="px-4 py-2.5 text-ink-600">{r.season}</td>
                  <td className="px-4 py-2.5 text-ink-600">{r.date_range}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(r.cp_cost)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(r.map_cost)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(r.extra_adult_cp)} / {money(r.extra_adult_map)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(r.child_bed_cost)} / {money(r.child_no_bed_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
