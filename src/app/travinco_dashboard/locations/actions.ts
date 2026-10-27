'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canAccess, canEditMasters } from '@/lib/tour/access';
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

export interface LocationTableItem {
  id: number;
  name: string;
  display_name: string | null;
  state: string;
  parent_id: number | null;
  parent_name: string | null;
  type: string; // 'Houseboat' | 'Town'
  is_houseboat: boolean;
  hotels_count: number;
  activities_count: number;
  is_active: boolean;
}

export interface ParentLocationOption {
  id: number;
  name: string;
  display_name: string | null;
}

export interface LocationsTableQueryResult {
  locations: LocationTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  states: string[];
  parentLocations: ParentLocationOption[];
}

export interface FullLocation {
  id: number;
  name: string;
  display_name: string | null;
  state: string;
  parent_id: number | null;
  description: string | null;
  sort_order: number;
  is_houseboat: boolean;
  is_active: boolean;
}

/**
 * Fast, lean query fetching strictly the table columns for locations:
 * Location (name, display_name), State, Part of (parent_id resolved), Type (is_houseboat),
 * Hotels (count), Activities (count), Active (is_active).
 * Excludes heavy 'description' and timestamps.
 * Counts hotels and activities specifically for the 20 locations on the current page.
 */
export async function getLocationsTableList({
  page = 1,
  pageSize = 20,
  q = '',
  state = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  state?: string;
} = {}): Promise<LocationsTableQueryResult> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return { locations: [], totalCount: 0, totalPages: 1, page: 1, pageSize, states: [], parentLocations: [] };
  }

  const supabase = await createClient();
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('locations')
    .select('id, name, display_name, state, parent_id, is_houseboat, is_active, is_deleted', { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const term = q.replace(/[,()%*]/g, ' ').trim();
  if (term) {
    query = query.or(`name.ilike.%${term}%,display_name.ilike.%${term}%,state.ilike.%${term}%`);
  }
  if (state) {
    query = query.eq('state', state);
  }

  const [{ data: rows, count, error }, { data: allLocsData }, { data: deletedSettingsData }] = await Promise.all([
    query.range(from, to),
    supabase.from('locations').select('id, name, display_name, state, is_deleted').order('name', { ascending: true }),
    supabase.from('website_settings').select('key').like('key', 'deleted_location_%'),
  ]);

  if (error) {
    console.error('getLocationsTableList error:', error.message);
  }

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_location_', ''))
  );

  const activeAllLocs = (allLocsData ?? []).filter(
    (l: any) => l && l.is_deleted !== true && l.is_deleted !== 'true' && l.is_deleted !== 1 && !deletedKeys.has(String(l.id))
  );

  const locLookup = Object.fromEntries(
    activeAllLocs.map((l: any) => [String(l.id), l.display_name || l.name])
  );

  const states = Array.from(
    new Set(activeAllLocs.map((l: any) => (typeof l.state === 'string' ? l.state.trim() : '')).filter(Boolean))
  ).sort();

  const parentLocations: ParentLocationOption[] = activeAllLocs.map((l: any) => ({
    id: l.id,
    name: l.name,
    display_name: l.display_name ?? null,
  }));

  const activeRows = (rows ?? []).filter(
    (l: any) => l && l.is_deleted !== true && l.is_deleted !== 'true' && l.is_deleted !== 1 && !deletedKeys.has(String(l.id))
  );

  const pageIds = activeRows.map((r: any) => r.id);

  // Fast counts specifically for the 20 locations on the current page
  const [{ data: pageHotels }, { data: pageActivities }] = await Promise.all([
    pageIds.length > 0
      ? supabase.from('hotels').select('location_id').in('location_id', pageIds)
      : Promise.resolve({ data: [] }),
    pageIds.length > 0
      ? supabase.from('location_activities').select('location_id').in('location_id', pageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const hotelCountMap: Record<number, number> = {};
  (pageHotels ?? []).forEach((h: any) => {
    if (h.location_id) {
      hotelCountMap[h.location_id] = (hotelCountMap[h.location_id] || 0) + 1;
    }
  });

  const activityCountMap: Record<number, number> = {};
  (pageActivities ?? []).forEach((a: any) => {
    if (a.location_id) {
      activityCountMap[a.location_id] = (activityCountMap[a.location_id] || 0) + 1;
    }
  });

  const items: LocationTableItem[] = activeRows.map((l: any) => ({
    id: l.id,
    name: l.name,
    display_name: l.display_name || null,
    state: l.state || 'Kerala',
    parent_id: l.parent_id != null ? Number(l.parent_id) : null,
    parent_name: l.parent_id ? locLookup[String(l.parent_id)] || null : null,
    type: l.is_houseboat ? 'Houseboat' : 'Town',
    is_houseboat: Boolean(l.is_houseboat),
    hotels_count: hotelCountMap[l.id] || 0,
    activities_count: activityCountMap[l.id] || 0,
    is_active: Boolean(l.is_active),
  }));

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    locations: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
    states,
    parentLocations,
  };
}

/**
 * On-demand single fetch when clicking 'Edit': retrieves the full location details including description.
 */
export async function getLocationById(id: number): Promise<{ location?: FullLocation; error?: string }> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return { error: 'You do not have permission to view this location.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return { error: error?.message || 'Location not found.' };
  }

  return {
    location: {
      id: data.id,
      name: data.name,
      display_name: data.display_name ?? null,
      state: data.state ?? 'Kerala',
      parent_id: data.parent_id != null ? Number(data.parent_id) : null,
      description: data.description ?? null,
      sort_order: Number(data.sort_order) || 100,
      is_houseboat: Boolean(data.is_houseboat),
      is_active: Boolean(data.is_active),
    },
  };
}

