'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
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
