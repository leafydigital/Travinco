'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, checkModulePermission, type CurrentProfile } from '@/lib/supabase/auth-helpers';
import { revalidatePath } from 'next/cache';
import { archiveRows, hardDeleteErrorMessage } from '@/lib/hard-delete';
import { createServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { addYearsIso, toIsoDate } from '@/lib/utils/iso-date';
import { maskBadWords } from '@/lib/validations/contact-rules';
import {
  ENQUIRY_STATUS_VALUES,
  RESOLVED_ENQUIRY_STATUSES,
  computePriorityFromTravelDate,
  enquiryStatusLabel,
  normalizeEnquiryStatus,
} from '@/lib/enquiry-status';
import {
  MAX_IMPORT_ROWS,
  IMPORT_COLUMNS,
  findInFileDuplicates,
  importDuplicateKey,
  normalizeImportRow,
  todayInIndia,
  type ImportColumnKey,
  type RawImportCells,
  type RawImportRow,
} from '@/lib/excel/enquiry-import';
import type { EnquiryStatus, FollowupType } from '@/types/database';

const ENQUIRIES_PATH = '/travinco_dashboard/enquiries';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RESOLVED_FILTER = `(${RESOLVED_ENQUIRY_STATUSES.map((s) => `"${s}"`).join(',')})`;

function isAdminProfile(profile: CurrentProfile) {
  return profile.role === 'admin' || profile.role === 'super_admin';
}

/**
 * Edit rights on the Enquiries page. Admins can work on every enquiry; everyone
 * else only on the enquiries assigned to them (pass enquiryId to check that).
 */
async function checkEnquiryEditPermission(enquiryId?: string) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'enquiries', 'edit');
  if (!perm.allowed) {
    return { error: perm.error || 'You do not have permission to edit enquiries.' };
  }
  if (enquiryId && !isAdminProfile(profile)) {
    const supabase = await createClient();
    const { data } = await supabase.from('enquiries').select('assigned_staff').eq('id', enquiryId).maybeSingle();
    if (!data || data.assigned_staff !== profile.id) {
      return { error: 'This enquiry is not assigned to you.' };
    }
  }
  return { profile };
}

async function requireAdmin() {
  const profile = await requireProfile();
  if (!isAdminProfile(profile)) return { error: 'Only admins can assign enquiries.' };
  return { profile };
}

async function logEnquiryActivity(
  enquiryId: string,
  activityType: string,
  description: string,
  metadata: Record<string, unknown> = {},
  performedBy?: string | null
) {
  const supabase = await createClient();
  let userId = performedBy;
  if (userId === undefined) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  await supabase.from('enquiry_activities').insert({
    enquiry_id: enquiryId,
    activity_type: activityType,
    description,
    metadata,
    performed_by: userId,
  });
}

export async function updateEnquiryStatus(
  enquiryId: string,
  status: EnquiryStatus
): Promise<{ error?: string }> {
  if (!ENQUIRY_STATUS_VALUES.includes(status)) return { error: 'Unknown status.' };
  const permCheck = await checkEnquiryEditPermission(enquiryId);
  if (permCheck.error) return { error: permCheck.error };
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('enquiries')
    .select('status')
    .eq('id', enquiryId)
    .single();

  const { error } = await supabase
    .from('enquiries')
    .update({ status, last_contacted_at: new Date().toISOString() })
    .eq('id', enquiryId);

  if (error) return { error: 'Could not update status.' };

  await logEnquiryActivity(
    enquiryId,
    'status_changed',
    `Status changed from ${before?.status ? enquiryStatusLabel(before.status) : 'unknown'} to ${enquiryStatusLabel(status)}`,
    { from_status: before?.status, to_status: status }
  );

  revalidatePath(`${ENQUIRIES_PATH}/${enquiryId}`);
  revalidatePath(ENQUIRIES_PATH);
  return {};
}

/**
 * Staff-facing accept/reject actions, on top of updateEnquiryStatus.
 * Automated email sending removed per workflow requirements.
 */
export async function acceptEnquiry(enquiryId: string): Promise<{ error?: string }> {
  return updateEnquiryStatus(enquiryId, 'converted');
}

export async function rejectEnquiry(enquiryId: string, reason?: string): Promise<{ error?: string }> {
  const result = await updateEnquiryStatus(enquiryId, 'lost');
  if (result.error) return result;

  if (reason?.trim()) {
    await logEnquiryActivity(enquiryId, 'rejected', `Rejected: ${reason.trim()}`);
  }

  return {};
}

/** Active staff an admin can hand enquiries to. */
async function loadActiveStaff(ids?: string[]) {
  const supabase = await createClient();
  let query = supabase.from('profiles').select('id, full_name').eq('is_active', true);
  if (ids) query = query.in('id', ids);
  const { data } = await query.order('full_name');
  return data ?? [];
}

export async function assignEnquiry(enquiryId: string, staffId: string | null) {
  const adminCheck = await requireAdmin();
  if (adminCheck.error) return { error: adminCheck.error };
  return bulkAssignEnquiries([enquiryId], staffId);
}

/** Admin: assign (or unassign, with null) several enquiries at once. */
export async function bulkAssignEnquiries(
  enquiryIds: string[],
  staffId: string | null
): Promise<{ error?: string; count?: number }> {
  const adminCheck = await requireAdmin();
  if (adminCheck.error) return { error: adminCheck.error };

  const ids = Array.from(new Set((enquiryIds ?? []).filter((id) => UUID_RE.test(id))));
  if (ids.length === 0) return { error: 'Select at least one enquiry.' };
  if (ids.length > 500) return { error: 'You can assign up to 500 enquiries at a time.' };

  let staffName = 'Unassigned';
  if (staffId) {
    if (!UUID_RE.test(staffId)) return { error: 'Choose a valid employee.' };
    const [staff] = await loadActiveStaff([staffId]);
    if (!staff) return { error: 'That employee was not found or is no longer active.' };
    staffName = staff.full_name;
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from('enquiries')
    .update({ assigned_staff: staffId })
    .in('id', ids)
    .or('is_deleted.is.null,is_deleted.eq.false')
    .select('id');

  if (error) return { error: 'Could not assign the selected enquiries.' };

  const updatedIds = (updated ?? []).map((r) => r.id as string);
  if (updatedIds.length > 0) {
    await supabase.from('enquiry_activities').insert(
      updatedIds.map((id) => ({
        enquiry_id: id,
        activity_type: 'assigned',
        description: staffId ? `Assigned to ${staffName}` : 'Unassigned',
        metadata: { staff_id: staffId },
        performed_by: adminCheck.profile!.id,
      }))
    );
  }

  updatedIds.forEach((id) => revalidatePath(`${ENQUIRIES_PATH}/${id}`));
  revalidatePath(ENQUIRIES_PATH);
  return { count: updatedIds.length };
}

/**
 * Changes the status of several enquiries at once. Admins can change any
 * enquiry; employees only the ones assigned to them.
 */
export async function bulkUpdateEnquiryStatus(
  enquiryIds: string[],
  status: EnquiryStatus
): Promise<{ error?: string; count?: number; skipped?: number }> {
  if (!ENQUIRY_STATUS_VALUES.includes(status)) return { error: 'Unknown status.' };
  const permCheck = await checkEnquiryEditPermission();
  if (permCheck.error) return { error: permCheck.error };
  const profile = permCheck.profile!;

  const ids = Array.from(new Set((enquiryIds ?? []).filter((id) => UUID_RE.test(id))));
  if (ids.length === 0) return { error: 'Select at least one enquiry.' };
  if (ids.length > 500) return { error: 'You can update up to 500 enquiries at a time.' };

  const supabase = await createClient();
  let query = supabase.from('enquiries').select('id, status').in('id', ids).or('is_deleted.is.null,is_deleted.eq.false');
  if (!isAdminProfile(profile)) query = query.eq('assigned_staff', profile.id);
  const { data: rows, error: readError } = await query;
  if (readError) return { error: 'Could not update the selected enquiries.' };

  const toChange = (rows ?? []).filter((r: any) => normalizeEnquiryStatus(r.status) !== status || r.status !== status);
  if (toChange.length === 0) return { count: 0, skipped: ids.length - (rows ?? []).length };

  const { error } = await supabase
    .from('enquiries')
    .update({ status, last_contacted_at: new Date().toISOString() })
    .in('id', toChange.map((r: any) => r.id));
  if (error) return { error: 'Could not update the selected enquiries.' };

  await supabase.from('enquiry_activities').insert(
    toChange.map((r: any) => ({
      enquiry_id: r.id,
      activity_type: 'status_changed',
      description: `Status changed from ${enquiryStatusLabel(r.status)} to ${enquiryStatusLabel(status)}`,
      metadata: { from_status: r.status, to_status: status, bulk: true },
      performed_by: profile.id,
    }))
  );

  toChange.forEach((r: any) => revalidatePath(`${ENQUIRIES_PATH}/${r.id}`));
  revalidatePath(ENQUIRIES_PATH);
  revalidatePath('/travinco_dashboard');
  return { count: toChange.length, skipped: ids.length - (rows ?? []).length };
}

/** Admin: soft-delete several enquiries at once. */
export async function bulkDeleteEnquiries(enquiryIds: string[]): Promise<{ error?: string; count?: number }> {
  const profile = await requireProfile();
  if (!isAdminProfile(profile)) return { error: 'Only admins can delete enquiries.' };

  const ids = Array.from(new Set((enquiryIds ?? []).filter((id) => UUID_RE.test(id))));
  if (ids.length === 0) return { error: 'Select at least one enquiry.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('enquiries')
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: profile.id } as any)
    .in('id', ids);

  if (error) return { error: 'Could not delete the selected enquiries.' };

  await supabase.from('enquiry_activities').insert(
    ids.map((id) => ({ enquiry_id: id, activity_type: 'deleted', description: 'Enquiry deleted', performed_by: profile.id }))
  );

  revalidatePath(ENQUIRIES_PATH);
  return { count: ids.length };
}

/** Rejects numbers whose national part is only zeros (e.g. +91 0000000000). */
function isAllZeroPhone(value: string): boolean {
  const national = parsePhoneNumberFromString(value)?.nationalNumber ?? value.replace(/^\+\d{1,3}/, '');
  const digits = national.replace(/\D/g, '');
  return digits.length > 0 && /^0+$/.test(digits);
}

const phoneField = z
  .string()
  .min(4, 'Enter a valid phone number')
  .max(20)
  .refine((v) => !isAllZeroPhone(v), 'Phone number cannot be all zeros');

const isoDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
  .optional()
  .or(z.literal(''));

const editEnquirySchema = z.object({
  customer_name: z.string().trim().min(2, 'Please enter a name').max(120),
  // Phone and email come from the customer and are read-only in the dashboard
  whatsapp_number: phoneField.optional().or(z.literal('')),
  destination: z.string().max(120).optional().or(z.literal('')),
  travel_date: isoDateField,
  return_date: isoDateField,
  enquiry_date: isoDateField,
  enquiry_received_from: z.string().trim().max(100).optional().or(z.literal('')),
  number_of_days: z.coerce.number().int().min(1).max(365).optional(),
  number_of_adults: z.coerce.number().int().min(1),
  number_of_children: z.coerce.number().int().min(0),
  number_of_infants: z.coerce.number().int().min(0),
  budget: z.coerce.number().min(0, 'Budget cannot be negative').optional(),
  message: z.string().max(2000).optional().or(z.literal('')),
});

/**
 * Lets staff correct/update the customer-submitted details on an
 * enquiry — e.g. the customer calls to change their travel dates or
 * headcount after submitting. Distinct from updateEnquiryStatus/
 * updateEnquiryPriority above, which only touch the internal
 * workflow fields, not what the customer actually asked for.
 */
export async function updateEnquiryDetails(enquiryId: string, raw: unknown) {
  const permCheck = await checkEnquiryEditPermission(enquiryId);
  if (permCheck.error) return { error: permCheck.error };
  const parsed = editEnquirySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0];
    return { error: field ? `${field}: ${issue.message}` : issue?.message ?? 'Please check the form.' };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from('enquiries')
    .select('message, travel_date, enquiry_date')
    .eq('id', enquiryId)
    .maybeSingle();

  // Date rules. The 1-year travel window only applies when the date is being
  // changed, so imported enquiries with a later trip can still be edited.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1); // one day of slack for timezone differences
  const tomorrowIso = toIsoDate(tomorrow);
  if (v.travel_date && v.travel_date !== current?.travel_date && v.travel_date > addYearsIso(tomorrowIso, 1)) {
    return { error: 'travel_date: Travel date must be within 1 year from today' };
  }
  if (v.travel_date && v.return_date) {
    if (v.return_date < v.travel_date) {
      return { error: 'return_date: Return date cannot be before the travel date' };
    }
    if (v.return_date > addYearsIso(v.travel_date, 1)) {
      return { error: 'return_date: Return date must be within 1 year of the travel date' };
    }
  }
  if (v.enquiry_date && v.enquiry_date > tomorrowIso) {
    return { error: 'enquiry_date: Enquiry date cannot be in the future' };
  }

  // Staff see the message with inappropriate words masked. If they saved it unchanged,
  // keep the original text instead of overwriting it with the asterisks.
  let message = v.message || null;
  if (message && current?.message && maskBadWords(current.message).trim() === message.trim()) {
    message = current.message;
  }

  const { error } = await supabase
    .from('enquiries')
    .update({
      customer_name: v.customer_name,
      whatsapp_number: v.whatsapp_number || null,
      destination: v.destination || null,
      travel_date: v.travel_date || null,
      return_date: v.return_date || null,
      ...(v.enquiry_date ? { enquiry_date: v.enquiry_date } : {}),
      enquiry_received_from: v.enquiry_received_from || null,
      number_of_days: v.number_of_days ?? null,
      number_of_adults: v.number_of_adults,
      number_of_children: v.number_of_children,
      number_of_infants: v.number_of_infants,
      budget: v.budget ?? null,
      message,
    })
    .eq('id', enquiryId);

  if (error) return { error: 'Could not update enquiry details.' };

  await logEnquiryActivity(enquiryId, 'details_edited', 'Trip details updated by staff');

  revalidatePath(`${ENQUIRIES_PATH}/${enquiryId}`);
  revalidatePath(ENQUIRIES_PATH);
  return {};
}

export async function updateEnquiryPriority(
  enquiryId: string,
  priority: 'low' | 'medium' | 'high' | 'urgent'
) {
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) return { error: 'Unknown priority.' };
  const permCheck = await checkEnquiryEditPermission(enquiryId);
  if (permCheck.error) return { error: permCheck.error };
  const supabase = await createClient();
  const { error } = await supabase.from('enquiries').update({ priority }).eq('id', enquiryId);
  if (error) return { error: 'Could not update priority.' };
  await logEnquiryActivity(enquiryId, 'priority_changed', `Priority changed to ${priority}`);
  revalidatePath(`${ENQUIRIES_PATH}/${enquiryId}`);
  revalidatePath(ENQUIRIES_PATH);
  return {};
}

export async function updateEnquiryFollowupDate(
  enquiryId: string,
  followupDate: string | null
): Promise<{ error?: string }> {
  const permCheck = await checkEnquiryEditPermission(enquiryId);
  if (permCheck.error) return { error: permCheck.error };

  if (followupDate) {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(followupDate)) {
      return { error: 'Enter a valid follow-up date.' };
    }
    if (followupDate < todayStr) {
      return { error: 'Next follow-up date cannot be in the past.' };
    }
    if (followupDate > addYearsIso(todayStr, 1)) {
      return { error: 'Next follow-up date must be within 1 year from today.' };
    }
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('enquiries')
    .update({ next_followup_date: followupDate || null })
    .eq('id', enquiryId);

  if (error) return { error: 'Could not update follow-up date.' };

  await logEnquiryActivity(
    enquiryId,
    'followup_date_updated',
    followupDate ? `Follow-up date set to ${followupDate}` : 'Follow-up date cleared',
    { next_followup_date: followupDate },
    permCheck.profile?.id
  );

  revalidatePath(`${ENQUIRIES_PATH}/${enquiryId}`);
  revalidatePath(ENQUIRIES_PATH);
  return {};
}

const noteSchema = z.object({ note: z.string().trim().min(1, 'Note cannot be empty').max(2000, 'Note is too long (max 2000 characters)') });

export async function addEnquiryNote(enquiryId: string, raw: unknown) {
  const permCheck = await checkEnquiryEditPermission(enquiryId);
  if (permCheck.error) return { error: permCheck.error };
  const parsed = noteSchema.safeParse(raw);
  if (!parsed.success) return { error: 'Note cannot be empty.' };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('enquiries')
    .select('notes')
    .eq('id', enquiryId)
    .single();

  const timestamp = new Date().toLocaleString('en-IN');
  const combined = existing?.notes
    ? `${existing.notes}\n\n[${timestamp}] ${parsed.data.note}`
    : `[${timestamp}] ${parsed.data.note}`;

  const { error } = await supabase
    .from('enquiries')
    .update({ notes: combined })
    .eq('id', enquiryId);

  if (error) return { error: 'Could not save note.' };

  await logEnquiryActivity(enquiryId, 'note_added', parsed.data.note);

  revalidatePath(`${ENQUIRIES_PATH}/${enquiryId}`);
  revalidatePath(ENQUIRIES_PATH);
  return {};
}

const followupSchema = z.object({
  followup_date: z.string().min(1, 'Date is required'),
  followup_time: z.string().optional().or(z.literal('')),
  followup_type: z.enum(['call', 'whatsapp', 'email', 'meeting', 'other']),
  note: z.string().max(1000).optional().or(z.literal('')),
});

export async function scheduleFollowup(enquiryId: string, raw: unknown) {
  const permCheck = await checkEnquiryEditPermission(enquiryId);
  if (permCheck.error) return { error: permCheck.error };
  const parsed = followupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid follow-up.' };

  const todayStr = new Date().toISOString().slice(0, 10);
  if (parsed.data.followup_date < todayStr) {
    return { error: 'Follow-up date cannot be in the past.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('enquiry_followups').insert({
    enquiry_id: enquiryId,
    followup_date: parsed.data.followup_date,
    followup_time: parsed.data.followup_time || null,
    followup_type: parsed.data.followup_type as FollowupType,
    note: parsed.data.note || null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: 'Could not schedule follow-up.' };

  await supabase
    .from('enquiries')
    .update({ next_followup_date: parsed.data.followup_date, status: 'follow_up' })
    .eq('id', enquiryId);

  await logEnquiryActivity(
    enquiryId,
    'followup_scheduled',
    `Follow-up scheduled for ${parsed.data.followup_date}`
  );

  revalidatePath(`${ENQUIRIES_PATH}/${enquiryId}`);
  revalidatePath(ENQUIRIES_PATH);
  return {};
}

export async function completeFollowup(enquiryId: string, followupId: string) {
  const permCheck = await checkEnquiryEditPermission(enquiryId);
  if (permCheck.error) return { error: permCheck.error };
  const supabase = await createClient();

  const { error } = await supabase
    .from('enquiry_followups')
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq('id', followupId)
    .eq('enquiry_id', enquiryId);

  if (error) return { error: 'Could not mark follow-up complete.' };

  await logEnquiryActivity(enquiryId, 'followup_completed', 'Follow-up marked complete');
  revalidatePath(`${ENQUIRIES_PATH}/${enquiryId}`);
  revalidatePath(ENQUIRIES_PATH);
  return {};
}

/**
 * Converts an enquiry into a customer (creating one if the enquiry isn't
 * linked to an existing customer yet) and a booking in one step, per your
 * "convert enquiry into booking" requirement. Returns the new booking id
 * so the caller can redirect straight to it for the admin to fill in
 * pricing/dates.
 */
export async function convertEnquiryToBooking(
  enquiryId: string,
  overrides?: { baseAmount?: number; discountAmount?: number }
) {
  const permCheck = await checkEnquiryEditPermission(enquiryId);
  if (permCheck.error) return { error: permCheck.error };
  const supabase = await createClient();

  const { data: enquiry, error: fetchError } = await supabase
    .from('enquiries')
    .select('*')
    .eq('id', enquiryId)
    .single();

  if (fetchError || !enquiry) return { error: 'Enquiry not found.' };
  if (!enquiry.package_id) {
    return { error: 'This enquiry has no linked package. Link a package before converting.' };
  }

  let customerId = enquiry.customer_id;

  if (!customerId) {
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', enquiry.phone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          full_name: enquiry.customer_name,
          phone: enquiry.phone,
          whatsapp_number: enquiry.whatsapp_number,
          email: enquiry.email,
          source: enquiry.source === 'website' ? 'website' : 'other',
        })
        .select('id')
        .single();

      if (customerError || !newCustomer) return { error: 'Could not create customer record.' };
      customerId = newCustomer.id;
    }

    await supabase.from('enquiries').update({ customer_id: customerId }).eq('id', enquiryId);
  }

  const { data: pkg } = await supabase
    .from('travel_packages')
    .select('base_price, discount_price, duration_days')
    .eq('id', enquiry.package_id)
    .single();

  const travelStart = enquiry.travel_date ?? new Date().toISOString().slice(0, 10);
  const travelEnd = enquiry.return_date ?? travelStart;
  const unitPrice = pkg?.discount_price ?? pkg?.base_price ?? 0;
  const paxCount = enquiry.number_of_adults + enquiry.number_of_children;
  const computedAmount = unitPrice * Math.max(paxCount, 1);
  // Staff can review/adjust the total and apply a discount on the
  // "Convert to booking" screen before this runs — overrides.baseAmount
  // replaces the auto-computed figure entirely when provided, rather
  // than being added on top of it.
  const finalBaseAmount = overrides?.baseAmount ?? computedAmount;
  const discountAmount = Math.max(0, overrides?.discountAmount ?? 0);

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      enquiry_id: enquiryId,
      customer_id: customerId,
      package_id: enquiry.package_id,
      travel_start_date: travelStart,
      travel_end_date: travelEnd,
      // bookings.number_of_adults has a `>= 1` check constraint. Most
      // enquiries are created through validation that already enforces
      // this, but older rows (or any other insert path) could still
      // have 0 here — this floor keeps a bad historical value from
      // making the whole conversion fail.
      number_of_adults: Math.max(enquiry.number_of_adults, 1),
      number_of_children: enquiry.number_of_children,
      number_of_infants: enquiry.number_of_infants,
      base_amount: finalBaseAmount,
      discount_amount: discountAmount,
      booking_status: 'inquiry',
    })
    .select('id')
    .single();

  if (bookingError) {
    console.error('convertEnquiryToBooking insert failed:', bookingError);
    return { error: bookingError.message || 'Could not create booking.' };
  }
  if (!booking) return { error: 'Could not create booking.' };

  await supabase.from('enquiries').update({ status: 'converted' }).eq('id', enquiryId);

  await logEnquiryActivity(enquiryId, 'converted_to_booking', 'Converted to a booking', {
    booking_id: booking.id,
  });

  // Best-effort — a customer's booking confirmation succeeding should
  // never depend on the email actually going out, so failures here are
  // swallowed rather than surfaced as an error on the conversion itself.
  if (enquiry.email) {
    try {
      const { sendGmail, isGmailConfigured } = await import('@/lib/email/gmail');
      if (isGmailConfigured()) {
        const trackUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/account/bookings`;
        await sendGmail({
          to: enquiry.email,
          subject: 'Your booking has been confirmed',
          html: `<p>Hi ${enquiry.customer_name},</p><p>Your enquiry has been confirmed as a booking. You can track its status any time by logging in to <a href="${trackUrl}">your account</a>.</p><p>We'll be in touch with next steps shortly.</p>`,
        });
      }
    } catch {
      // Swallowed intentionally — see comment above.
    }
  }

  revalidatePath(ENQUIRIES_PATH);
  revalidatePath('/travinco_dashboard/bookings');
  return { bookingId: booking.id };
}

export async function deleteEnquiry(enquiryId: string) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'enquiries', 'edit');
  if (!perm.allowed || !isAdminProfile(profile)) {
    return { error: perm.error || 'Only admins can delete enquiries.' };
  }

  const supabase = await createClient();

  // 1. Try security-definer RPC function first
  const { error: rpcError } = await supabase.rpc('soft_delete_enquiry', {
    enquiry_id: enquiryId,
    admin_id: profile.id,
  });

  // 2. Fallback to direct update if RPC is pending migration
  if (rpcError) {
    const { error: updateError } = await supabase
      .from('enquiries')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: profile.id,
      } as any)
      .eq('id', enquiryId);

    if (updateError) {
      console.error('deleteEnquiry failed:', updateError.message);
      return { error: updateError.message || 'Could not delete this enquiry.' };
    }
  }

  await logEnquiryActivity(enquiryId, 'deleted', 'Enquiry deleted');

  revalidatePath(ENQUIRIES_PATH);
  return {};
}

// ─── Excel upload ───────────────────────────────────────────────────────────

const IMPORT_COLUMN_KEYS = new Set<string>(IMPORT_COLUMNS.map((c) => c.key));

export interface ImportRowIssue {
  rowNumber: number;
  messages: string[];
}

export interface ImportEnquiriesResult {
  error?: string;
  imported?: number;
  enquiryNumbers?: string[];
  failed?: ImportRowIssue[];
  duplicates?: ImportRowIssue[];
  warnings?: ImportRowIssue[];
}

/** Keeps only known columns and plain cell values from the browser payload. */
function sanitizeRawRows(input: unknown): RawImportRow[] | null {
  if (!Array.isArray(input)) return null;
  const rows: RawImportRow[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') return null;
    const { rowNumber, cells } = item as { rowNumber?: unknown; cells?: unknown };
    if (typeof rowNumber !== 'number' || !Number.isInteger(rowNumber) || rowNumber < 1) return null;
    if (!cells || typeof cells !== 'object') return null;
    const clean: RawImportCells = {};
    for (const [key, value] of Object.entries(cells as Record<string, unknown>)) {
      if (!IMPORT_COLUMN_KEYS.has(key)) continue;
      if (value === null || typeof value === 'number' || typeof value === 'boolean') {
        clean[key as ImportColumnKey] = value as number | boolean | null;
      } else if (typeof value === 'string') {
        clean[key as ImportColumnKey] = value.slice(0, 500);
      }
    }
    rows.push({ rowNumber, cells: clean });
  }
  return rows;
}

/**
 * Saves the rows of an uploaded Excel sheet as enquiries. Every row is
 * validated again here with the same rules as the upload preview. Rows that
 * fail, or that are already in the system, are skipped and reported back.
 * New rows start as "New lead" with a priority from their travel date.
 * Employees' uploads are assigned to themselves (they only see their own).
 */
export async function importEnquiries(payload: {
  rows: unknown;
  date1904?: boolean;
  fileName?: string;
}): Promise<ImportEnquiriesResult> {
  const permCheck = await checkEnquiryEditPermission();
  if (permCheck.error) return { error: permCheck.error };
  const profile = permCheck.profile!;

  const rawRows = sanitizeRawRows(payload?.rows);
  if (!rawRows) return { error: 'The uploaded data could not be read. Please upload the file again.' };
  if (rawRows.length === 0) return { error: 'The sheet has no enquiry rows to import.' };
  if (rawRows.length > MAX_IMPORT_ROWS) {
    return { error: `A sheet can have up to ${MAX_IMPORT_ROWS} rows. Split the file and upload each part.` };
  }

  const today = todayInIndia();
  const normalized = rawRows.map((r) => normalizeImportRow(r, { date1904: Boolean(payload.date1904), today }));

  const failed: ImportRowIssue[] = normalized
    .filter((r) => !r.record)
    .map((r) => ({ rowNumber: r.rowNumber, messages: r.errors }));
  const warnings: ImportRowIssue[] = normalized
    .filter((r) => r.record && r.warnings.length > 0)
    .map((r) => ({ rowNumber: r.rowNumber, messages: r.warnings }));

  const duplicates: ImportRowIssue[] = [];
  const inFileRepeats = findInFileDuplicates(normalized);
  inFileRepeats.forEach((first, rowNumber) =>
    duplicates.push({ rowNumber, messages: [`Same customer, date and package as row ${first}`] })
  );

  let candidates = normalized.filter((r) => r.record && !inFileRepeats.has(r.rowNumber));

  // Already in the system (same phone, enquiry date and package)?
  const supabase = await createClient();
  const phones = Array.from(new Set(candidates.map((r) => r.record!.phone)));
  const existingKeys = new Set<string>();
  for (let i = 0; i < phones.length; i += 200) {
    const { data, error } = await supabase
      .from('enquiries')
      .select('phone, enquiry_date, destination')
      .in('phone', phones.slice(i, i + 200))
      .or('is_deleted.is.null,is_deleted.eq.false');
    if (error) {
      console.error('importEnquiries duplicate check failed:', error.message);
      return { error: 'Could not check for existing enquiries. Has the enquiries migration been run?' };
    }
    (data ?? []).forEach((e: any) => existingKeys.add(importDuplicateKey(e)));
  }
  candidates = candidates.filter((r) => {
    if (!existingKeys.has(importDuplicateKey(r.record!))) return true;
    duplicates.push({ rowNumber: r.rowNumber, messages: ['Already in Enquiries (same customer, date and package)'] });
    return false;
  });
  duplicates.sort((a, b) => a.rowNumber - b.rowNumber);

  if (candidates.length === 0) {
    return { imported: 0, enquiryNumbers: [], failed, duplicates, warnings };
  }

  const batchId = crypto.randomUUID();
  const assignedTo = isAdminProfile(profile) ? null : profile.id;
  const insertRows = candidates.map(({ record }) => ({
    ...record!,
    source: 'excel_import' as const,
    status: 'new' as const,
    priority: computePriorityFromTravelDate(record!.travel_date),
    assigned_staff: assignedTo,
    import_batch: batchId,
    imported_by: profile.id,
    is_deleted: false,
  }));

  const inserted: { id: string; enquiry_number: string }[] = [];
  for (let i = 0; i < insertRows.length; i += 500) {
    const { data, error } = await supabase
      .from('enquiries')
      .insert(insertRows.slice(i, i + 500))
      .select('id, enquiry_number');
    if (error) {
      console.error('importEnquiries insert failed:', error.message);
      // Undo the part of this upload that was already saved, so a retry does not create duplicates
      if (inserted.length > 0) {
        await supabase
          .from('enquiries')
          .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: profile.id } as any)
          .eq('import_batch', batchId);
      }
      return { error: 'The enquiries could not be saved. Nothing from this file was imported. Please try again.' };
    }
    inserted.push(...((data ?? []) as { id: string; enquiry_number: string }[]));
  }

  const fileLabel = payload.fileName ? String(payload.fileName).slice(0, 120) : 'Excel sheet';
  for (let i = 0; i < inserted.length; i += 500) {
    await supabase.from('enquiry_activities').insert(
      inserted.slice(i, i + 500).map((e) => ({
        enquiry_id: e.id,
        activity_type: 'imported',
        description: `Imported from ${fileLabel}`,
        metadata: { import_batch: batchId },
        performed_by: profile.id,
      }))
    );
  }

  revalidatePath(ENQUIRIES_PATH);
  revalidatePath('/travinco_dashboard');
  return {
    imported: inserted.length,
    enquiryNumbers: inserted.map((e) => e.enquiry_number),
    failed,
    duplicates,
    warnings,
  };
}

// ─── Table list ─────────────────────────────────────────────────────────────

export interface EnquiryTableItem {
  id: string;
  enquiry_number: string;
  customer_name: string;
  phone: string;
  destination: string | null;
  travel_date: string | null;
  status: EnquiryStatus;
  priority: string;
  source: string | null;
  enquiry_received_from: string | null;
  next_followup_date: string | null;
  assigned_staff: string | null;
  assigned_staff_name: string;
  enquiry_date: string;
  created_at: string;
}

export interface EnquiriesTableQueryResult {
  enquiries: EnquiryTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export interface EnquiryTabCounts {
  allCount: number;
  todayCount: number;
  overdueCount: number;
}

const LIST_COLUMNS =
  'id, enquiry_number, customer_name, phone, destination, travel_date, status, priority, source, enquiry_received_from, next_followup_date, enquiry_date, created_at, is_deleted, assigned_staff';
const LEGACY_LIST_COLUMNS =
  'id, enquiry_number, customer_name, phone, destination, travel_date, status, priority, source, next_followup_date, created_at, is_deleted, assigned_staff';

/** Old status values each new status replaced ('booked' left out: it may not exist in the enum). */
const LEGACY_STATUSES_FOR: Partial<Record<EnquiryStatus, string[]>> = {
  follow_up: ['contacted', 'negotiation', 'quotation_sent'],
  converted: ['confirmed'],
  lost: ['closed'],
};

/** Postgres "undefined column" (42703) / PostgREST schema-cache miss. */
function isMissingColumnError(error: { code?: string; message?: string }) {
  return error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|enquiry_date|enquiry_received_from/i.test(error.message ?? '');
}

/** Search text is placed inside a PostgREST or() filter, where , ( ) are syntax. */
function sanitizeSearch(term: string) {
  return term.replace(/[,()*\\%]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

/** Non-admin staff only ever see the enquiries assigned to them. */
function scopeToProfile<Q>(query: Q, profile: CurrentProfile): Q {
  return isAdminProfile(profile) ? query : (query as any).eq('assigned_staff', profile.id);
}

/**
 * Fast, lean query fetching strictly the table columns:
 * Enquiry #, Customer, Destination/Travel, Status, Priority, Follow-up, Assigned, Date.
 * Excludes heavy requirement notes, preferences, budget, package pricing, etc.
 */
export async function getEnquiriesTableList({
  page = 1,
  pageSize = 20,
  q = '',
  status = '',
  priority = '',
  view = '',
  assigned = '',
  from: dateFrom = '',
  to: dateTo = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  priority?: string;
  view?: string;
  /** Admin filter: '' (everyone), 'unassigned', or a staff id. */
  assigned?: string;
  /** Enquiry Date range, YYYY-MM-DD (inclusive). */
  from?: string;
  to?: string;
} = {}): Promise<EnquiriesTableQueryResult> {
  const profile = await requireProfile();
  const size = Math.min(100, Math.max(1, pageSize));
  const currentPage = Math.max(1, page);
  const empty = { enquiries: [], totalCount: 0, totalPages: 1, page: currentPage, pageSize: size };

  const perm = await checkModulePermission(profile, 'enquiries', 'view');
  if (!perm.allowed) return empty;

  const supabase = await createClient();

  const from = (currentPage - 1) * size;
  const to = from + size - 1;
  const today = new Date().toISOString().slice(0, 10);

  // `legacy` = the columns that exist before supabase/enquiries_merge_02_schema.sql
  // is run, so the list still loads (sorted by created date) on a database
  // that has not been migrated yet.
  const buildQuery = (legacy: boolean) => {
    let query = supabase
      .from('enquiries')
      .select(legacy ? LEGACY_LIST_COLUMNS : LIST_COLUMNS, { count: 'exact' })
      .or('is_deleted.is.null,is_deleted.eq.false');
    query = legacy
      ? query.order('created_at', { ascending: false })
      : query.order('enquiry_date', { ascending: false }).order('created_at', { ascending: false });

    query = scopeToProfile(query, profile);

    const term = sanitizeSearch(q);
    if (term) {
      query = query.or(
        `customer_name.ilike.%${term}%,phone.ilike.%${term}%,enquiry_number.ilike.%${term}%,email.ilike.%${term}%,destination.ilike.%${term}%`
      );
    }

    if (status) {
      const s = normalizeEnquiryStatus(status === 'pending' ? 'new' : status);
      // Rows not yet moved to the new pipeline by the migration still match their new status
      query = query.in('status', [s, ...(LEGACY_STATUSES_FOR[s] ?? [])]);
    }

    if (priority && ['urgent', 'high', 'medium', 'low'].includes(priority)) {
      query = query.eq('priority', priority);
    }

    if (isAdminProfile(profile) && assigned) {
      if (assigned === 'unassigned') query = query.is('assigned_staff', null);
      else if (UUID_RE.test(assigned)) query = query.eq('assigned_staff', assigned);
    }

    if (view === 'followup_today') {
      query = query.eq('next_followup_date', today);
    } else if (view === 'overdue') {
      query = query.lt('next_followup_date', today).not('status', 'in', RESOLVED_FILTER);
    }

    if (ISO_DATE_RE.test(dateFrom)) {
      query = legacy ? query.gte('created_at', `${dateFrom}T00:00:00+05:30`) : query.gte('enquiry_date', dateFrom);
    }
    if (ISO_DATE_RE.test(dateTo)) {
      query = legacy ? query.lte('created_at', `${dateTo}T23:59:59.999+05:30`) : query.lte('enquiry_date', dateTo);
    }
    return query.range(from, to);
  };

  const [first, { data: staffList }] = await Promise.all([
    buildQuery(false),
    supabase.from('profiles').select('id, full_name'),
  ]);
  let { data: enquiries, count, error } = first;
  if (error && isMissingColumnError(error)) {
    console.warn('Enquiries list: new columns missing, run supabase/enquiries_merge_02_schema.sql');
    ({ data: enquiries, count, error } = await buildQuery(true));
  }

  if (error) {
    console.error('Error fetching enquiries table list:', error.message);
  }

  const staffMap = new Map((staffList ?? []).map((s) => [s.id, s.full_name]));
  const visibleRows = (enquiries ?? []).filter((e: any) => e.is_deleted !== true);

  const items: EnquiryTableItem[] = visibleRows.map((e: any) => ({
    id: e.id,
    enquiry_number: e.enquiry_number,
    customer_name: e.customer_name,
    phone: e.phone,
    destination: e.destination || null,
    travel_date: e.travel_date || null,
    status: normalizeEnquiryStatus(e.status),
    priority: e.priority,
    source: e.source ?? null,
    enquiry_received_from: e.enquiry_received_from ?? null,
    next_followup_date: e.next_followup_date || null,
    assigned_staff: e.assigned_staff || null,
    assigned_staff_name: e.assigned_staff ? staffMap.get(e.assigned_staff) ?? 'Staff' : 'Unassigned',
    enquiry_date: e.enquiry_date ?? String(e.created_at).slice(0, 10),
    created_at: e.created_at,
  }));

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / size));

  return {
    enquiries: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize: size,
  };
}

/**
 * Fetch tab counts (All, Follow-up Today, Overdue)
 */
export async function getEnquiryTabCounts(): Promise<EnquiryTabCounts> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'enquiries', 'view');
  if (!perm.allowed) return { allCount: 0, todayCount: 0, overdueCount: 0 };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const base = () =>
    scopeToProfile(
      supabase
        .from('enquiries')
        .select('*', { count: 'exact', head: true })
        .or('is_deleted.is.null,is_deleted.eq.false'),
      profile
    );

  const [{ count: allCount }, { count: todayCount }, { count: overdueCount }] = await Promise.all([
    base(),
    base().eq('next_followup_date', today),
    base().lt('next_followup_date', today).not('status', 'in', RESOLVED_FILTER),
  ]);

  return {
    allCount: allCount ?? 0,
    todayCount: todayCount ?? 0,
    overdueCount: overdueCount ?? 0,
  };
}

// ─── Clear Data: archive enquiries in a date range to Google Sheets, then delete ─
const ENQUIRIES_SHEET_HEADERS = [
  'ID', 'Enquiry #', 'Enquiry Date', 'Enquiry Received From', 'Customer Name', 'Phone', 'WhatsApp', 'Email',
  'Destination', 'Travel Date', 'Return Date', 'Days', 'Adults', 'Children', 'Infants', 'Budget', 'Message',
  'Source', 'Status', 'Priority', 'Assigned Staff', 'Last Contacted', 'Next Follow-up',
  'Notes', 'Created At', 'Cleared At', 'Cleared By',
];


function validateRange(range: { from?: string; to?: string } | undefined): { from: string; to: string } | string {
  const from = range?.from ?? '';
  const to = range?.to ?? '';
  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) return 'Choose both a From date and a To date.';
  if (from > to) return 'The From date must be on or before the To date.';
  return { from, to };
}

/** Clear Data only removes enquiries marked "Deal lost or not interested" ('closed' = legacy value). */
const CLEARABLE_STATUSES = ['lost', 'closed'];

/**
 * Every "Deal lost or not interested" enquiry (including old soft-deleted ones)
 * whose Enquiry Date falls in the range. Uses the created date on a database
 * without enquiry_date.
 */
async function fetchEnquiriesInRange(from: string, to: string) {
  const service = createServiceClient();
  const PAGE = 1000;
  const rows: Record<string, any>[] = [];
  let dateColumn: 'enquiry_date' | 'created_at' = 'enquiry_date';

  for (let offset = 0; ; offset += PAGE) {
    let query = service
      .from('enquiries')
      .select('*')
      .in('status', CLEARABLE_STATUSES)
      .order('id')
      .range(offset, offset + PAGE - 1);
    query =
      dateColumn === 'enquiry_date'
        ? query.gte('enquiry_date', from).lte('enquiry_date', to)
        : query.gte('created_at', `${from}T00:00:00+05:30`).lte('created_at', `${to}T23:59:59.999+05:30`);
    const { data, error } = await query;
    if (error && dateColumn === 'enquiry_date' && offset === 0 && isMissingColumnError(error)) {
      dateColumn = 'created_at';
      offset = -PAGE;
      continue;
    }
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** How many "Deal lost or not interested" enquiries the Clear Data popup would remove for this range. */
export async function countEnquiriesInRange(range: { from?: string; to?: string }): Promise<{ error?: string; count?: number }> {
  const profile = await requireProfile();
  if (!isAdminProfile(profile)) return { error: 'Only admins can clear enquiries data.' };
  const valid = validateRange(range);
  if (typeof valid === 'string') return { error: valid };

  // A normal GET (limit 1) rather than a HEAD request: a HEAD error has no body,
  // so a missing enquiry_date column could not be told apart from other errors.
  const service = createServiceClient();
  let res = await service
    .from('enquiries')
    .select('id', { count: 'exact' })
    .in('status', CLEARABLE_STATUSES)
    .gte('enquiry_date', valid.from)
    .lte('enquiry_date', valid.to)
    .limit(1);
  if (res.error && isMissingColumnError(res.error)) {
    res = await service
      .from('enquiries')
      .select('id', { count: 'exact' })
      .in('status', CLEARABLE_STATUSES)
      .gte('created_at', `${valid.from}T00:00:00+05:30`)
      .lte('created_at', `${valid.to}T23:59:59.999+05:30`)
      .limit(1);
  }
  if (res.error) console.error('countEnquiriesInRange failed:', res.error);
  if (res.error) return { error: 'Could not count the enquiries. Please try again.' };
  return { count: res.count ?? 0 };
}

/**
 * Saves every "Deal lost or not interested" enquiry with an Enquiry Date between
 * `from` and `to` (inclusive) to the Google Sheet "Enquiries" tab, then deletes
 * them from the database
 * together with their activity log and follow-ups. Nothing is deleted if the
 * sheet could not be written.
 */
export async function clearAndArchiveEnquiries(range: {
  from?: string;
  to?: string;
}): Promise<{ error?: string; count?: number }> {
  const profile = await requireProfile();
  if (!isAdminProfile(profile)) {
    return { error: 'Only admins can clear enquiries data.' };
  }
  const valid = validateRange(range);
  if (typeof valid === 'string') return { error: valid };

  let enquiries: Record<string, any>[];
  try {
    enquiries = await fetchEnquiriesInRange(valid.from, valid.to);
  } catch (err) {
    console.error('clearAndArchiveEnquiries fetch failed:', err);
    return { error: 'Could not load the enquiries to clear. Please try again.' };
  }
  if (enquiries.length === 0) return { count: 0 };

  // Resolve assigned staff names for readability in the sheet
  const staffIds = Array.from(new Set(enquiries.map((e) => e.assigned_staff).filter(Boolean)));
  const staffNames = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: staff } = await createServiceClient().from('profiles').select('id, full_name').in('id', staffIds);
    (staff ?? []).forEach((s: any) => staffNames.set(s.id, s.full_name));
  }

  const clearedAt = new Date().toISOString();
  const clearedBy = profile.full_name || profile.email;
  const rows = enquiries.map((e) => [
    e.id, e.enquiry_number, e.enquiry_date ?? String(e.created_at).slice(0, 10), e.enquiry_received_from ?? null,
    e.customer_name, e.phone, e.whatsapp_number, e.email, e.destination, e.travel_date, e.return_date,
    e.number_of_days ?? null, e.number_of_adults, e.number_of_children, e.number_of_infants, e.budget,
    maskBadWords(e.message), e.source, `${enquiryStatusLabel(e.status)}${e.is_deleted ? ' (deleted earlier)' : ''}`,
    e.priority, e.assigned_staff ? staffNames.get(e.assigned_staff) ?? e.assigned_staff : null,
    e.last_contacted_at, e.next_followup_date, e.notes, e.created_at, clearedAt, clearedBy,
  ]);

  // Only delete once the sheet write has succeeded
  const archiveError = await archiveRows('Enquiries', ENQUIRIES_SHEET_HEADERS, rows);
  if (archiveError) return { error: archiveError };

  const supabase = await createClient();
  let deleted = 0;
  const ids = enquiries.map((e) => e.id as string);
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await supabase.rpc('hard_delete_enquiries', { p_ids: ids.slice(i, i + 500) });
    if (error) {
      revalidatePath(ENQUIRIES_PATH);
      return {
        error: `${deleted > 0 ? `${deleted} enquiries were deleted, then: ` : ''}${hardDeleteErrorMessage(error)}`,
        count: deleted,
      };
    }
    deleted += typeof data === 'number' ? data : Math.min(500, ids.length - i);
  }

  revalidatePath(ENQUIRIES_PATH);
  revalidatePath('/travinco_dashboard');
  return { count: deleted };
}

// ─── Download Report: enquiries in a date range (optionally one status) as Excel rows ─
const REPORT_HEADERS = [
  'Enquiry #', 'Enquiry Date', 'Enquiry Received From', 'Customer Name', 'Phone', 'WhatsApp', 'Email',
  'Destination', 'Travel Date', 'Return Date', 'Days', 'Adults', 'Children', 'Infants', 'Budget', 'Message',
  'Source', 'Status', 'Priority', 'Assigned Staff', 'Last Contacted', 'Next Follow-up', 'Notes', 'Created At',
];

/**
 * Enquiries whose Enquiry Date falls between `from` and `to` (inclusive), for the
 * "Download Report" popup. Staff only get the enquiries assigned to them.
 */
export async function getEnquiryReportRows(params: {
  from?: string;
  to?: string;
  status?: string;
}): Promise<{ error?: string; headers?: string[]; rows?: (string | number | null)[][] }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'enquiries', 'view');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to view enquiries.' };

  const valid = validateRange(params);
  if (typeof valid === 'string') return { error: valid };

  const status = params.status ? normalizeEnquiryStatus(params.status) : null;
  const supabase = await createClient();
  const PAGE = 1000;
  const enquiries: Record<string, any>[] = [];
  let legacy = false;

  for (let offset = 0; ; offset += PAGE) {
    let query = scopeToProfile(
      supabase
        .from('enquiries')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order(legacy ? 'created_at' : 'enquiry_date', { ascending: true })
        .order('id')
        .range(offset, offset + PAGE - 1),
      profile
    );
    query = legacy
      ? query.gte('created_at', `${valid.from}T00:00:00+05:30`).lte('created_at', `${valid.to}T23:59:59.999+05:30`)
      : query.gte('enquiry_date', valid.from).lte('enquiry_date', valid.to);
    if (status) query = query.in('status', [status, ...(LEGACY_STATUSES_FOR[status] ?? [])]);

    const { data, error } = await query;
    if (error && !legacy && offset === 0 && isMissingColumnError(error)) {
      legacy = true;
      offset = -PAGE;
      continue;
    }
    if (error) {
      console.error('getEnquiryReportRows failed:', error);
      return { error: 'Could not load the enquiries. Please try again.' };
    }
    enquiries.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const staffIds = Array.from(new Set(enquiries.map((e) => e.assigned_staff).filter(Boolean)));
  const staffNames = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: staff } = await supabase.from('profiles').select('id, full_name').in('id', staffIds);
    (staff ?? []).forEach((s: any) => staffNames.set(s.id, s.full_name));
  }

  const rows = enquiries.map((e) => [
    e.enquiry_number ?? null, e.enquiry_date ?? String(e.created_at).slice(0, 10), e.enquiry_received_from ?? null,
    e.customer_name ?? null, e.phone ?? null, e.whatsapp_number ?? null, e.email ?? null, e.destination ?? null,
    e.travel_date ?? null, e.return_date ?? null, e.number_of_days ?? null, e.number_of_adults ?? null,
    e.number_of_children ?? null, e.number_of_infants ?? null, e.budget ?? null, maskBadWords(e.message) ?? null,
    e.source ?? null, enquiryStatusLabel(e.status), e.priority ?? null,
    e.assigned_staff ? staffNames.get(e.assigned_staff) ?? 'Staff' : 'Unassigned',
    e.last_contacted_at ?? null, e.next_followup_date ?? null, e.notes ?? null, e.created_at ?? null,
  ]);

  return { headers: REPORT_HEADERS, rows };
}
