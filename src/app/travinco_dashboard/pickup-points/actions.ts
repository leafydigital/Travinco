'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canAccess } from '@/lib/tour/access';

export interface PickupPointTableItem {
  id: number;
  name: string;
  code: string | null;
  point_type: string;
  type_label: string;
  location_id: number | null;
  town_label: string;
  km_from_location: number;
  km_label: string;
  address: string | null;
  use_for_pickup: boolean;
  use_for_drop: boolean;
  used_for: string;
  is_active: boolean;
}

export interface LocationOption {
  id: number;
  name: string;
}

export interface PickupPointsTableQueryResult {
  points: PickupPointTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  locations: LocationOption[];
}

export interface FullPickupPoint {
  id: number;
  name: string;
  code: string | null;
  point_type: string;
  location_id: number | null;
  km_from_location: number;
  address: string | null;
  google_maps_url: string | null;
  contact_phone: string | null;
  use_for_pickup: boolean;
  use_for_drop: boolean;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
}

const POINT_TYPES: Record<string, string> = {
  airport: 'Airport',
  railway: 'Railway station',
  bus: 'Bus stand',
  hotel: 'Hotel / residence',
  port: 'Port / jetty',
  other: 'Other',
};

/**
 * Fast, lean query fetching strictly the 7 table columns for pickup & drop points:
 * Point (name, address), Code (code), Type (point_type), Town (location_id resolved),
 * To town (km_from_location), Used for (use_for_pickup, use_for_drop), Active (is_active).
 * Excludes heavy 'notes', 'google_maps_url', 'contact_phone', timestamps, etc.
 */
export async function getPickupPointsTableList({
  page = 1,
  pageSize = 20,
  q = '',
  pointType = '',
  locationId = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  pointType?: string;
  locationId?: string;
} = {}): Promise<PickupPointsTableQueryResult> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return { points: [], totalCount: 0, totalPages: 1, page: 1, pageSize, locations: [] };
  }

  const supabase = await createClient();
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('pickup_drop_points')
    .select(
      'id, name, code, point_type, location_id, km_from_location, address, use_for_pickup, use_for_drop, is_active, is_deleted',
      { count: 'exact' }
    )
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const term = q.replace(/[,()%*]/g, ' ').trim();
  if (term) {
    query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%,address.ilike.%${term}%`);
  }
  if (pointType) {
    query = query.eq('point_type', pointType);
  }
  if (locationId) {
    query = query.eq('location_id', Number(locationId));
  }

  const [{ data: rows, count, error }, { data: locsData }, { data: deletedSettingsData }] = await Promise.all([
    query.range(from, to),
    supabase.from('locations').select('id, name, display_name').order('sort_order').order('name'),
    supabase.from('website_settings').select('key').like('key', 'deleted_pickup_point_%'),
  ]);

  if (error) {
    console.error('getPickupPointsTableList error:', error.message);
  }

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) =>
      s.key.replace('deleted_pickup_point_', '')
    )
  );

  const locLookup = Object.fromEntries(
    (locsData ?? []).map((l: any) => [String(l.id), l.display_name || l.name])
  );

  const locationOptions: LocationOption[] = (locsData ?? []).map((l: any) => ({
    id: l.id,
    name: l.display_name || l.name,
  }));

  const activeRows = (rows ?? []).filter(
    (p: any) =>
      p &&
      p.is_deleted !== true &&
      p.is_deleted !== 'true' &&
      p.is_deleted !== 1 &&
      !deletedKeys.has(String(p.id))
  );

  const items: PickupPointTableItem[] = activeRows.map((p: any) => {
    const km = Number(p.km_from_location) || 0;
    const usedFor = [p.use_for_pickup && 'Pickup', p.use_for_drop && 'Drop'].filter(Boolean).join(' & ') || '—';
    return {
      id: p.id,
      name: p.name,
      code: p.code ? String(p.code).toUpperCase() : null,
      point_type: p.point_type,
      type_label: POINT_TYPES[p.point_type] || p.point_type || 'Other',
      location_id: p.location_id != null ? Number(p.location_id) : null,
      town_label: p.location_id ? locLookup[String(p.location_id)] || '—' : '—',
      km_from_location: km,
      km_label: km > 0 ? `${km} km` : '0 km',
      address: p.address || null,
      use_for_pickup: Boolean(p.use_for_pickup),
      use_for_drop: Boolean(p.use_for_drop),
      used_for: usedFor,
      is_active: Boolean(p.is_active),
    };
  });

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    points: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
    locations: locationOptions,
  };
}

/**
 * On-demand single fetch when clicking 'Edit': retrieves the full pickup/drop point details including notes.
 */
export async function getPickupPointById(id: number): Promise<{ point?: FullPickupPoint; error?: string }> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return { error: 'You do not have permission to view this pickup point.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pickup_drop_points')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return { error: error?.message || 'Pickup point not found.' };
  }

  return {
    point: {
      id: data.id,
      name: data.name,
      code: data.code ?? null,
      point_type: data.point_type,
      location_id: data.location_id != null ? Number(data.location_id) : null,
      km_from_location: Number(data.km_from_location) || 0,
      address: data.address ?? null,
      google_maps_url: data.google_maps_url ?? null,
      contact_phone: data.contact_phone ?? null,
      use_for_pickup: Boolean(data.use_for_pickup),
      use_for_drop: Boolean(data.use_for_drop),
      notes: data.notes ?? null,
      sort_order: Number(data.sort_order) || 100,
      is_active: Boolean(data.is_active),
    },
  };
}
