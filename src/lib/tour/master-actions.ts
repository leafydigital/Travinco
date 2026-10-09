'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from './access';
import type { PlanItem } from './types';

import { invalidateTourMastersCache } from './data';

type Result = { error?: string; id?: number | string };

// ---------- helpers -----------------------------------------------------

const str = (max: number) =>
  z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string().max(max));
const optStr = (max: number) =>
  z.preprocess((v) => (v == null || String(v).trim() === '' ? null : String(v).trim()), z.string().max(max).nullable());
const optNum = z.preprocess(
  (v) => (v == null || String(v).trim() === '' ? null : Number(String(v).replace(/[^\d.\-]/g, ''))),
  z.number().finite().min(0).nullable()
);
const reqNum = z.preprocess((v) => Number(String(v ?? '').replace(/[^\d.\-]/g, '') || 0), z.number().finite().min(0));
const optId = z.preprocess((v) => (v == null || String(v).trim() === '' ? null : Number(v)), z.number().int().positive().nullable());
const reqId = z.preprocess((v) => Number(v), z.number().int().positive());
const bool = z.preprocess((v) => v === true || v === 'true' || v === 'on', z.boolean());

async function adminClient() {
  const profile = await requireProfile();
  if (!canEditMasters(profile)) return { error: 'Only admins can change master data.' as const };
  return { supabase: await createClient(), profile };
}

function firstIssue(e: z.ZodError) {
  const i = e.issues[0];
  return i ? `${i.path.join('.') || 'Form'}: ${i.message}` : 'Please check the form.';
}

function dbError(error: { code?: string; message: string }, what: string) {
  if (error.code === '23505') return `A ${what} with the same name already exists.`;
  if (error.code === '23503') return `This ${what} is still used elsewhere, so it cannot be removed. Mark it inactive instead.`;
  console.error(`[tour] ${what}:`, error.message);
  return `Could not save the ${what}.`;
}

async function save(table: string, what: string, id: number | string | null, row: Record<string, unknown>, paths: string[]): Promise<Result> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };
  const q = id == null ? c.supabase.from(table).insert(row).select('id').single() : c.supabase.from(table).update(row).eq('id', id).select('id').single();
  const { data, error } = await q;
  if (error) return { error: dbError(error, what) };
  invalidateTourMastersCache();
  paths.forEach((p) => revalidatePath(p));
  return { id: data?.id };
}

async function remove(table: string, what: string, id: number | string, paths: string[]): Promise<Result> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };
  const { error } = await c.supabase.from(table).delete().eq('id', id);
  if (error) return { error: dbError(error, what) };
  invalidateTourMastersCache();
  paths.forEach((p) => revalidatePath(p));
  return {};
}

// ---------- Transportation ----------------------------------------------

const vehicleSchema = z.object({
  vehicle_type: str(80).pipe(z.string().min(1, 'Car type is required')),
  company_name: str(150).pipe(z.string().min(1, 'Company name is required')),
  contact_person: optStr(120),
  contact_number: str(30).pipe(z.string().min(5, 'Contact number is required')),
  alt_contact_number: optStr(30),
  seats: optNum,
  is_ac: bool,
  rate_basis: z.enum(['per_day', 'per_trip']),
  amount: reqNum,
  free_km: reqNum,
  extra_per_km: reqNum,
  driver_bata_per_day: reqNum,
  notes: optStr(2000),
  is_active: bool,
});

export async function saveTransportVehicle(id: number | string | null, raw: Record<string, unknown>) {
  const p = vehicleSchema.safeParse(raw);
  if (!p.success) return { error: firstIssue(p.error) };
  return save('transport_vehicles', 'vehicle', id, { ...p.data, free_km: Math.round(p.data.free_km) }, ['/admin/transport']);
}
export async function deleteTransportVehicle(id: number | string) {
  return remove('transport_vehicles', 'vehicle', id, ['/admin/transport']);
}

// ---------- Pickup & drop points ------------------------------------------

const pointSchema = z.object({
  code: optStr(20).transform((v) => (v ? v.toUpperCase() : v)),
  name: str(150).pipe(z.string().min(1, 'Name is required')),
  point_type: z.enum(['airport', 'railway', 'bus', 'hotel', 'port', 'other']),
  location_id: optId,
  km_from_location: reqNum,
  address: optStr(1000),
  google_maps_url: optStr(1000),
  contact_phone: optStr(30),
  use_for_pickup: bool,
  use_for_drop: bool,
  notes: optStr(2000),
  sort_order: reqNum,
  is_active: bool,
});

export async function savePickupPoint(id: number | string | null, raw: Record<string, unknown>) {
  const p = pointSchema.safeParse(raw);
  if (!p.success) return { error: firstIssue(p.error) };
  return save('pickup_drop_points', 'pickup / drop point', id, p.data, ['/admin/pickup-points']);
}
export async function deletePickupPoint(id: number | string) {
  return remove('pickup_drop_points', 'pickup / drop point', id, ['/admin/pickup-points']);
}

// ---------- Locations -------------------------------------------------------

const locationSchema = z.object({
  name: str(80).pipe(z.string().min(1, 'Name is required')),
  display_name: optStr(80),
  state: optStr(60),
  description: optStr(4000),
  parent_id: optId,
  is_houseboat: bool,
  is_active: bool,
  sort_order: reqNum,
});

export async function saveLocation(id: number | string | null, raw: Record<string, unknown>) {
  const p = locationSchema.safeParse(raw);
  if (!p.success) return { error: firstIssue(p.error) };
  if (id != null && p.data.parent_id === Number(id)) return { error: 'A location cannot be its own parent.' };
  return save('locations', 'location', id, p.data, ['/admin/locations']);
}
export async function deleteLocation(id: number | string) {
  return remove('locations', 'location', id, ['/admin/locations']);
}

// ---------- Activities ------------------------------------------------------

const activitySchema = z.object({
  location_id: reqId,
  name: str(150).pipe(z.string().min(1, 'Name is required')),
  kind: z.enum(['sightseeing', 'activity', 'experience', 'temple', 'shopping']),
  description: optStr(4000),
  duration: optStr(60),
  timings: optStr(120),
  closed_on: optStr(120),
  entry_fee_adult: optNum,
  entry_fee_child: optNum,
  is_optional_paid: bool,
  approx_cost_text: optStr(120),
  sort_order: reqNum,
  is_active: bool,
});

export async function saveActivity(id: number | string | null, raw: Record<string, unknown>) {
  const p = activitySchema.safeParse(raw);
  if (!p.success) return { error: firstIssue(p.error) };
  return save('location_activities', 'activity', id, p.data, ['/admin/locations', '/admin/locations/activities']);
}
export async function deleteActivity(id: number | string) {
  return remove('location_activities', 'activity', id, ['/admin/locations/activities']);
}

// ---------- Distances --------------------------------------------------------

const distanceSchema = z.object({
  from_location_id: reqId,
  to_location_id: reqId,
  distance_km: reqNum,
  duration_text: optStr(40),
  notes: optStr(1000),
});

export async function saveDistance(id: number | string | null, raw: Record<string, unknown>) {
  const p = distanceSchema.safeParse(raw);
  if (!p.success) return { error: firstIssue(p.error) };
  const { from_location_id: a, to_location_id: b } = p.data;
  if (a === b) return { error: 'Pick two different locations.' };
  return save('location_distances', 'distance', id, { ...p.data, from_location_id: Math.min(a, b), to_location_id: Math.max(a, b) }, ['/admin/locations/distances']);
}
export async function deleteDistance(id: number | string) {
  return remove('location_distances', 'distance', id, ['/admin/locations/distances']);
}

// ---------- Day plans ---------------------------------------------------------

/** Lines starting with "*" are sightseeing stops ("* Name" or "* Name | description"). */
function textToItems(t: string): PlanItem[] {
  return t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      if (l.startsWith('*')) {
        const [name = '', ...rest] = l.slice(1).split('|');
        const desc = rest.join('|').trim();
        return desc ? { kind: 'sight', name: name.trim(), desc } : { kind: 'sight', name: name.trim() };
      }
      return { kind: 'text', text: l };
    });
}

const planSchema = z.object({
  plan_type: z.enum(['arrival', 'transfer', 'stay', 'departure']),
  from_location_id: optId,
  to_location_id: reqId,
  label: str(120).pipe(z.string().min(1, 'Variant name is required')),
  title: str(200).pipe(z.string().min(1, 'Day title is required')),
  first_day_title: optStr(200),
  items_text: str(8000),
  tip: optStr(2000),
  no_opener: bool,
  source: optStr(200),
  sort_order: reqNum,
  is_active: bool,
});

export async function saveDayPlan(id: number | string | null, raw: Record<string, unknown>) {
  const p = planSchema.safeParse(raw);
  if (!p.success) return { error: firstIssue(p.error) };
  const { items_text, ...rest } = p.data;
  const needsFrom = rest.plan_type === 'transfer' || rest.plan_type === 'departure';
  if (needsFrom && !rest.from_location_id) return { error: 'Travel and departure days need a "from" location.' };
  return save(
    'day_plans',
    'day plan',
    id,
    { ...rest, from_location_id: needsFrom ? rest.from_location_id : null, items: textToItems(items_text) },
    ['/admin/locations/day-plans']
  );
}
export async function deleteDayPlan(id: number | string) {
  return remove('day_plans', 'day plan', id, ['/admin/locations/day-plans']);
}

// ---------- Quotation templates ----------------------------------------------

export async function deleteQuotationTemplate(id: number | string) {
  return remove('quotation_templates', 'template', id, ['/admin/quotations/settings']);
}

export async function toggleQuotationTemplate(id: number, is_active: boolean) {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };
  const { error } = await c.supabase.from('quotation_templates').update({ is_active }).eq('id', id);
  if (error) return { error: dbError(error, 'template') };
  revalidatePath('/admin/quotations/settings');
  return {};
}

// ---------- Quotation / invoice settings --------------------------------------

const settingsSchema = z.object({
  markup_pct: reqNum.pipe(z.number().max(100)),
  gst_pct: reqNum.pipe(z.number().max(28)),
  round_to: reqNum,
  quote_valid_days: reqNum,
  sightseeing_km_per_day: reqNum,
  company_name: optStr(150),
  company_address: optStr(1000),
  company_phone: optStr(60),
  company_email: optStr(150),
  company_website: optStr(150),
  company_gstin: optStr(20),
  company_state: optStr(60),
  sac_code: optStr(10),
  bank_details: optStr(2000),
  invoice_due_days: reqNum,
  invoice_terms: optStr(4000),
  exclusions: str(8000),
  cancellation: str(4000),
  important_notes: str(8000),
});

const lines = (t: string) => t.split('\n').map((s) => s.trim()).filter(Boolean);

export async function saveTourSettings(raw: Record<string, unknown>) {
  const p = settingsSchema.safeParse(raw);
  if (!p.success) return { error: firstIssue(p.error) };
  const c = await adminClient();
  if ('error' in c) return { error: c.error };
  const d = p.data;
  const row = {
    ...d,
    round_to: Math.max(1, Math.round(d.round_to)),
    quote_valid_days: Math.round(d.quote_valid_days),
    sightseeing_km_per_day: Math.round(d.sightseeing_km_per_day),
    invoice_due_days: Math.round(d.invoice_due_days),
    exclusions: lines(d.exclusions),
    important_notes: lines(d.important_notes),
    // "Timeline | Charge" per line
    cancellation: lines(d.cancellation).map((l) => {
      const [a = '', ...b] = l.split('|');
      return [a.trim(), b.join('|').trim()];
    }),
    updated_by: c.profile.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await c.supabase.from('tour_settings').upsert({ id: 1, ...row });
  if (error) return { error: dbError(error, 'settings') };
  invalidateTourMastersCache();
  revalidatePath('/admin/quotations');
  revalidatePath('/admin/quotations/settings');
  return {};
}

// ---------- Rate Master: rebuild date windows -----------------------------------

/**
 * Re-reads every active rate period's "Date Range" text with the season
 * parser and rewrites rate_period_dates. Use once after upgrading (older
 * imports stored a whole-year window for labels they could not read).
 */
export async function rebuildRateDateWindows(): Promise<{ error?: string; periods?: number; unreadable?: string[] }> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };
  const { parseSeasonDates } = await import('@/lib/excel/season-dates');
  const periods: { id: number; date_range_label: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await c.supabase
      .from('rate_periods')
      .select('id, date_range_label')
      .eq('is_active', true)
      .order('id')
      .range(from, from + 999);
    if (error) return { error: dbError(error, 'rate period') };
    periods.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const unreadable = new Set<string>();
  const rows: { rate_period_id: number; valid_from: string; valid_to: string; is_exclusion: boolean }[] = [];
  for (const p of periods) {
    const r = parseSeasonDates(p.date_range_label);
    if (!r.ok) {
      unreadable.add(p.date_range_label);
      continue;
    }
    for (const w of r.ranges) rows.push({ rate_period_id: p.id, valid_from: w.from, valid_to: w.to, is_exclusion: false });
    for (const w of r.exclusions) rows.push({ rate_period_id: p.id, valid_from: w.from, valid_to: w.to, is_exclusion: true });
  }
  const ids = periods.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 500) {
    const { error } = await c.supabase.from('rate_period_dates').delete().in('rate_period_id', ids.slice(i, i + 500));
    if (error) return { error: dbError(error, 'rate period dates') };
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await c.supabase.from('rate_period_dates').insert(rows.slice(i, i + 500));
    if (error) return { error: dbError(error, 'rate period dates') };
  }
  revalidatePath('/admin/master');
  return { periods: periods.length, unreadable: Array.from(unreadable) };
}
