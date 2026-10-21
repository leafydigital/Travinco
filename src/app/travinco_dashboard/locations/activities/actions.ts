'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { invalidateTourMastersCache } from '@/lib/tour/data';
import { revalidatePath } from 'next/cache';

export type BulkActivityInput = {
  location_id: number | string;
  name: string;
  category?: string | null;
  preferred_types?: string | null;
  description?: string | null;
  is_active?: boolean;
};

export type CreatedActivityItem = {
  id: number | string;
  location_id: number;
  name: string;
  category: string;
  preferred_types: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type BulkCreateActivitiesResult = {
  error?: string;
  count?: number;
  created?: CreatedActivityItem[];
};

export async function bulkCreateActivities(
  items: BulkActivityInput[]
): Promise<BulkCreateActivitiesResult> {
  const profile = await requireProfile();
  if (!canEditMasters(profile)) {
    return { error: 'Only administrators have permission to create activities.' };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Please provide at least one activity to save.' };
  }

  // Filter items that have a valid name and location_id
  const candidates = items.filter(
    (a) => a && Number(a.location_id) > 0 && typeof a.name === 'string' && a.name.trim().length > 0
  );

  if (candidates.length === 0) {
    return { error: 'Please provide a valid location and activity name for at least one card.' };
  }

  const supabase = await createClient();

  const payload = candidates.map((item) => {
    const rawName = item.name.trim();
    const category = item.category?.trim() || 'Sightseeing';
    const kind = category.toLowerCase().includes('activity')
      ? 'activity'
      : category.toLowerCase().includes('experience')
      ? 'experience'
      : category.toLowerCase().includes('adventure')
      ? 'adventure'
      : category.toLowerCase().includes('temple')
      ? 'temple'
      : category.toLowerCase().includes('shopping')
      ? 'shopping'
      : 'sightseeing';

    return {
      location_id: Number(item.location_id),
      name: rawName,
      category,
      kind,
      preferred_types: item.preferred_types?.trim() || 'All',
      description: item.description?.trim() || null,
      is_active: item.is_active !== false,
      is_deleted: false,
      sort_order: 100,
    };
  });

  let { data, error } = await supabase
    .from('location_activities')
    .insert(payload)
    .select('id, location_id, name, category, preferred_types, description, is_active, sort_order');

  // Fallback if category or preferred_types columns don't exist yet in the database schema
  if (
    error &&
    (error.code === '42703' ||
      error.message?.includes('category') ||
      error.message?.includes('preferred_types'))
  ) {
    const fallbackPayload = payload.map((p) => {
      const copy: Record<string, unknown> = { ...p };
      delete copy.category;
      delete copy.preferred_types;
      return copy;
    });

    const retry = await supabase
      .from('location_activities')
      .insert(fallbackPayload)
      .select('id, location_id, name, description, is_active, sort_order');

    error = retry.error;
    data = retry.data as any;
  }

  if (error) {
    console.error('Error in bulkCreateActivities:', error);
    return { error: error.message || 'Could not bulk create activities. Please try again.' };
  }

  try {
    invalidateTourMastersCache();
  } catch (err) {
    console.warn('Could not invalidate tour masters cache:', err);
  }

  ['/travinco_dashboard/locations', '/travinco_dashboard/locations/activities', '/travinco_dashboard/quotations'].forEach((p) => {
    try {
      revalidatePath(p);
    } catch {}
  });

  const createdItems: CreatedActivityItem[] = (data || []).map((d: any, idx: number) => ({
    id: d.id,
    location_id: d.location_id ?? payload[idx]?.location_id ?? 0,
    name: d.name ?? payload[idx]?.name ?? '',
    category: d.category ?? payload[idx]?.category ?? 'Sightseeing',
    preferred_types: d.preferred_types ?? payload[idx]?.preferred_types ?? 'All',
    description: d.description ?? payload[idx]?.description ?? null,
    is_active: d.is_active ?? payload[idx]?.is_active ?? true,
    sort_order: d.sort_order ?? 100,
  }));

  return {
    count: createdItems.length,
    created: createdItems,
  };
}
