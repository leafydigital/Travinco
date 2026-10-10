'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canAccess, canOverrideMarkup, isAdminRole } from '@/lib/tour/access';
import { loadRatesForStays, loadTourMasters } from '@/lib/tour/data';
import { addDays, buildCtx, buildSnapshot, normalizeInputs, quote, totalNights } from '@/lib/tour/engine';
import type { QuoteInputs, RateRow } from '@/lib/tour/types';

const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
type Status = (typeof STATUSES)[number];

async function staff() {
  const profile = await requireProfile();
  if (!canAccess(profile, 'quotations')) return null;
  return { profile, supabase: await createClient() };
}

/** Rate Master rows for the builder's live pricing. */
export async function getRatesForLocations(locationIds: number[]): Promise<RateRow[]> {
  const s = await staff();
  if (!s) return [];
  const m = await loadTourMasters();
  return loadRatesForStays(m, locationIds.filter((n) => Number.isFinite(n)).slice(0, 40));
}

export async function searchCustomers(q: string) {
  const s = await staff();
  if (!s) return [];
  const term = q.replace(/[,()%*]/g, ' ').trim();
  if (term.length < 2) return [];
  const { data } = await s.supabase
    .from('customers')
    .select('id, full_name, phone, email, city')
    .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
    .order('full_name')
    .limit(8);
  return data ?? [];
}

/**
 * Prices the quotation on the server with the same engine the builder
 * uses, stores the inputs plus a rendered snapshot, and returns its id.
 */
export async function saveQuotation(
  id: string | null,
  raw: Partial<QuoteInputs>,
  status?: Status
): Promise<{ error?: string; id?: string }> {
  const s = await staff();
  if (!s) return { error: 'You do not have access to quotations.' };
  const { profile, supabase } = s;

  const m = await loadTourMasters();
  const inputs = normalizeInputs(raw, m);
  if (!inputs.guest_name.trim()) return { error: 'Enter the guest name.' };
  if (!inputs.stays.length) return { error: 'Add at least one stay (location and nights).' };
  if (totalNights(inputs) > 60) return { error: 'A quotation can cover at most 60 nights.' };
  const override = canOverrideMarkup(profile);
  if (!override) inputs.markup_pct = null;

  if (id) {
    const { data: existing } = await supabase.from('quotations').select('status').eq('id', id).maybeSingle();
    if (!existing) return { error: 'Quotation not found.' };
    if (existing.status === 'invoiced') return { error: 'This quotation has been invoiced. Cancel the invoice before editing it, or duplicate the quotation.' };
  }

  const rates = await loadRatesForStays(m, inputs.stays.map((x) => x.location_id));
  const ctx = buildCtx(m, rates, override);
  const q1 = quote(ctx, inputs, 1);
  const q2 = inputs.category2_id ? quote(ctx, inputs, 2) : null;
  const snapshot = buildSnapshot(ctx, inputs, q1, q2);
  const nights = totalNights(inputs);
  const today = new Date().toISOString().slice(0, 10);
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const row = {
    customer_id: inputs.customer_id || null,
    enquiry_id: inputs.enquiry_id || null,
    guest_name: inputs.guest_name.trim().slice(0, 150),
    guest_phone: inputs.guest_phone.trim().slice(0, 30) || null,
    guest_email: inputs.guest_email.trim().slice(0, 150) || null,
    title: snapshot.doc_title.slice(0, 200),
    trip_type: inputs.trip_type.slice(0, 40),
    start_date: inputs.start_date,
    end_date: addDays(inputs.start_date, nights),
    nights,
    adults: inputs.adults,
    children_with_bed: inputs.cwb,
    children_no_bed: inputs.cnb,
    child_ages: inputs.child_ages.slice(0, 60) || null,
    rooms: inputs.rooms,
    meal_plan: inputs.meal,
    category_id: inputs.category_id,
    category2_id: inputs.category2_id,
    pickup_point_id: inputs.pickup_point_id,
    drop_point_id: inputs.drop_point_id,
    transport_vehicle_id: inputs.vehicle_id,
    template_id: inputs.template_id,
    inputs,
    snapshot,
    hotel_cost: r2(q1.hotels),
    vehicle_cost: r2(q1.vehicle.total),
    other_cost: r2(q1.other),
    net_cost: r2(q1.net),
    markup_pct: q1.markupPct,
    markup_amount: r2(q1.markup),
    gst_pct: q1.gstPct,
    gst_amount: r2(q1.gst),
    total_amount: q1.total,
    total_amount2: q2 ? q2.total : null,
    valid_until: inputs.valid_until || addDays(today, Number(m.settings.quote_valid_days) || 7),
    notes: inputs.notes.slice(0, 4000) || null,
    ...(status ? { status, ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}) } : {}),
  };

  const res = id
    ? await supabase.from('quotations').update(row).eq('id', id).select('id').single()
    : await supabase.from('quotations').insert({ ...row, created_by: profile.id }).select('id').single();
  if (res.error) {
    console.error('saveQuotation', res.error.message);
    return { error: 'Could not save the quotation.' };
  }

  // Keep the CRM in step: an enquiry with a saved quotation moves to "quotation sent".
  if (inputs.enquiry_id && status === 'sent') {
    await supabase.from('enquiries').update({ status: 'quotation_sent' }).eq('id', inputs.enquiry_id);
  }

  revalidatePath('/admin/quotations');
  revalidatePath(`/admin/quotations/${res.data.id}`);
  return { id: res.data.id };
}

export async function setQuotationStatus(id: string, status: Status) {
  const s = await staff();
  if (!s) return { error: 'You do not have access to quotations.' };
  if (!STATUSES.includes(status)) return { error: 'Unknown status.' };
  const { data: q } = await s.supabase.from('quotations').select('status, enquiry_id').eq('id', id).maybeSingle();
  if (!q) return { error: 'Quotation not found.' };
  if (q.status === 'invoiced') return { error: 'This quotation is already invoiced.' };
  const { error } = await s.supabase
    .from('quotations')
    .update({ status, ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}) })
    .eq('id', id);
  if (error) return { error: 'Could not update the status.' };
  if (q.enquiry_id && (status === 'sent' || status === 'accepted' || status === 'rejected')) {
    const map = { sent: 'quotation_sent', accepted: 'confirmed', rejected: 'lost' } as const;
    await s.supabase.from('enquiries').update({ status: map[status] }).eq('id', q.enquiry_id);
  }
  revalidatePath('/admin/quotations');
  revalidatePath(`/admin/quotations/${id}`);
  return {};
}

export async function duplicateQuotation(id: string): Promise<{ error?: string; id?: string }> {
  const s = await staff();
  if (!s) return { error: 'You do not have access to quotations.' };
  const { data: q } = await s.supabase.from('quotations').select('inputs').eq('id', id).maybeSingle();
  if (!q) return { error: 'Quotation not found.' };
  const inputs = { ...(q.inputs as QuoteInputs), valid_until: null };
  return saveQuotation(null, inputs, 'draft');
}

export async function deleteQuotation(id: string): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!isAdminRole(profile)) return { error: 'Only admins can delete quotations.' };
  const supabase = await createClient();
  const { data: inv } = await supabase.from('invoices').select('id').eq('quotation_id', id).neq('status', 'cancelled').limit(1);
  if (inv && inv.length) return { error: 'This quotation has an active invoice. Cancel or delete the invoice first.' };
  const { error } = await supabase.from('quotations').delete().eq('id', id);
  if (error) return { error: 'Could not delete the quotation: ' + error.message };
  revalidatePath('/admin/quotations');
  return {};
}

/** Saves the current route as a reusable package template. */
export async function saveAsTemplate(name: string, raw: Partial<QuoteInputs>) {
  const s = await staff();
  if (!s) return { error: 'You do not have access to quotations.' };
  const m = await loadTourMasters();
  const i = normalizeInputs(raw, m);
  if (!name.trim()) return { error: 'Give the template a name.' };
  if (!i.stays.length) return { error: 'Add stays before saving a template.' };
  const vehicle = m.vehicles.find((v) => v.id === i.vehicle_id);
  const picks = Object.values(i.days || {}).map((d) => d.plan_id).filter((x): x is number => typeof x === 'number');
  const { error } = await s.supabase.from('quotation_templates').insert({
    name: name.trim().slice(0, 200),
    trip_type: i.trip_type,
    pickup_point_id: i.pickup_point_id,
    drop_point_id: i.drop_point_id,
    category_id: i.category_id,
    vehicle_type: vehicle?.vehicle_type ?? null,
    adults: i.adults,
    stays: i.stays.map((x) => ({ location_id: x.location_id, nights: x.nights })),
    plan_picks: Array.from(new Set([...i.plan_picks, ...picks])),
    extra_inclusions: i.extra_inclusions || null,
    created_by: s.profile.id,
  });
  if (error) return { error: error.code === '23505' ? 'A template with this name already exists.' : 'Could not save the template.' };
  revalidatePath('/admin/quotations/new');
  return {};
}
