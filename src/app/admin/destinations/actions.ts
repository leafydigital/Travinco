'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { destinationSchema } from '@/lib/validations/settings';
import { revalidatePath } from 'next/cache';
import type { ContentStatus } from '@/types/database';

export async function createDestination(raw: unknown) {
  await requireProfile();
  const parsed = destinationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('destinations')
    .insert({ ...parsed.data, cover_image_url: parsed.data.cover_image_url || null, status: 'draft' })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'A destination with this slug already exists.' };
    return { error: 'Could not create destination.' };
  }

  revalidatePath('/admin/destinations');
  return { id: data.id };
}

export async function updateDestination(id: string, raw: unknown) {
  await requireProfile();
  const parsed = destinationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('destinations')
    .update({ ...parsed.data, cover_image_url: parsed.data.cover_image_url || null })
    .eq('id', id);

  if (error) return { error: 'Could not update destination.' };

  revalidatePath('/admin/destinations');
  revalidatePath(`/admin/destinations/${id}`);
  revalidatePath('/destinations');
  return {};
}

export async function setDestinationStatus(id: string, status: ContentStatus) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('destinations').update({ status }).eq('id', id);
  if (error) return { error: 'Could not update status.' };
  revalidatePath('/admin/destinations');
  revalidatePath('/destinations');
  return {};
}

export async function deleteDestination(id: string) {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only admins can delete destinations.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('destinations').delete().eq('id', id);
  if (error) {
    return {
      error:
        'Could not delete destination — it likely still has packages linked to it. Reassign or delete those first.',
    };
  }

  revalidatePath('/admin/destinations');
  return {};
}
