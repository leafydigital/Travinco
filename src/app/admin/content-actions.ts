'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { eventSchema, offerSchema } from '@/lib/validations/content';
import { revalidatePath } from 'next/cache';
import type { ContentStatus } from '@/types/database';

// ---------- EVENTS ----------

export async function createEvent(raw: unknown) {
  await requireProfile();
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .insert({ ...parsed.data, image_url: parsed.data.image_url || null, status: 'draft' })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'An event with this slug already exists.' };
    return { error: 'Could not create event.' };
  }

  revalidatePath('/admin/events');
  return { id: data.id };
}

export async function updateEvent(id: string, raw: unknown) {
  await requireProfile();
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('events')
    .update({ ...parsed.data, image_url: parsed.data.image_url || null })
    .eq('id', id);

  if (error) return { error: 'Could not update event.' };
  revalidatePath('/admin/events');
  revalidatePath(`/admin/events/${id}`);
  revalidatePath('/events');
  return {};
}

export async function setEventStatus(id: string, status: ContentStatus) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('events').update({ status }).eq('id', id);
  if (error) return { error: 'Could not update status.' };
  revalidatePath('/admin/events');
  revalidatePath('/events');
  return {};
}

export async function deleteEvent(id: string) {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) return { error: 'Only admins can delete events.' };

  const supabase = await createClient();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return { error: 'Could not delete event.' };
  revalidatePath('/admin/events');
  return {};
}

// ---------- OFFERS ----------

export async function createOffer(raw: unknown) {
  await requireProfile();
  const parsed = offerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('offers')
    .insert({
      ...parsed.data,
      package_id: parsed.data.package_id || null,
      event_id: parsed.data.event_id || null,
      image_url: parsed.data.image_url || null,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'An offer with this slug already exists.' };
    return { error: 'Could not create offer.' };
  }

  revalidatePath('/admin/offers');
  return { id: data.id };
}

export async function updateOffer(id: string, raw: unknown) {
  await requireProfile();
  const parsed = offerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('offers')
    .update({
      ...parsed.data,
      package_id: parsed.data.package_id || null,
      event_id: parsed.data.event_id || null,
      image_url: parsed.data.image_url || null,
    })
    .eq('id', id);

  if (error) return { error: 'Could not update offer.' };
  revalidatePath('/admin/offers');
  revalidatePath(`/admin/offers/${id}`);
  revalidatePath('/offers');
  return {};
}

export async function setOfferStatus(id: string, status: ContentStatus) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('offers').update({ status }).eq('id', id);
  if (error) return { error: 'Could not update status.' };
  revalidatePath('/admin/offers');
  revalidatePath('/offers');
  return {};
}

export async function deleteOffer(id: string) {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) return { error: 'Only admins can delete offers.' };

  const supabase = await createClient();
  const { error } = await supabase.from('offers').delete().eq('id', id);
  if (error) return { error: 'Could not delete offer.' };
  revalidatePath('/admin/offers');
  return {};
}

// ---------- GALLERY ----------

export async function addGalleryImage(imageUrl: string, title: string, category: string) {
  await requireProfile();
  if (!imageUrl.trim()) return { error: 'Image URL is required.' };

  const supabase = await createClient();
  const { error } = await supabase.from('gallery').insert({
    image_url: imageUrl.trim(),
    title: title.trim() || null,
    category: category.trim() || null,
    status: 'published',
  });

  if (error) return { error: 'Could not add image.' };
  revalidatePath('/admin/gallery');
  revalidatePath('/gallery');
  return {};
}

export async function setGalleryImageStatus(id: string, status: ContentStatus) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('gallery').update({ status }).eq('id', id);
  if (error) return { error: 'Could not update image status.' };
  revalidatePath('/admin/gallery');
  revalidatePath('/gallery');
  return {};
}

export async function deleteGalleryImage(id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('gallery').delete().eq('id', id);
  if (error) return { error: 'Could not delete image.' };
  revalidatePath('/admin/gallery');
  revalidatePath('/gallery');
  return {};
}
