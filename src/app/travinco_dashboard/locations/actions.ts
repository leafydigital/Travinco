'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { invalidateTourMastersCache } from '@/lib/tour/data';
import { revalidatePath } from 'next/cache';

export type BulkLocationInput = {
  name: string;
  display_name?: string | null;
  state?: string | null;
  parent_id?: number | string | null;
  description?: string | null;
  is_houseboat?: boolean;
  sort_order?: number;
};

export type CreatedLocationItem = {
  id: number | string;
  name: string;
  display_name: string | null;
  state: string;
  parent_id: number | null;
  description: string | null;
  is_houseboat: boolean;
  sort_order: number;
  is_active: boolean;
};

export type BulkCreateLocationsResult = {
  error?: string;
  count?: number;
  created?: CreatedLocationItem[];
};

export async function bulkCreateLocations(
  items: BulkLocationInput[]
): Promise<BulkCreateLocationsResult> {
  const profile = await requireProfile();
  if (!canEditMasters(profile)) {
    return { error: 'Only administrators have permission to create locations.' };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Please provide at least one location to save.' };
  }

  // Filter items with valid name
  const candidates = items.filter(
    (l) => l && typeof l.name === 'string' && l.name.trim().length > 0
  );

  if (candidates.length === 0) {
    return { error: 'Please provide a valid name for at least one location card.' };
  }

  const supabase = await createClient();

  const payload = candidates.map((item, idx) => {
    const rawName = item.name.trim();
    const rawDisplayName = item.display_name?.trim() || null;
    const rawState = item.state?.trim() || 'Kerala';
    const parentId = item.parent_id ? Number(item.parent_id) : null;
    const sortOrder = item.sort_order != null && !isNaN(Number(item.sort_order)) ? Number(item.sort_order) : 100 + idx;

    return {
      name: rawName,
      display_name: rawDisplayName,
      state: rawState,
      parent_id: parentId && parentId > 0 ? parentId : null,
      description: item.description?.trim() || null,
      is_houseboat: Boolean(item.is_houseboat),
      sort_order: sortOrder,
      is_active: true,
      is_deleted: false,
    };
  });

  const { data, error } = await supabase
    .from('locations')
    .insert(payload)
    .select('id, name, display_name, state, parent_id, description, is_houseboat, sort_order, is_active');

  if (error) {
    console.error('Error in bulkCreateLocations:', error);
    if (error.code === '23505') {
      return { error: 'A location with this name already exists in the system.' };
    }
    return { error: error.message || 'Could not bulk create locations. Please try again.' };
  }

  try {
    invalidateTourMastersCache();
  } catch (err) {
    console.warn('Could not invalidate tour masters cache:', err);
  }

  [
    '/travinco_dashboard/locations',
    '/travinco_dashboard/locations/activities',
    '/travinco_dashboard/locations/distances',
    '/travinco_dashboard/quotations',
  ].forEach((p) => {
    try {
      revalidatePath(p);
    } catch {}
  });

  const createdItems: CreatedLocationItem[] = (data || []).map((d: any, idx: number) => ({
    id: d.id,
    name: d.name ?? payload[idx]?.name ?? '',
    display_name: d.display_name ?? payload[idx]?.display_name ?? null,
    state: d.state ?? payload[idx]?.state ?? 'Kerala',
    parent_id: d.parent_id ?? payload[idx]?.parent_id ?? null,
    description: d.description ?? payload[idx]?.description ?? null,
    is_houseboat: d.is_houseboat ?? payload[idx]?.is_houseboat ?? false,
    sort_order: d.sort_order ?? payload[idx]?.sort_order ?? 100,
    is_active: d.is_active ?? true,
  }));

  return {
    count: createdItems.length,
    created: createdItems,
  };
}
