'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canAccess } from '@/lib/tour/access';
import type { TransportVehicle } from '@/lib/tour/types';

export interface TransportVehicleTableItem {
  id: number;
  vehicle_type: string;
  company_name: string;
  contact_person: string | null;
  contact_number: string;
  alt_contact_number: string | null;
  seats: number | null;
  is_ac: boolean;
  rate_basis: 'per_day' | 'per_trip';
  amount: number;
  free_km: number;
  extra_per_km: number;
  driver_bata_per_day: number;
  is_active: boolean;
  rate_label: string;
  free_label: string;
  seats_label: string;
}

export interface TransportVehiclesTableQueryResult {
  vehicles: TransportVehicleTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  carTypes: string[];
}

/**
 * Fast, lean query fetching strictly the 8 display columns for the transport vehicles table:
 * Car type (vehicle_type, seats, is_ac), Company (company_name, contact_person),
 * Contact (contact_number, alt_contact_number), Amount (amount, rate_basis),
 * Free km (free_km, rate_basis), Extra / km (extra_per_km), Bata / day (driver_bata_per_day), Active (is_active).
 * Excludes heavy 'notes', timestamps, and internal metadata.
 */
export async function getTransportVehiclesTableList({
  page = 1,
  pageSize = 20,
  q = '',
  vehicleType = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  vehicleType?: string;
} = {}): Promise<TransportVehiclesTableQueryResult> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return { vehicles: [], totalCount: 0, totalPages: 1, page: 1, pageSize, carTypes: [] };
  }

  const supabase = await createClient();
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('transport_vehicles')
    .select(
      'id, vehicle_type, company_name, contact_person, contact_number, alt_contact_number, seats, is_ac, rate_basis, amount, free_km, extra_per_km, driver_bata_per_day, is_active, is_deleted',
      { count: 'exact' }
    )
    .order('vehicle_type')
    .order('company_name');

  const term = q.replace(/[,()%*]/g, ' ').trim();
  if (term) {
    query = query.or(
      `vehicle_type.ilike.%${term}%,company_name.ilike.%${term}%,contact_person.ilike.%${term}%,contact_number.ilike.%${term}%`
    );
  }
  if (vehicleType) {
    query = query.eq('vehicle_type', vehicleType);
  }

  const [{ data: rows, count, error }, { data: deletedSettingsData }, { data: allTypesData }] = await Promise.all([
    query.range(from, to),
    supabase.from('website_settings').select('key').like('key', 'deleted_transport_vehicle_%'),
    supabase.from('transport_vehicles').select('vehicle_type').order('vehicle_type'),
  ]);

  if (error) {
    console.error('getTransportVehiclesTableList error:', error.message);
  }

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) =>
      s.key.replace('deleted_transport_vehicle_', '')
    )
  );

  const activeRows = (rows ?? []).filter(
    (v: any) =>
      v &&
      v.is_deleted !== true &&
      v.is_deleted !== 'true' &&
      v.is_deleted !== 1 &&
      !deletedKeys.has(String(v.id))
  );

  const items: TransportVehicleTableItem[] = activeRows.map((v: any) => {
    const rateBasis = v.rate_basis === 'per_day' ? '/ day' : '/ trip';
    return {
      id: v.id,
      vehicle_type: v.vehicle_type,
      company_name: v.company_name,
      contact_person: v.contact_person || null,
      contact_number: v.contact_number,
      alt_contact_number: v.alt_contact_number || null,
      seats: v.seats != null ? Number(v.seats) : null,
      is_ac: Boolean(v.is_ac),
      rate_basis: v.rate_basis === 'per_trip' ? 'per_trip' : 'per_day',
      amount: Number(v.amount) || 0,
      free_km: Number(v.free_km) || 0,
      extra_per_km: Number(v.extra_per_km) || 0,
      driver_bata_per_day: Number(v.driver_bata_per_day) || 0,
      is_active: Boolean(v.is_active),
      rate_label: `₹${Math.round(Number(v.amount) || 0).toLocaleString('en-IN')} ${rateBasis}`,
      free_label: `${v.free_km || 0} km ${rateBasis}`,
      seats_label: [v.seats ? `${v.seats} seats` : null, v.is_ac ? 'A/C' : 'Non A/C'].filter(Boolean).join(' · '),
    };
  });

  const carTypes = Array.from(
    new Set((allTypesData ?? []).map((t: any) => (t.vehicle_type as string)?.trim()).filter(Boolean))
  ).sort();

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    vehicles: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
    carTypes,
  };
}

/**
 * On-demand single fetch when clicking 'Edit': retrieves the full vehicle details including notes.
 */
export async function getTransportVehicleById(id: number): Promise<{ vehicle?: TransportVehicle; error?: string }> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'masters')) {
    return { error: 'You do not have permission to view this vehicle.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transport_vehicles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return { error: error?.message || 'Vehicle not found.' };
  }

  return {
    vehicle: {
      id: data.id,
      vehicle_type: data.vehicle_type,
      company_name: data.company_name,
      contact_person: data.contact_person ?? null,
      contact_number: data.contact_number,
      alt_contact_number: data.alt_contact_number ?? null,
      seats: data.seats != null ? Number(data.seats) : null,
      is_ac: Boolean(data.is_ac),
      rate_basis: data.rate_basis === 'per_trip' ? 'per_trip' : 'per_day',
      amount: Number(data.amount) || 0,
      free_km: Number(data.free_km) || 0,
      extra_per_km: Number(data.extra_per_km) || 0,
      driver_bata_per_day: Number(data.driver_bata_per_day) || 0,
      notes: data.notes ?? null,
      is_active: Boolean(data.is_active),
    },
  };
}
