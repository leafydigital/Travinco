'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canAccess, canEditMasters } from '@/lib/tour/access';
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

  // Cards with nothing filled in are ignored; a card with details but no name or
  // location is an error (never silently dropped).
  const candidates = items.filter(
    (a) => a && (Number(a.location_id) > 0 || [a.name, a.description].some((v) => String(v ?? '').trim()))
  );

  if (candidates.length === 0) {
    return { error: 'Please provide a valid location and activity name for at least one card.' };
  }
  for (const [i, a] of candidates.entries()) {
    if (!String(a.name ?? '').trim()) return { error: `Activity card ${i + 1}: activity name is required.` };
    if (!(Number(a.location_id) > 0)) return { error: `Activity card ${i + 1} ("${a.name.trim()}"): choose a location.` };
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

export interface ActivityTableItem {
  id: number;
  location_id: number;
  location_name: string;
  name: string;
  category: string;
  preferred_types: string;
  is_active: boolean;
}

export interface ActivitiesTableQueryResult {
  activities: ActivityTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  locations: Array<{ id: number; name: string; display_name?: string | null }>;
  categories: string[];
  preferredTypesList: string[];
}

export interface FullActivity {
  id: number;
  location_id: number;
  name: string;
  category: string;
  preferred_types: string;
  description: string | null;
  duration: string | null;
  timings: string | null;
  closed_on: string | null;
  entry_fee_adult: number | null;
  entry_fee_child: number | null;
  approx_cost_text: string | null;
  sort_order: number;
  is_optional_paid: boolean;
  is_active: boolean;
}

/**
 * Fast, lean query fetching strictly the table columns for activities:
 * Location (location_name), Place Activities (name), Categories (category), Preferred Types (preferred_types), Active (is_active).
 * Excludes heavy 'description', 'notes', and timings.
 */
export async function getActivitiesTableList({
  page = 1,
  pageSize = 20,
  q = '',
  locationId = '',
  category = '',
  preferredTypes = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  locationId?: string;
  category?: string;
  preferredTypes?: string;
} = {}): Promise<ActivitiesTableQueryResult> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return {
      activities: [],
      totalCount: 0,
      totalPages: 1,
      page: 1,
      pageSize,
      locations: [],
      categories: [],
      preferredTypesList: [],
    };
  }

  const supabase = await createClient();
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('location_activities')
    .select(
      'id, location_id, name, category, kind, preferred_types, is_active, is_deleted',
      { count: 'exact' }
    )
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const term = q.replace(/[,()%*]/g, ' ').trim();
  if (term) {
    query = query.or(`name.ilike.%${term}%,category.ilike.%${term}%,preferred_types.ilike.%${term}%`);
  }
  if (locationId) {
    query = query.eq('location_id', Number(locationId));
  }
  if (category) {
    query = query.ilike('category', `%${category}%`);
  }
  if (preferredTypes) {
    query = query.ilike('preferred_types', `%${preferredTypes}%`);
  }

  const [{ data: rows, count, error }, { data: locsData }, { data: deletedSettingsData }, { data: allActsMeta }] = await Promise.all([
    query.range(from, to),
    supabase.from('locations').select('id, name, display_name, is_deleted').order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('website_settings').select('key').like('key', 'deleted_activity_%'),
    supabase.from('location_activities').select('category, preferred_types'),
  ]);

  if (error) {
    console.error('getActivitiesTableList error:', error.message);
  }

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_activity_', ''))
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
    (a: any) => a && a.is_deleted !== true && a.is_deleted !== 'true' && a.is_deleted !== 1 && !deletedKeys.has(String(a.id))
  );

  const items: ActivityTableItem[] = activeRows.map((a: any) => ({
    id: a.id,
    location_id: a.location_id,
    location_name: locLookup[String(a.location_id)] || 'General',
    name: a.name,
    category: a.category || a.kind || 'Sightseeing',
    preferred_types: a.preferred_types || 'All',
    is_active: a.is_active !== false,
  }));

  const categories = Array.from(
    new Set((allActsMeta ?? []).map((a: any) => (a.category as string)?.trim()).filter(Boolean))
  ).sort();

  const preferredTypesList = Array.from(
    new Set((allActsMeta ?? []).map((a: any) => (a.preferred_types as string)?.trim()).filter(Boolean))
  ).sort();

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    activities: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
    locations: activeLocs,
    categories,
    preferredTypesList,
  };
}

/**
 * On-demand single fetch when clicking 'Edit': retrieves the full activity details.
 */
export async function getActivityById(id: number | string): Promise<{ activity?: FullActivity; error?: string }> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return { error: 'You do not have permission to view this activity.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('location_activities')
    .select('*')
    .eq('id', Number(id))
    .maybeSingle();

  if (error || !data) {
    return { error: error?.message || 'Activity not found.' };
  }

  return {
    activity: {
      id: data.id,
      location_id: Number(data.location_id),
      name: data.name,
      category: data.category || data.kind || 'Sightseeing',
      preferred_types: data.preferred_types || 'All',
      description: data.description ?? null,
      duration: data.duration ?? null,
      timings: data.timings ?? null,
      closed_on: data.closed_on ?? null,
      entry_fee_adult: data.entry_fee_adult != null ? Number(data.entry_fee_adult) : null,
      entry_fee_child: data.entry_fee_child != null ? Number(data.entry_fee_child) : null,
      approx_cost_text: data.approx_cost_text ?? null,
      sort_order: Number(data.sort_order) || 100,
      is_optional_paid: Boolean(data.is_optional_paid),
      is_active: data.is_active !== false,
    },
  };
}

