'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { revalidatePath } from 'next/cache';
import { hasActiveRows, fetchAllActiveRows, softDeleteRows } from '@/lib/archive-to-sheet';
import { appendRowsToSheet } from '@/lib/google-sheets';
import { createServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { addYearsIso, toIsoDate } from '@/lib/utils/iso-date';
import { maskBadWords } from '@/lib/validations/contact-rules';
import type { EnquiryStatus, FollowupType } from '@/types/database';

async function checkEnquiryEditPermission() {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'enquiries', 'edit');
  if (!perm.allowed) {
    return { error: perm.error || 'You do not have permission to edit enquiries.' };
  }
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
  const permCheck = await checkEnquiryEditPermission();
  if (permCheck.error) return { error: permCheck.error };
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('enquiries')
    .select('status')
    .eq('id', enquiryId)
    .single();

  let { error } = await supabase
    .from('enquiries')
    .update({ status, last_contacted_at: new Date().toISOString() })
    .eq('id', enquiryId);

  // If database enum hasn't had 'booked' added yet, fall back to 'confirmed'
  if (error && status === 'booked' && (error.message?.includes('enquiry_status') || error.message?.includes('enum') || error.message?.includes('invalid input'))) {
    const fallback = await supabase
      .from('enquiries')
      .update({ status: 'confirmed', last_contacted_at: new Date().toISOString() })
      .eq('id', enquiryId);
    error = fallback.error;
  }

  if (error) return { error: 'Could not update status.' };

  await logEnquiryActivity(
    enquiryId,
    'status_changed',
    `Status changed from ${before?.status ?? 'unknown'} to ${status}`,
    { from_status: before?.status, to_status: status }
  );

  revalidatePath(`/travinco_dashboard/enquiries/${enquiryId}`);
  revalidatePath('/travinco_dashboard/enquiries');
  return {};
}

/**
 * Staff-facing accept/reject actions, on top of updateEnquiryStatus.
 * Automated email sending removed per workflow requirements.
 */
export async function acceptEnquiry(enquiryId: string): Promise<{ error?: string }> {
  return updateEnquiryStatus(enquiryId, 'confirmed');
}

export async function rejectEnquiry(enquiryId: string, reason?: string): Promise<{ error?: string }> {
  const result = await updateEnquiryStatus(enquiryId, 'lost');
  if (result.error) return result;

  if (reason?.trim()) {
    await logEnquiryActivity(enquiryId, 'rejected', `Rejected: ${reason.trim()}`);
  }

  return {};
}

export async function assignEnquiry(enquiryId: string, staffId: string | null) {
  const permCheck = await checkEnquiryEditPermission();
  if (permCheck.error) return { error: permCheck.error };
  const supabase = await createClient();

  const { error } = await supabase
    .from('enquiries')
    .update({ assigned_staff: staffId })
    .eq('id', enquiryId);

  if (error) return { error: 'Could not assign staff member.' };

  await logEnquiryActivity(
    enquiryId,
    'assigned',
    staffId ? 'Assigned to a staff member' : 'Unassigned',
    { staff_id: staffId }
  );

  revalidatePath(`/travinco_dashboard/enquiries/${enquiryId}`);
  revalidatePath('/travinco_dashboard/enquiries');
  return {};
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

const editEnquirySchema = z
  .object({
  customer_name: z.string().trim().min(2, 'Please enter a name').max(120),
  // Phone and email come from the customer and are read-only in the dashboard
  whatsapp_number: phoneField.optional().or(z.literal('')),
  destination: z.string().max(120).optional().or(z.literal('')),
  travel_date: z.string().optional().or(z.literal('')),
  return_date: z.string().optional().or(z.literal('')),
  number_of_adults: z.coerce.number().int().min(1),
  number_of_children: z.coerce.number().int().min(0),
  number_of_infants: z.coerce.number().int().min(0),
  budget: z.coerce.number().min(0, 'Budget cannot be negative').optional(),
  message: z.string().max(2000).optional().or(z.literal('')),
})
  .superRefine((v, ctx) => {
    // One day of slack for client/server timezone differences.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const maxDate = addYearsIso(toIsoDate(tomorrow), 1);
    if (v.travel_date && v.travel_date > maxDate) {
      ctx.addIssue({ code: 'custom', path: ['travel_date'], message: 'Travel date must be within 1 year from today' });
    }
    if (v.travel_date && v.return_date) {
      if (v.return_date < v.travel_date) {
        ctx.addIssue({ code: 'custom', path: ['return_date'], message: 'Return date cannot be before the travel date' });
      } else if (v.return_date > addYearsIso(v.travel_date, 1)) {
        ctx.addIssue({ code: 'custom', path: ['return_date'], message: 'Return date must be within 1 year of the travel date' });
      }
    }
  });

/**
 * Lets staff correct/update the customer-submitted details on an
 * enquiry — e.g. the customer calls to change their travel dates or
 * headcount after submitting. Distinct from updateEnquiryStatus/
 * updateEnquiryPriority above, which only touch the internal
 * workflow fields, not what the customer actually asked for.
 */
export async function updateEnquiryDetails(enquiryId: string, raw: unknown) {
  const permCheck = await checkEnquiryEditPermission();
  if (permCheck.error) return { error: permCheck.error };
  const parsed = editEnquirySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0];
    return { error: field ? `${field}: ${issue.message}` : issue?.message ?? 'Please check the form.' };
  }

  const supabase = await createClient();

  // Staff see the message with inappropriate words masked. If they saved it unchanged,
  // keep the original text instead of overwriting it with the asterisks.
  let message = parsed.data.message || null;
  if (message) {
    const { data: current } = await supabase.from('enquiries').select('message').eq('id', enquiryId).maybeSingle();
    if (current?.message && maskBadWords(current.message).trim() === message.trim()) {
      message = current.message;
    }
  }

  const { error } = await supabase
    .from('enquiries')
    .update({
      customer_name: parsed.data.customer_name,
      whatsapp_number: parsed.data.whatsapp_number || null,
      destination: parsed.data.destination || null,
      travel_date: parsed.data.travel_date || null,
      return_date: parsed.data.return_date || null,
      number_of_adults: parsed.data.number_of_adults,
      number_of_children: parsed.data.number_of_children,
      number_of_infants: parsed.data.number_of_infants,
      budget: parsed.data.budget ?? null,
      message,
    })
    .eq('id', enquiryId);

  if (error) return { error: 'Could not update enquiry details.' };

  await logEnquiryActivity(enquiryId, 'details_edited', 'Trip details updated by staff');

  revalidatePath(`/travinco_dashboard/enquiries/${enquiryId}`);
  revalidatePath('/travinco_dashboard/enquiries');
  return {};
}

export async function updateEnquiryPriority(
  enquiryId: string,
  priority: 'low' | 'medium' | 'high' | 'urgent'
) {
  const permCheck = await checkEnquiryEditPermission();
  if (permCheck.error) return { error: permCheck.error };
  const supabase = await createClient();
  const { error } = await supabase.from('enquiries').update({ priority }).eq('id', enquiryId);
  if (error) return { error: 'Could not update priority.' };
  await logEnquiryActivity(enquiryId, 'priority_changed', `Priority changed to ${priority}`);
  revalidatePath(`/travinco_dashboard/enquiries/${enquiryId}`);
  revalidatePath('/travinco_dashboard/enquiries');
  return {};
}

export async function updateEnquiryFollowupDate(
  enquiryId: string,
  followupDate: string | null
): Promise<{ error?: string }> {
  const permCheck = await checkEnquiryEditPermission();
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

  revalidatePath(`/travinco_dashboard/enquiries/${enquiryId}`);
  revalidatePath('/travinco_dashboard/enquiries');
  return {};
}

const noteSchema = z.object({ note: z.string().min(1).max(2000) });

export async function addEnquiryNote(enquiryId: string, raw: unknown) {
  const permCheck = await checkEnquiryEditPermission();
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

  revalidatePath(`/travinco_dashboard/enquiries/${enquiryId}`);
  revalidatePath('/travinco_dashboard/enquiries');
  return {};
}

const followupSchema = z.object({
  followup_date: z.string().min(1, 'Date is required'),
  followup_time: z.string().optional().or(z.literal('')),
  followup_type: z.enum(['call', 'whatsapp', 'email', 'meeting', 'other']),
  note: z.string().max(1000).optional().or(z.literal('')),
});

export async function scheduleFollowup(enquiryId: string, raw: unknown) {
  const permCheck = await checkEnquiryEditPermission();
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

  revalidatePath(`/travinco_dashboard/enquiries/${enquiryId}`);
  revalidatePath('/travinco_dashboard/enquiries');
  return {};
}

export async function completeFollowup(enquiryId: string, followupId: string) {
  const permCheck = await checkEnquiryEditPermission();
  if (permCheck.error) return { error: permCheck.error };
  const supabase = await createClient();

  const { error } = await supabase
    .from('enquiry_followups')
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq('id', followupId);

  if (error) return { error: 'Could not mark follow-up complete.' };

  await logEnquiryActivity(enquiryId, 'followup_completed', 'Follow-up marked complete');
  revalidatePath(`/travinco_dashboard/enquiries/${enquiryId}`);
  revalidatePath('/travinco_dashboard/enquiries');
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
  const permCheck = await checkEnquiryEditPermission();
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

  await supabase.from('enquiries').update({ status: 'confirmed' }).eq('id', enquiryId);

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

  revalidatePath('/travinco_dashboard/enquiries');
  revalidatePath('/travinco_dashboard/bookings');
  return { bookingId: booking.id };
}

export async function deleteEnquiry(enquiryId: string) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'enquiries', 'edit');
  if (!perm.allowed || !['admin', 'super_admin'].includes(profile.role)) {
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

  revalidatePath('/travinco_dashboard/enquiries');
  return {};
}

export interface EnquiryTableItem {
  id: string;
  enquiry_number: string;
  customer_name: string;
  phone: string;
  destination: string | null;
  travel_date: string | null;
  status: string;
  priority: string;
  next_followup_date: string | null;
  assigned_staff: string | null;
  assigned_staff_name: string;
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

/**
 * Fast, lean query fetching strictly the 8 table columns:
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
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  priority?: string;
  view?: string;
} = {}): Promise<EnquiriesTableQueryResult> {
  const profile = await requireProfile();
  await checkModulePermission(profile, 'enquiries', 'view');

  const supabase = await createClient();

  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from('enquiries')
    .select(
      'id, enquiry_number, customer_name, phone, destination, travel_date, status, priority, next_followup_date, created_at, is_deleted, assigned_staff',
      { count: 'exact' }
    )
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false });

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `customer_name.ilike.%${term}%,phone.ilike.%${term}%,enquiry_number.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  if (status) {
    let s = status;
    if (s === 'pending') s = 'new';
    if (s === 'not_interested') s = 'lost';
    if (s === 'booked') {
      query = query.or('status.eq.booked,status.eq.confirmed');
    } else {
      query = query.eq('status', s);
    }
  }

  if (priority) {
    query = query.eq('priority', priority);
  }

  if (view === 'followup_today') {
    query = query.eq('next_followup_date', today);
  } else if (view === 'overdue') {
    query = query
      .lt('next_followup_date', today)
      .not('status', 'in', '("confirmed","booked","lost","closed")');
  }

  const [{ data: enquiries, count, error }, { data: staffList }] = await Promise.all([
    query.range(from, to),
    supabase.from('profiles').select('id, full_name'),
  ]);

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
    status: e.status,
    priority: e.priority,
    next_followup_date: e.next_followup_date || null,
    assigned_staff: e.assigned_staff || null,
    assigned_staff_name: e.assigned_staff ? staffMap.get(e.assigned_staff) ?? 'Staff' : 'Unassigned',
    created_at: e.created_at,
  }));

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    enquiries: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  };
}

/**
 * Fetch tab counts (All, Follow-up Today, Overdue)
 */
export async function getEnquiryTabCounts(): Promise<EnquiryTabCounts> {
  const profile = await requireProfile();
  await checkModulePermission(profile, 'enquiries', 'view');

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ count: allCount }, { count: todayCount }, { count: overdueCount }] = await Promise.all([
    supabase
      .from('enquiries')
      .select('*', { count: 'exact', head: true })
      .or('is_deleted.is.null,is_deleted.eq.false'),
    supabase
      .from('enquiries')
      .select('*', { count: 'exact', head: true })
      .or('is_deleted.is.null,is_deleted.eq.false')
      .eq('next_followup_date', today),
    supabase
      .from('enquiries')
      .select('*', { count: 'exact', head: true })
      .or('is_deleted.is.null,is_deleted.eq.false')
      .lt('next_followup_date', today)
      .not('status', 'in', '("confirmed","booked","lost","closed")'),
  ]);

  return {
    allCount: allCount ?? 0,
    todayCount: todayCount ?? 0,
    overdueCount: overdueCount ?? 0,
  };
}


// ─── Clear Data: archive all enquiries to Google Sheets, then soft-delete ─────
const ENQUIRIES_SHEET_HEADERS = [
  'ID', 'Enquiry #', 'Customer Name', 'Phone', 'WhatsApp', 'Email', 'Destination',
  'Travel Date', 'Return Date', 'Adults', 'Children', 'Infants', 'Budget', 'Message',
  'Source', 'Status', 'Priority', 'Assigned Staff', 'Last Contacted', 'Next Follow-up',
  'Notes', 'Created At', 'Cleared At', 'Cleared By',
];

export async function clearAndArchiveEnquiries(): Promise<{ error?: string; count?: number }> {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only admins can clear enquiries data.' };
  }

  try {
    // Fast exit: nothing to archive, skip the full fetch and Google entirely
    if (!(await hasActiveRows('enquiries'))) return { count: 0 };


    const enquiries = await fetchAllActiveRows<Record<string, any>>('enquiries');
    if (enquiries.length === 0) return { count: 0 };

    // Resolve assigned staff names for readability in the sheet
    const staffIds = Array.from(new Set(enquiries.map((e) => e.assigned_staff).filter(Boolean)));
    const staffNames = new Map<string, string>();
    if (staffIds.length > 0) {
      const { data: staff } = await createServiceClient()
        .from('profiles')
        .select('id, full_name')
        .in('id', staffIds);
      (staff ?? []).forEach((s: any) => staffNames.set(s.id, s.full_name));
    }

    const clearedAt = new Date().toISOString();
    const clearedBy = profile.full_name || profile.email;
    const rows = enquiries.map((e) => [
      e.id, e.enquiry_number, e.customer_name, e.phone, e.whatsapp_number, e.email, e.destination,
      e.travel_date, e.return_date, e.number_of_adults, e.number_of_children, e.number_of_infants,
      e.budget, maskBadWords(e.message), e.source, e.status, e.priority,
      e.assigned_staff ? staffNames.get(e.assigned_staff) ?? e.assigned_staff : null,
      e.last_contacted_at, e.next_followup_date, e.notes, e.created_at, clearedAt, clearedBy,
    ]);

    // Only clear the table once the sheet write has succeeded
    await appendRowsToSheet('Enquiries', ENQUIRIES_SHEET_HEADERS, rows);
    await softDeleteRows('enquiries', enquiries.map((e) => e.id), profile.id);

    revalidatePath('/travinco_dashboard/enquiries');
    revalidatePath('/travinco_dashboard');
    return { count: enquiries.length };
  } catch (err) {
    console.error('clearAndArchiveEnquiries failed:', err);
    return { error: 'Could not archive enquiries to Google Sheets. No data was cleared.' };
  }
}
