'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canAccess, canEditMasters } from '@/lib/tour/access';
import { invalidateTourMastersCache } from '@/lib/tour/data';
import { revalidatePath } from 'next/cache';

export type BulkDistanceInput = {
  from_location_id: number | string;
  to_location_id: number | string;
  distance_km: number | string;
  duration_text?: string | null;
  notes?: string | null;
};

export type CreatedDistanceItem = {
  id: number | string;
  from_location_id: number;
  to_location_id: number;
  distance_km: number;
  duration_text: string | null;
  notes: string | null;
};

export type BulkCreateDistancesResult = {
  error?: string;
  count?: number;
  created?: CreatedDistanceItem[];
};

export async function bulkCreateDistances(
  items: BulkDistanceInput[]
): Promise<BulkCreateDistancesResult> {
  const profile = await requireProfile();
  if (!canEditMasters(profile)) {
    return { error: 'Only administrators have permission to edit distances.' };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Please provide at least one distance route to save.' };
  }

  // Filter items that have both from and to locations, and a valid distance
  const validItems: Array<{
    from_location_id: number;
    to_location_id: number;
    distance_km: number;
    duration_text: string | null;
    notes: string | null;
  }> = [];

  for (const item of items) {
    if (!item) continue;
    const a = Number(item.from_location_id);
    const b = Number(item.to_location_id);
    const dist = Number(item.distance_km);

    if (isNaN(a) || a <= 0 || isNaN(b) || b <= 0) continue;
    if (a === b) continue; // cannot be between same location
    if (isNaN(dist) || dist < 0) continue;

    const fromLoc = Math.min(a, b);
    const toLoc = Math.max(a, b);

    validItems.push({
      from_location_id: fromLoc,
      to_location_id: toLoc,
      distance_km: dist,
      duration_text: item.duration_text?.trim() || null,
      notes: item.notes?.trim() || null,
    });
  }

  if (validItems.length === 0) {
    return {
      error:
        'Please enter two different locations and a valid distance (km) for at least one card.',
    };
  }

  // Deduplicate within the incoming batch: keep the last entered entry for each route pair
  const routeMap = new Map<string, typeof validItems[0]>();
  for (const item of validItems) {
    const key = `${item.from_location_id}:::${item.to_location_id}`;
    routeMap.set(key, item);
  }
  const uniqueItems = Array.from(routeMap.values());

  const supabase = await createClient();

  // Fetch existing distance entries to update rather than duplicate
  const { data: existingRecords } = await supabase
    .from('location_distances')
    .select('id, from_location_id, to_location_id');

  const existingMap = new Map<string, number>();
  (existingRecords || []).forEach((r: any) => {
    const key = `${Math.min(r.from_location_id, r.to_location_id)}:::${Math.max(
      r.from_location_id,
      r.to_location_id
    )}`;
    existingMap.set(key, Number(r.id));
  });

  const createdItems: CreatedDistanceItem[] = [];

  for (const row of uniqueItems) {
    const key = `${row.from_location_id}:::${row.to_location_id}`;
    const existingId = existingMap.get(key);

    if (existingId) {
      // Update existing record
      const { data, error } = await supabase
        .from('location_distances')
        .update({
          distance_km: row.distance_km,
          duration_text: row.duration_text,
          notes: row.notes,
          is_deleted: false,
        })
        .eq('id', existingId)
        .select('id, from_location_id, to_location_id, distance_km, duration_text, notes')
        .single();

      if (!error && data) {
        createdItems.push({
          id: data.id,
          from_location_id: data.from_location_id,
          to_location_id: data.to_location_id,
          distance_km: Number(data.distance_km),
          duration_text: data.duration_text,
          notes: data.notes,
        });
      }
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('location_distances')
        .insert({
          from_location_id: row.from_location_id,
          to_location_id: row.to_location_id,
          distance_km: row.distance_km,
          duration_text: row.duration_text,
          notes: row.notes,
          is_deleted: false,
        })
        .select('id, from_location_id, to_location_id, distance_km, duration_text, notes')
        .single();

      if (!error && data) {
        createdItems.push({
          id: data.id,
          from_location_id: data.from_location_id,
          to_location_id: data.to_location_id,
          distance_km: Number(data.distance_km),
          duration_text: data.duration_text,
          notes: data.notes,
        });
      }
    }
  }

  try {
    invalidateTourMastersCache();
  } catch (err) {
    console.warn('Could not invalidate tour masters cache:', err);
  }

  [
    '/travinco_dashboard/locations/distances',
    '/travinco_dashboard/quotations',
  ].forEach((p) => {
    try {
      revalidatePath(p);
    } catch {}
  });

  return {
    count: createdItems.length,
    created: createdItems,
  };
}

export interface DistanceTableItem {
  id: number;
  from_location_id: number;
  to_location_id: number;
  from_name: string;
  to_name: string;
  route: string;
  distance_km: number;
  distance_label: string;
  duration_text: string | null;
  notes?: string | null;
}

export interface DistancesTableQueryResult {
  distances: DistanceTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  locations: Array<{ id: number; name: string; display_name?: string | null }>;
}

export interface FullDistance {
  id: number;
  from_location_id: number;
  to_location_id: number;
  distance_km: number;
  duration_text: string | null;
  notes: string | null;
}

/**
 * Fast, lean query fetching strictly the table columns for distances:
 * Route (from_location_id, to_location_id), Distance, Drive time (duration_text).
 * Excludes heavy notes from initial table load.
 */
export async function getDistancesTableList({
  page = 1,
  pageSize = 20,
  q = '',
  locationId = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  locationId?: string;
} = {}): Promise<DistancesTableQueryResult> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return {
      distances: [],
      totalCount: 0,
      totalPages: 1,
      page: 1,
      pageSize,
      locations: [],
    };
  }

  const supabase = await createClient();
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('location_distances')
    .select('id, from_location_id, to_location_id, distance_km, duration_text, notes, is_deleted', { count: 'exact' });

  if (locationId) {
    const locNum = Number(locationId);
    query = query.or(`from_location_id.eq.${locNum},to_location_id.eq.${locNum}`);
  }

  const [{ data: rows, count, error }, { data: locsData }, { data: deletedSettingsData }] = await Promise.all([
    query.range(from, to),
    supabase.from('locations').select('id, name, display_name, is_deleted').order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('website_settings').select('key').like('key', 'deleted_distance_%'),
  ]);

  if (error) {
    console.error('getDistancesTableList error:', error.message);
  }

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_distance_', ''))
  );

  const locLookup = Object.fromEntries(
    (locsData ?? []).map((l: any) => [String(l.id), l.display_name || l.name])
  );

  const activeLocs = (locsData ?? []).filter(
    (l: any) => l && l.is_deleted !== true && l.is_deleted !== 'true' && l.is_deleted !== 1
  ).map((l: any) => ({
    id: l.id,
    name: l.name,
    display_name: l.display_name ?? null,
  }));

  const activeRows = (rows ?? []).filter(
    (d: any) => d && d.is_deleted !== true && d.is_deleted !== 'true' && d.is_deleted !== 1 && !deletedKeys.has(String(d.id))
  );

  const term = q.trim().toLowerCase();

  const items: DistanceTableItem[] = activeRows.map((d: any) => {
    const fromName = locLookup[String(d.from_location_id)] || `#${d.from_location_id}`;
    const toName = locLookup[String(d.to_location_id)] || `#${d.to_location_id}`;
    const dist = Number(d.distance_km) || 0;
    return {
      id: d.id,
      from_location_id: d.from_location_id,
      to_location_id: d.to_location_id,
      from_name: fromName,
      to_name: toName,
      route: `${fromName} ↔ ${toName}`,
      distance_km: dist,
      distance_label: `${dist} km`,
      duration_text: d.duration_text || null,
      notes: d.notes || null,
    };
  }).filter((item) => {
    if (!term) return true;
    return item.route.toLowerCase().includes(term) || (item.duration_text && item.duration_text.toLowerCase().includes(term));
  });

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    distances: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
    locations: activeLocs,
  };
}

/**
 * On-demand single fetch when clicking 'Edit': retrieves the full distance entry including notes.
 */
export async function getDistanceById(id: number): Promise<{ distance?: FullDistance; error?: string }> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return { error: 'You do not have permission to view this distance entry.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('location_distances')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return { error: error?.message || 'Distance entry not found.' };
  }

  return {
    distance: {
      id: data.id,
      from_location_id: Number(data.from_location_id),
      to_location_id: Number(data.to_location_id),
      distance_km: Number(data.distance_km) || 0,
      duration_text: data.duration_text ?? null,
      notes: data.notes ?? null,
    },
  };
}

