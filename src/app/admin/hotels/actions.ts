'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';

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
  revalidatePath('/admin/hotels');
  revalidatePath(`/admin/hotels/${data.id}`);
  return { id: data.id };
}

export async function addHotelFollowup(hotelId: number, issue: string, action: string) {
  const supabase = await guard();
  if (!supabase) return { error: 'Only admins can add follow-ups.' };
  if (!issue.trim()) return { error: 'Describe the issue.' };
  const { error } = await supabase.from('hotel_followups').insert({ hotel_id: hotelId, issue: issue.trim().slice(0, 2000), action: action.trim().slice(0, 2000) || null });
  if (error) return { error: 'Could not add the follow-up.' };
  revalidatePath(`/admin/hotels/${hotelId}`);
  return {};
}

export async function setHotelFollowupStatus(hotelId: number, id: number, status: 'OPEN' | 'DONE') {
  const supabase = await guard();
  if (!supabase) return { error: 'Only admins can update follow-ups.' };
  const { error } = await supabase.from('hotel_followups').update({ status }).eq('id', id);
  if (error) return { error: 'Could not update the follow-up.' };
  revalidatePath(`/admin/hotels/${hotelId}`);
  return {};
}
