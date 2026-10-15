'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { destinationSchema } from '@/lib/validations/settings';
import { revalidatePath } from 'next/cache';
import type { ContentStatus } from '@/types/database';

export async function createDestination(raw: unknown) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'destinations', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to create destinations.' };

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

  revalidatePath('/travinco_dashboard/destinations');
  return { id: data.id };
}

export async function updateDestination(id: string, raw: unknown) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'destinations', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to edit destinations.' };

  const parsed = destinationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('destinations')
    .update({ ...parsed.data, cover_image_url: parsed.data.cover_image_url || null })
    .eq('id', id);

  if (error) return { error: 'Could not update destination.' };

  revalidatePath('/travinco_dashboard/destinations');
  revalidatePath(`/travinco_dashboard/destinations/${id}`);
  revalidatePath('/destinations');
  return {};
}

export async function setDestinationStatus(id: string, status: ContentStatus) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'destinations', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to update destination status.' };

  const supabase = await createClient();
  const { error } = await supabase.from('destinations').update({ status }).eq('id', id);
  if (error) return { error: 'Could not update status.' };
  revalidatePath('/travinco_dashboard/destinations');
  revalidatePath('/destinations');
  return {};
}

export async function toggleDestinationActive(id: string, currentlyActive: boolean) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'destinations', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to update destination status.' };

  const supabase = await createClient();
  const newStatus: ContentStatus = currentlyActive ? 'archived' : 'published';

  // 1. Try updating both status and is_active (if column exists)
  const { error: activeError } = await supabase
    .from('destinations')
    .update({ status: newStatus, is_active: !currentlyActive } as any)
    .eq('id', id);

  // 2. If is_active column doesn't exist yet in DB, update status directly
  if (activeError) {
    const { error: statusError } = await supabase
      .from('destinations')
      .update({ status: newStatus })
      .eq('id', id);

    if (statusError) return { error: 'Could not change destination status.' };
  }

  revalidatePath('/travinco_dashboard/destinations');
  revalidatePath('/destinations');
  return {};
}

export async function deleteDestination(id: string) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'destinations', 'edit');
  if (!perm.allowed || !['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only administrators have permission to delete destinations.' };
  }

  const supabase = await createClient();
  let updateSuccess = false;

  // 1. Try secure RPC function first (bypasses RLS recursion)
  try {
    const { error: rpcError } = await supabase.rpc('soft_delete_destination', {
      destination_id: id,
    });
    if (!rpcError) {
      updateSuccess = true;
    }
  } catch {}

  // 2. Direct update fallback on destinations table
  if (!updateSuccess) {
    try {
      const { error: updateError } = await supabase
        .from('destinations')
        .update({ is_deleted: true } as any)
        .eq('id', id);

      if (!updateError) {
        updateSuccess = true;
      }
    } catch {}
  }

  // 3. Fallback tracking in website_settings so destination is guaranteed soft-deleted
  try {
    const { error: wsError } = await supabase.from('website_settings').upsert(
      {
        key: `deleted_destination_${id}`,
        value: { is_deleted: true, deleted_at: new Date().toISOString() },
      },
      { onConflict: 'key' }
    );
    if (!wsError) {
      updateSuccess = true;
    }
  } catch {}

  if (!updateSuccess) {
    return { error: 'Unable to delete destination. Please try again.' };
  }

  revalidatePath('/travinco_dashboard/destinations');
  revalidatePath('/travinco_dashboard');
  revalidatePath('/destinations');
  return {};
}
