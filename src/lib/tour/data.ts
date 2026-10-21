import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { parseSeasonDates } from '@/lib/excel/season-dates';
import { rateLocationIds } from './engine';
import type { RateRow, TourMasters, TourSettings, QuotationLogosConfig, InvoiceSettings } from './types';
import { DEFAULT_QUOTATION_LOGOS, DEFAULT_INVOICE_SETTINGS } from './types';

export const DEFAULT_SETTINGS: TourSettings = {
  markup_pct: 15,
  gst_pct: 5,
  round_to: 100,
  quote_valid_days: 7,
  sightseeing_km_per_day: 40,
  company_name: 'Travinco Travel Solutions',
  company_address: '1st Floor, Muthassi Building,\nMannamoola, Peroorkada\nTrivandrum, Kerala - 695005',
  company_phone: '+91-7025549224',
  company_email: 'info@travinco.com',
  company_website: 'www.travinco.com',
  company_gstin: null,
  company_state: 'Kerala',
  sac_code: '998555',
  bank_details: null,
  invoice_due_days: 0,
  invoice_terms: null,
  exclusions: [],
  cancellation: [],
  important_notes: [],
  logos_config: DEFAULT_QUOTATION_LOGOS,
  invoice_settings: DEFAULT_INVOICE_SETTINGS,
};

const n = (v: unknown) => (v == null ? v : Number(v)) as number;

export async function getTourSettings(client?: any): Promise<TourSettings> {
  const supabase = client ?? (await createClient());
  const [{ data }, { data: wsLogos }, { data: wsInvoice }] = await Promise.all([
    supabase.from('tour_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('website_settings').select('value').eq('key', 'quotation_logos').maybeSingle(),
    supabase.from('website_settings').select('value').eq('key', 'invoice_settings').maybeSingle(),
  ]);

  const rawLogos = wsLogos?.value as QuotationLogosConfig | null;
  const logos_config: QuotationLogosConfig = rawLogos && Array.isArray(rawLogos.logos)
    ? {
        header_logo_url: rawLogos.header_logo_url || DEFAULT_QUOTATION_LOGOS.header_logo_url,
        tour_logo_url: rawLogos.tour_logo_url || DEFAULT_QUOTATION_LOGOS.tour_logo_url,
        registered_title: rawLogos.registered_title || DEFAULT_QUOTATION_LOGOS.registered_title,
        partners_title: rawLogos.partners_title || DEFAULT_QUOTATION_LOGOS.partners_title,
        logos: rawLogos.logos,
      }
    : DEFAULT_QUOTATION_LOGOS;

  const rawInvoice = wsInvoice?.value as InvoiceSettings | null;
  const invoice_settings: InvoiceSettings = rawInvoice
    ? { ...DEFAULT_INVOICE_SETTINGS, ...rawInvoice }
    : DEFAULT_INVOICE_SETTINGS;

  if (!data) return { ...DEFAULT_SETTINGS, logos_config, invoice_settings };
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    logos_config,
    invoice_settings,
    markup_pct: n(data.markup_pct),
    gst_pct: n(data.gst_pct),
    round_to: n(data.round_to),
    exclusions: Array.isArray(data.exclusions) ? data.exclusions : [],
    cancellation: Array.isArray(data.cancellation) ? data.cancellation : [],
    important_notes: Array.isArray(data.important_notes) ? data.important_notes : [],
  };
}

let memoryCache: { data: TourMasters; expiresAt: number } | null = null;

export function invalidateTourMastersCache() {
  memoryCache = null;
}

/** All master data the quotation builder needs (everything except hotel rates). */
export async function loadTourMasters(opts: { activeOnly?: boolean; forceFresh?: boolean } = {}): Promise<TourMasters> {
  const active = opts.activeOnly !== false;
  const now = Date.now();
  if (active && !opts.forceFresh && memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.data;
  }

  const supabase = await createClient();
  const sel = (t: string, order: string) => {
    let q = supabase.from(t).select('*').order(order);
    if (active) q = q.eq('is_active', true);
    return q;
  };
  const [locs, cats, points, vehicles, acts, dists, plans, tpls, settings, dests] = await Promise.all([
    supabase.from('locations').select('id, name, display_name, state, description, parent_id, is_houseboat, is_active, sort_order').order('sort_order').order('name'),
    supabase.from('hotel_categories').select('id, name, sort_order').order('sort_order').order('id'),
    sel('pickup_drop_points', 'sort_order'),
    sel('transport_vehicles', 'vehicle_type'),
    sel('location_activities', 'sort_order'),
    supabase.from('location_distances').select('*'),
    sel('day_plans', 'sort_order'),
    sel('quotation_templates', 'sort_order'),
    getTourSettings(supabase),
    supabase.from('destinations').select('id, name').order('sort_order').order('name'),
  ]);

  const result: TourMasters = {
    locations: ((locs.data ?? []) as TourMasters['locations']).filter(
      (l: any) => l && l.is_deleted !== true && l.is_deleted !== 'true' && l.is_deleted !== 1
    ),
    categories: (cats.data ?? []) as TourMasters['categories'],
    points: (points.data ?? [])
      .filter((p: any) => p && p.is_deleted !== true && p.is_deleted !== 'true' && p.is_deleted !== 1)
      .map((p) => ({ ...p, km_from_location: Number(p.km_from_location ?? 0) })),
    vehicles: (vehicles.data ?? [])
      .filter((v: any) => v && v.is_deleted !== true && v.is_deleted !== 'true' && v.is_deleted !== 1)
      .map((v) => ({
        ...v,
        amount: Number(v.amount ?? 0),
        extra_per_km: Number(v.extra_per_km ?? 0),
        driver_bata_per_day: Number(v.driver_bata_per_day ?? 0),
      })),
    activities: (acts.data ?? [])
      .filter((a: any) => a && a.is_deleted !== true && a.is_deleted !== 'true' && a.is_deleted !== 1)
      .map((a) => ({
        ...a,
        entry_fee_adult: a.entry_fee_adult == null ? null : Number(a.entry_fee_adult),
        entry_fee_child: a.entry_fee_child == null ? null : Number(a.entry_fee_child),
      })),
    distances: (dists.data ?? [])
      .filter((d: any) => d && d.is_deleted !== true && d.is_deleted !== 'true' && d.is_deleted !== 1)
      .map((d) => ({ ...d, distance_km: Number(d.distance_km) })),
    plans: (plans.data ?? [])
      .filter((p: any) => p && p.is_deleted !== true && p.is_deleted !== 'true' && p.is_deleted !== 1)
      .map((p) => ({ ...p, items: Array.isArray(p.items) ? p.items : [] })),
    templates: (tpls.data ?? []).map((t) => ({
      ...t,
      stays: Array.isArray(t.stays) ? t.stays : [],
      plan_picks: Array.isArray(t.plan_picks) ? t.plan_picks : [],
    })),
    settings,
    destinations: ((dests?.data ?? []) as { id: string; name: string }[]).filter(
      (d: any) => d && d.is_deleted !== true && d.is_deleted !== 'true' && d.is_deleted !== 1
    ),
  };

  if (active) {
    memoryCache = { data: result, expiresAt: now + 5 * 60 * 1000 };
  }

  return result;
}

const toNum = (v: unknown) => (v == null ? null : Number(v));

/**
 * Active rate rows for hotels in the given stay locations (and their
 * same-type sub-locations). Pages through the view because PostgREST caps
 * a single response at 1,000 rows.
 */
export async function loadRatesForStays(m: TourMasters, stayLocationIds: number[]): Promise<RateRow[]> {
  const ids = rateLocationIds(m, stayLocationIds);
  if (!ids.length) return [];
  const supabase = await createClient();
  const out: RateRow[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await supabase
      .from('v_quote_rates')
      .select('*')
      .in('location_id', ids)
      .order('rate_id')
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('loadRatesForStays:', error.message);
      break;
    }
    for (const r of data ?? []) {
      const parsed = parseSeasonDates(r.date_range_label);
      const windows: [string, string, boolean][] = parsed.ok
        ? [
            ...parsed.ranges.map((x) => [x.from, x.to, false] as [string, string, boolean]),
            ...parsed.exclusions.map((x) => [x.from, x.to, true] as [string, string, boolean]),
          ]
        : ((Array.isArray(r.windows) ? r.windows : []) as [string, string, boolean][]);
      out.push({
        ...r,
        cp_cost: toNum(r.cp_cost),
        map_cost: toNum(r.map_cost),
        extra_adult_cp: toNum(r.extra_adult_cp),
        extra_adult_map: toNum(r.extra_adult_map),
        child_bed_cost: toNum(r.child_bed_cost),
        child_no_bed_cost: toNum(r.child_no_bed_cost),
        windows,
      } as RateRow);
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}
