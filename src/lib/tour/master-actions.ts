'use server';

import { revalidatePath } from '@/lib/public-cache'; // also purges cached public website content
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from './access';
import type { PlanItem, QuotationLogosConfig, InvoiceSettings } from './types';

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

async function softDelete(
  table: string,
  entityName: string,
  id: number | string,
  paths: string[],
  rpcName?: string,
  rpcArgName?: string,
  settingKeyPrefix?: string
): Promise<Result> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };

  const numericId = Number(id);

  // 1. Try RPC if provided
  if (rpcName && rpcArgName) {
    const { error: rpcError } = await c.supabase.rpc(rpcName, {
      [rpcArgName]: numericId,
    });
    if (!rpcError) {
      if (settingKeyPrefix) {
        try {
          await c.supabase.from('website_settings').upsert({
            key: `${settingKeyPrefix}_${numericId}`,
            value: { is_deleted: true, deleted_at: new Date().toISOString() },
          });
        } catch (err) {
          console.warn(`Failed to record ${settingKeyPrefix} marker:`, err);
        }
      }
      invalidateTourMastersCache();
      paths.forEach((p) => revalidatePath(p));
      return {};
    }
  }

  // 2. Direct update fallback
  let { error } = await c.supabase
    .from(table)
    .update({ is_deleted: true, updated_at: new Date().toISOString() } as any)
    .eq('id', numericId);

  if (error && error.message?.includes('is_deleted')) {
    console.warn(`Column is_deleted missing from ${table} table. Using website_settings marker.`);
  } else if (error) {
    console.error(`softDelete (${table}) error:`, error);
    return { error: dbError(error, entityName) };
  }

  // 3. Fallback tracking in website_settings
  if (settingKeyPrefix) {
    try {
      await c.supabase.from('website_settings').upsert({
        key: `${settingKeyPrefix}_${numericId}`,
        value: { is_deleted: true, deleted_at: new Date().toISOString() },
      });
    } catch (err) {
      console.warn(`Failed to record ${settingKeyPrefix} marker:`, err);
    }
  }

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
  const payload = id == null
    ? { ...p.data, free_km: Math.round(p.data.free_km), is_deleted: false }
    : { ...p.data, free_km: Math.round(p.data.free_km) };
  return save('transport_vehicles', 'vehicle', id, payload, ['/travinco_dashboard/transport', '/travinco_dashboard/quotations']);
}
export async function deleteTransportVehicle(id: number | string) {
  return softDelete(
    'transport_vehicles',
    'vehicle',
    id,
    ['/travinco_dashboard/transport', '/travinco_dashboard/quotations'],
    'soft_delete_transport_vehicle',
    'vehicle_id',
    'deleted_transport_vehicle'
  );
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
  const payload = id == null ? { ...p.data, is_deleted: false } : p.data;
  return save('pickup_drop_points', 'pickup / drop point', id, payload, ['/travinco_dashboard/pickup-points']);
}
export async function deletePickupPoint(id: number | string) {
  return softDelete(
    'pickup_drop_points',
    'pickup / drop point',
    id,
    ['/travinco_dashboard/pickup-points', '/travinco_dashboard/quotations'],
    'soft_delete_pickup_drop_point',
    'point_id',
    'deleted_pickup_point'
  );
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
  const payload = id == null ? { ...p.data, is_deleted: false } : p.data;
  return save('locations', 'location', id, payload, ['/travinco_dashboard/locations']);
}
export async function deleteLocation(id: number | string) {
  return softDelete(
    'locations',
    'location',
    id,
    [
      '/travinco_dashboard/locations',
      '/travinco_dashboard/locations/activities',
      '/travinco_dashboard/locations/distances',
      '/travinco_dashboard/locations/day-plans',
      '/travinco_dashboard/quotations',
    ],
    'soft_delete_location',
    'loc_id',
    'deleted_location'
  );
}

// ---------- Activities ------------------------------------------------------

const activitySchema = z.object({
  location_id: reqId,
  name: str(150).pipe(z.string().min(1, 'Name is required')),
  category: optStr(100),
  kind: z.string().optional().default('sightseeing'),
  preferred_types: optStr(200),
  description: optStr(4000),
  duration: optStr(60),
  timings: optStr(120),
  closed_on: optStr(120),
  entry_fee_adult: optNum,
  entry_fee_child: optNum,
  is_optional_paid: bool.optional().default(false),
  approx_cost_text: optStr(120),
  sort_order: reqNum.optional().default(100),
  is_active: bool.optional().default(true),
});

export async function saveActivity(id: number | string | null, raw: Record<string, unknown>) {
  const p = activitySchema.safeParse(raw);
  if (!p.success) return { error: firstIssue(p.error) };
  const payload: Record<string, unknown> = id == null ? { ...p.data, is_deleted: false } : { ...p.data };
  
  const c = await adminClient();
  if ('error' in c) return { error: c.error };

  let q = id == null
    ? c.supabase.from('location_activities').insert(payload).select('id').single()
    : c.supabase.from('location_activities').update(payload).eq('id', id).select('id').single();

  let { data, error } = await q;

  // Fallback if category or preferred_types columns are not yet in database
  if (error && (error.code === '42703' || error.message?.includes('category') || error.message?.includes('preferred_types'))) {
    delete payload.category;
    delete payload.preferred_types;
    q = id == null
      ? c.supabase.from('location_activities').insert(payload).select('id').single()
      : c.supabase.from('location_activities').update(payload).eq('id', id).select('id').single();
    const retry = await q;
    data = retry.data;
    error = retry.error;
  }

  if (error) return { error: dbError(error, 'activity') };
  invalidateTourMastersCache();
  ['/travinco_dashboard/locations', '/travinco_dashboard/locations/activities'].forEach((p) => revalidatePath(p));
  return { id: data?.id };
}

export async function deleteActivity(id: number | string) {
  return softDelete(
    'location_activities',
    'activity',
    id,
    ['/travinco_dashboard/locations/activities', '/travinco_dashboard/locations', '/travinco_dashboard/quotations'],
    'soft_delete_location_activity',
    'act_id',
    'deleted_activity'
  );
}

export type ExcelActivityRow = {
  location: string;
  activities: string;
  categories?: string;
  preferred_types?: string;
};

export type ImportLocationActivitiesOptions = {
  updateExisting?: boolean;
};

export type ImportLocationActivitiesResult = {
  error?: string;
  imported?: number;
  updated?: number;
  skippedDuplicates?: number;
  locationsCreated?: number;
  totalProcessed?: number;
};

function cleanExcelString(val: any): string {
  if (val == null) return '';
  return String(val)
    .replace(/[\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanExcelKey(val: any): string {
  return cleanExcelString(val).toLowerCase();
}

function toTitleCase(val: string): string {
  const s = cleanExcelString(val);
  if (!s) return '';
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export async function importLocationActivitiesAction(
  rows: ExcelActivityRow[],
  options: ImportLocationActivitiesOptions = { updateExisting: true }
): Promise<ImportLocationActivitiesResult> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };
  const { supabase } = c;

  if (!rows || rows.length === 0) {
    return { error: 'No data found to import.' };
  }

  // 1. Fetch all existing locations
  const { data: existingLocs } = await supabase
    .from('locations')
    .select('id, name, display_name, is_deleted');

  const locMap = new Map<string, number>();
  (existingLocs || []).forEach((l: any) => {
    if (l.name) locMap.set(cleanExcelKey(l.name), Number(l.id));
    if (l.display_name) locMap.set(cleanExcelKey(l.display_name), Number(l.id));
  });

  // 2. Fetch all existing activities (both active and soft-deleted)
  const { data: existingActs } = await supabase
    .from('location_activities')
    .select('id, location_id, name, category, preferred_types, is_deleted');

  // Key format: `${location_id}:::${cleanExcelKey(name)}`
  const actMap = new Map<
    string,
    { id: number; is_deleted: boolean; category?: string | null; preferred_types?: string | null }
  >();

  (existingActs || []).forEach((a: any) => {
    const key = `${a.location_id}:::${cleanExcelKey(a.name)}`;
    // If duplicates exist in DB, prefer an active record
    if (!actMap.has(key) || !a.is_deleted) {
      actMap.set(key, {
        id: Number(a.id),
        is_deleted: Boolean(a.is_deleted),
        category: a.category,
        preferred_types: a.preferred_types,
      });
    }
  });

  // 3. Track intra-file duplicates
  const seenInFile = new Set<string>();

  let imported = 0;
  let updated = 0;
  let skippedDuplicates = 0;
  let locationsCreated = 0;
  let totalProcessed = 0;

  for (const r of rows) {
    const locName = cleanExcelString(r.location);
    const actName = cleanExcelString(r.activities);
    if (!locName || !actName) continue;

    totalProcessed++;
    const locKey = cleanExcelKey(locName);
    const actKey = cleanExcelKey(actName);
    const fileRowKey = `${locKey}:::${actKey}`;

    // Intra-file duplicate check: skip subsequent duplicates in same upload
    if (seenInFile.has(fileRowKey)) {
      skippedDuplicates++;
      continue;
    }
    seenInFile.add(fileRowKey);

    // Find or create location
    let locId = locMap.get(locKey);

    if (!locId) {
      const formattedLocName = toTitleCase(locName);
      const { data: newLoc, error: locErr } = await supabase
        .from('locations')
        .insert({
          name: formattedLocName,
          display_name: formattedLocName,
          state: 'Kerala',
          sort_order: 100,
          is_active: true,
          is_deleted: false,
        })
        .select('id')
        .single();

      if (!locErr && newLoc) {
        locId = Number(newLoc.id);
        locMap.set(locKey, locId);
        locationsCreated++;
      } else {
        const { data: found } = await supabase
          .from('locations')
          .select('id')
          .ilike('name', locName)
          .maybeSingle();
        if (found) {
          locId = Number(found.id);
          locMap.set(locKey, locId);
        }
      }
    }

    if (!locId) continue;

    const dbKey = `${locId}:::${actKey}`;
    const existingAct = actMap.get(dbKey);

    const category = cleanExcelString(r.categories) || 'Sightseeing';
    const prefType = cleanExcelString(r.preferred_types) || 'All';
    const kind = category.toLowerCase().includes('activity')
      ? 'activity'
      : category.toLowerCase().includes('experience')
      ? 'experience'
      : category.toLowerCase().includes('temple')
      ? 'temple'
      : category.toLowerCase().includes('shopping')
      ? 'shopping'
      : 'sightseeing';

    if (existingAct) {
      // Existing in database
      const shouldUpdate = options.updateExisting !== false || existingAct.is_deleted;
      if (shouldUpdate) {
        const updateData: Record<string, any> = {
          name: actName,
          category,
          preferred_types: prefType,
          kind,
          is_active: true,
          is_deleted: false,
          updated_at: new Date().toISOString(),
        };

        let { error } = await supabase
          .from('location_activities')
          .update(updateData)
          .eq('id', existingAct.id);

        if (error && (error.code === '42703' || error.message?.includes('category') || error.message?.includes('preferred_types'))) {
          delete updateData.category;
          delete updateData.preferred_types;
          const retry = await supabase
            .from('location_activities')
            .update(updateData)
            .eq('id', existingAct.id);
          error = retry.error;
        }

        if (!error) {
          updated++;
          actMap.set(dbKey, {
            id: existingAct.id,
            is_deleted: false,
            category,
            preferred_types: prefType,
          });
        }
      } else {
        skippedDuplicates++;
      }
    } else {
      // Brand new activity
      const insertData: Record<string, any> = {
        location_id: locId,
        name: actName,
        category,
        preferred_types: prefType,
        kind,
        is_active: true,
        is_deleted: false,
        sort_order: 100,
      };

      let { data: newAct, error } = await supabase
        .from('location_activities')
        .insert(insertData)
        .select('id')
        .single();

      if (error && (error.code === '42703' || error.message?.includes('category') || error.message?.includes('preferred_types'))) {
        delete insertData.category;
        delete insertData.preferred_types;
        const retry = await supabase
          .from('location_activities')
          .insert(insertData)
          .select('id')
          .single();
        error = retry.error;
        newAct = retry.data;
      }

      if (!error && newAct) {
        imported++;
        actMap.set(dbKey, {
          id: Number(newAct.id),
          is_deleted: false,
          category,
          preferred_types: prefType,
        });
      }
    }
  }

  invalidateTourMastersCache();
  revalidatePath('/travinco_dashboard/locations');
  revalidatePath('/travinco_dashboard/locations/activities');
  return {
    imported,
    updated,
    skippedDuplicates,
    locationsCreated,
    totalProcessed,
  };
}

export async function clearSeedActivitiesAction(): Promise<{ error?: string; count?: number }> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };
  const { profile, supabase } = c;

  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return { error: 'Only administrators can clear activities.' };
  }

  const { data, error } = await supabase
    .from('location_activities')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .neq('is_deleted', true)
    .select('id');

  if (error) {
    return { error: error.message };
  }

  invalidateTourMastersCache();
  revalidatePath('/travinco_dashboard/locations');
  revalidatePath('/travinco_dashboard/locations/activities');
  return { count: data?.length ?? 0 };
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
  const payload = id == null
    ? { ...p.data, from_location_id: Math.min(a, b), to_location_id: Math.max(a, b), is_deleted: false }
    : { ...p.data, from_location_id: Math.min(a, b), to_location_id: Math.max(a, b) };
  return save('location_distances', 'distance', id, payload, ['/travinco_dashboard/locations/distances']);
}
export async function deleteDistance(id: number | string) {
  return softDelete(
    'location_distances',
    'distance',
    id,
    ['/travinco_dashboard/locations/distances', '/travinco_dashboard/quotations'],
    'soft_delete_location_distance',
    'dist_id',
    'deleted_distance'
  );
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
  const payload = id == null
    ? { ...rest, from_location_id: needsFrom ? rest.from_location_id : null, items: textToItems(items_text), is_deleted: false }
    : { ...rest, from_location_id: needsFrom ? rest.from_location_id : null, items: textToItems(items_text) };
  return save(
    'day_plans',
    'day plan',
    id,
    payload,
    ['/travinco_dashboard/locations/day-plans', '/travinco_dashboard/quotations']
  );
}
export async function deleteDayPlan(id: number | string) {
  return softDelete(
    'day_plans',
    'day plan',
    id,
    ['/travinco_dashboard/locations/day-plans', '/travinco_dashboard/quotations'],
    'soft_delete_day_plan',
    'plan_id',
    'deleted_day_plan'
  );
}

// ---------- Quotation templates ----------------------------------------------

export async function deleteQuotationTemplate(id: number | string) {
  return remove('quotation_templates', 'template', id, ['/travinco_dashboard/quotations/settings']);
}

export async function toggleQuotationTemplate(id: number, is_active: boolean) {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };
  const { error } = await c.supabase.from('quotation_templates').update({ is_active }).eq('id', id);
  if (error) return { error: dbError(error, 'template') };
  revalidatePath('/travinco_dashboard/quotations/settings');
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
  revalidatePath('/travinco_dashboard/quotations');
  revalidatePath('/travinco_dashboard/quotations/settings');
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
  revalidatePath('/travinco_dashboard/master');
  return { periods: periods.length, unreadable: Array.from(unreadable) };
}

// ---------- Quotation Branding & Logos ---------------------------------------

export async function saveQuotationLogos(logosConfig: QuotationLogosConfig): Promise<{ error?: string }> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };

  const { error } = await c.supabase.from('website_settings').upsert(
    {
      key: 'quotation_logos',
      value: logosConfig,
      updated_by: c.profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );

  if (error) {
    console.error('Failed to save quotation_logos:', error);
    return { error: 'Could not save quotation logos. Please try again.' };
  }

  invalidateTourMastersCache();
  revalidatePath('/travinco_dashboard/quotations');
  revalidatePath('/travinco_dashboard/quotations/settings');
  revalidatePath('/admin/quotations/settings');
  return {};
}

export async function uploadQuotationLogo(formData: FormData): Promise<{ url?: string; error?: string }> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };

  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: 'Please choose an image file to upload.' };
  }

  const { uploadImageToBucket } = await import('@/lib/storage-upload');
  return await uploadImageToBucket('brand', file);
}

export async function saveInvoiceSettings(invoiceSettings: InvoiceSettings): Promise<{ error?: string }> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };

  const { error } = await c.supabase.from('website_settings').upsert(
    {
      key: 'invoice_settings',
      value: invoiceSettings,
      updated_by: c.profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );

  if (error) {
    console.error('Failed to save invoice_settings:', error);
    return { error: 'Could not save invoice settings. Please try again.' };
  }

  invalidateTourMastersCache();
  revalidatePath('/travinco_dashboard/quotations/settings');
  revalidatePath('/travinco_dashboard/invoices');
  revalidatePath('/admin/quotations/settings');
  revalidatePath('/admin/invoices');
  return {};
}

export async function uploadInvoiceSignature(formData: FormData): Promise<{ url?: string; error?: string }> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };

  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: 'Please choose a signature image to upload.' };
  }

  const { uploadImageToBucket } = await import('@/lib/storage-upload');
  return await uploadImageToBucket('brand', file);
}

export async function uploadInvoiceQrCode(formData: FormData): Promise<{ url?: string; error?: string }> {
  const c = await adminClient();
  if ('error' in c) return { error: c.error };

  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: 'Please choose a QR code image to upload.' };
  }

  const { uploadImageToBucket } = await import('@/lib/storage-upload');
  return await uploadImageToBucket('brand', file);
}

