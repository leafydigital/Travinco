'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { destinationSchema } from '@/lib/validations/settings';
import { slugify } from '@/lib/validations/package';
import { revalidatePath } from 'next/cache';
import type { ContentStatus } from '@/types/database';
import { invalidateTourMastersCache } from '@/lib/tour/data';

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
  invalidateTourMastersCache();
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
  invalidateTourMastersCache();
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
  invalidateTourMastersCache();
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
  invalidateTourMastersCache();
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
  invalidateTourMastersCache();
  return {};
}

export type BulkDestinationInput = {
  name: string;
  slug?: string | null;
  country?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  is_featured?: boolean;
  status?: ContentStatus;
  meta_title?: string | null;
  meta_description?: string | null;
};

export async function bulkCreateDestinations(
  items: BulkDestinationInput[]
): Promise<{ error?: string; count?: number; ids?: string[] }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'destinations', 'edit');
  if (!perm.allowed) {
    return { error: perm.error || 'You do not have permission to create destinations.' };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Please provide at least one destination to save.' };
  }

  // Filter items with a valid name (minimum 2 chars)
  const candidates = items.filter((d) => d && typeof d.name === 'string' && d.name.trim().length >= 2);
  if (candidates.length === 0) {
    return { error: 'Each destination must have a valid name (at least 2 characters).' };
  }

  const supabase = await createClient();

  // Fetch all existing destination slugs to avoid collision
  const { data: existingDestinations } = await supabase.from('destinations').select('slug');
  const usedSlugs = new Set((existingDestinations || []).map((d: any) => (d.slug || '').toLowerCase()));

  // Prepare payload with sanitized fields and guaranteed unique slugs
  const payload = candidates.map((item) => {
    const rawName = item.name.trim();
    let baseSlug = item.slug ? slugify(item.slug) : slugify(rawName);
    if (!baseSlug) baseSlug = 'destination';
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    usedSlugs.add(slug);

    return {
      name: rawName,
      slug,
      country: item.country ? item.country.trim() : null,
      description: item.description ? item.description.trim() : null,
      cover_image_url: item.cover_image_url || null,
      is_featured: Boolean(item.is_featured),
      status: (item.status === 'published' ? 'published' : 'draft') as ContentStatus,
      meta_title: item.meta_title ? item.meta_title.trim() : `${rawName} Travel Guide & Tour Packages`,
      meta_description: item.meta_description ? item.meta_description.trim() : null,
    };
  });

  const { data, error } = await supabase
    .from('destinations')
    .insert(payload)
    .select('id');

  if (error) {
    console.error('Error in bulkCreateDestinations:', error);
    return { error: error.message || 'Could not bulk create destinations. Please try again.' };
  }

  revalidatePath('/travinco_dashboard/destinations');
  revalidatePath('/travinco_dashboard');
  revalidatePath('/destinations');
  invalidateTourMastersCache();

  return { count: data?.length ?? payload.length, ids: (data || []).map((d: any) => d.id) };
}

export interface DestinationTableItem {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  cover_image_url: string | null;
  is_featured: boolean;
  status: ContentStatus;
  is_active?: boolean;
}

export interface DestinationsTableQueryResult {
  destinations: DestinationTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

/**
 * Fast, lean query fetching strictly the 5 display columns:
 * Image, Destination (name/slug/id), Country, Featured, Status.
 * Excludes heavy description, meta fields, and other non-table attributes.
 */
export async function getDestinationsTableList({
  page = 1,
  pageSize = 20,
  q = '',
  status = 'all',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
} = {}): Promise<DestinationsTableQueryResult> {
  const profile = await requireProfile();
  await checkModulePermission(profile, 'destinations', 'view');

  const supabase = await createClient();

  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('destinations')
    .select(
      'id, name, slug, country, cover_image_url, is_featured, status, is_deleted',
      { count: 'exact' }
    )
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (status && status !== 'all') {
    query = query.eq('status', status as any);
  }

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%,country.ilike.%${term}%`);
  }

  const [destinationsRes, deletedSettingsRes] = await Promise.all([
    query.range(from, to),
    supabase.from('website_settings').select('key').like('key', 'deleted_destination_%'),
  ]);

  const deletedKeys = new Set(
    (deletedSettingsRes.data || []).map((s: { key: string }) => s.key.replace('deleted_destination_', ''))
  );

  const rawRows = destinationsRes.data || [];
  const activeRows = rawRows.filter(
    (d: any) => d.is_deleted !== true && !deletedKeys.has(d.id)
  );

  const items: DestinationTableItem[] = activeRows.map((d: any) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    country: d.country || null,
    cover_image_url: d.cover_image_url || null,
    is_featured: Boolean(d.is_featured),
    status: d.status,
    is_active: d.status === 'published',
  }));

  const totalCount = destinationsRes.count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    destinations: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  };
}

