'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters, canAccess } from '@/lib/tour/access';

const optStr = (max: number) =>
  z.preprocess((v) => (v == null || String(v).trim() === '' ? null : String(v).trim()), z.string().max(max).nullable());
const optId = z.preprocess((v) => (v == null || String(v).trim() === '' ? null : Number(v)), z.number().int().positive().nullable());

const hotelSchema = z.object({
  name: z.preprocess((v) => String(v ?? '').trim(), z.string().min(1, 'Hotel name is required').max(150)),
  location_id: z.preprocess((v) => Number(v), z.number().int().positive({ message: 'Choose a location' })),
  default_category_id: optId,
  area: optStr(80),
  gst_basis: optStr(40),
  contact_person: optStr(120),
  phone: optStr(30),
  alt_phone: optStr(30),
  whatsapp: optStr(30),
  email: optStr(150).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email'),
  reservation_email: optStr(150).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid reservation email'),
  website: optStr(255),
  address: optStr(2000),
  google_maps_url: optStr(2000),
  check_in_time: optStr(10),
  check_out_time: optStr(10),
  gstin: optStr(20),
  amenities: optStr(4000),
  payment_terms: optStr(4000),
  bank_details: optStr(4000),
  notes: optStr(4000),
  is_active: z.preprocess((v) => v === true || v === 'true' || v === 'on', z.boolean()),
});

async function guard() {
  const profile = await requireProfile();
  if (!canEditMasters(profile)) return null;
  return createClient();
}

export async function saveHotel(id: number | null, raw: Record<string, unknown>): Promise<{ error?: string; id?: number }> {
  const parsed = hotelSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const supabase = await guard();
  if (!supabase) return { error: 'Only admins can edit hotels.' };
  const q =
    id == null
      ? supabase.from('hotels').insert(parsed.data).select('id').single()
      : supabase.from('hotels').update(parsed.data).eq('id', id).select('id').single();
  const { data, error } = await q;
  if (error) {
    if (error.code === '23505') return { error: 'A hotel with this name already exists in that location.' };
    console.error('saveHotel', error.message);
    return { error: 'Could not save the hotel.' };
  }
  revalidatePath('/travinco_dashboard/hotels');
  revalidatePath(`/travinco_dashboard/hotels/${data.id}`);
  revalidatePath(`/admin/hotels/${data.id}`);
  return { id: data.id };
}

export async function addHotelFollowup(hotelId: number, issue: string, action: string) {
  const supabase = await guard();
  if (!supabase) return { error: 'Only admins can add follow-ups.' };
  if (!issue.trim()) return { error: 'Describe the issue.' };
  const { error } = await supabase.from('hotel_followups').insert({ hotel_id: hotelId, issue: issue.trim().slice(0, 2000), action: action.trim().slice(0, 2000) || null });
  if (error) return { error: 'Could not add the follow-up.' };
  revalidatePath(`/travinco_dashboard/hotels/${hotelId}`);
  revalidatePath(`/admin/hotels/${hotelId}`);
  return {};
}

export async function setHotelFollowupStatus(hotelId: number, id: number, status: 'OPEN' | 'DONE') {
  const supabase = await guard();
  if (!supabase) return { error: 'Only admins can update follow-ups.' };
  const { error } = await supabase.from('hotel_followups').update({ status }).eq('id', id);
  if (error) return { error: 'Could not update the follow-up.' };
  revalidatePath(`/travinco_dashboard/hotels/${hotelId}`);
  revalidatePath(`/admin/hotels/${hotelId}`);
  return {};
}

export async function deleteHotel(id: number): Promise<{ error?: string }> {
  const supabase = await guard();
  if (!supabase) return { error: 'Only admins can delete hotels.' };
  const { error } = await supabase.from('hotels').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return { error: 'Cannot delete this hotel because it has associated rates, rooms, or quotations.' };
    }
    console.error('deleteHotel error:', error.message);
    return { error: 'Could not delete hotel: ' + error.message };
  }
  revalidatePath('/travinco_dashboard/hotels');
  return {};
}

export interface HotelTableItem {
  id: number;
  name: string;
  area: string | null;
  location_name: string | null;
  category_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  rooms_count: number;
}

export interface HotelsTableQueryResult {
  hotels: HotelTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

/**
 * Fast, lean query fetching strictly the 5 visible columns for the hotels table:
 * Hotel (name, area), Location (locations.name), Category (hotel_categories.name),
 * Contact (contact_person, phone, email), Rooms (room_types.count).
 * Excludes heavy fields: address, google_maps_url, website, amenities, payment_terms, bank_details, notes, etc.
 */
export async function getHotelsTableList({
  page = 1,
  pageSize = 20,
  q = '',
  location = '',
  category = '',
  contact = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  location?: string;
  category?: string;
  contact?: string;
} = {}): Promise<HotelsTableQueryResult> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return { hotels: [], totalCount: 0, totalPages: 1, page: 1, pageSize };
  }

  const supabase = await createClient();
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('hotels')
    .select(
      'id, name, area, contact_person, phone, email, location_id, default_category_id, locations(name), hotel_categories(name), room_types(count)',
      { count: 'exact' }
    )
    .order('name')
    .range(from, to);

  const term = q.replace(/[,()%*]/g, ' ').trim();
  if (term) {
    query = query.or(
      `name.ilike.%${term}%,contact_person.ilike.%${term}%,phone.ilike.%${term}%,area.ilike.%${term}%`
    );
  }
  if (location) {
    query = query.eq('location_id', Number(location));
  }
  if (category) {
    query = query.eq('default_category_id', Number(category));
  }
  if (contact === 'missing') {
    query = query.is('phone', null);
  }

  const { data: rows, count, error } = await query;
  if (error) {
    console.error('getHotelsTableList error:', error.message);
  }

  const one = <T>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const items: HotelTableItem[] = (rows ?? []).map((h: any) => {
    const loc = one(h.locations as { name: string } | { name: string }[] | null);
    const cat = one(h.hotel_categories as { name: string } | { name: string }[] | null);
    const room = one(h.room_types as { count: number }[] | { count: number } | null);

    return {
      id: h.id,
      name: h.name,
      area: h.area || null,
      location_name: loc?.name || null,
      category_name: cat?.name || null,
      contact_person: h.contact_person || null,
      phone: h.phone || null,
      email: h.email || null,
      rooms_count: room?.count ?? 0,
    };
  });

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    hotels: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  };
}
