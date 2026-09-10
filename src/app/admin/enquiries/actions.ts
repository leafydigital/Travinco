'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { EnquiryStatus, FollowupType } from '@/types/database';

async function logEnquiryActivity(
  enquiryId: string,
  activityType: string,
  description: string,
  metadata: Record<string, unknown> = {}
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from('enquiry_activities').insert({
    enquiry_id: enquiryId,
    activity_type: activityType,
    description,
    metadata,
    performed_by: user?.id ?? null,
  });
}

export async function updateEnquiryStatus(enquiryId: string, status: EnquiryStatus) {
  await requireProfile();
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
    `Status changed from ${before?.status ?? 'unknown'} to ${status}`,
    { from_status: before?.status, to_status: status }
  );

  revalidatePath(`/admin/enquiries/${enquiryId}`);
  revalidatePath('/admin/enquiries');
  return {};
}

export async function assignEnquiry(enquiryId: string, staffId: string | null) {
  await requireProfile();
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

  revalidatePath(`/admin/enquiries/${enquiryId}`);
  revalidatePath('/admin/enquiries');
  return {};
}

export async function updateEnquiryPriority(
  enquiryId: string,
  priority: 'low' | 'medium' | 'high' | 'urgent'
) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('enquiries').update({ priority }).eq('id', enquiryId);
  if (error) return { error: 'Could not update priority.' };
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return {};
}

const noteSchema = z.object({ note: z.string().min(1).max(2000) });

export async function addEnquiryNote(enquiryId: string, raw: unknown) {
  await requireProfile();
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

  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return {};
}

const followupSchema = z.object({
  followup_date: z.string().min(1, 'Date is required'),
  followup_time: z.string().optional().or(z.literal('')),
  followup_type: z.enum(['call', 'whatsapp', 'email', 'meeting', 'other']),
  note: z.string().max(1000).optional().or(z.literal('')),
});

export async function scheduleFollowup(enquiryId: string, raw: unknown) {
  await requireProfile();
  const parsed = followupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid follow-up.' };

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

  revalidatePath(`/admin/enquiries/${enquiryId}`);
  revalidatePath('/admin/enquiries');
  return {};
}

export async function completeFollowup(enquiryId: string, followupId: string) {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from('enquiry_followups')
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq('id', followupId);

  if (error) return { error: 'Could not mark follow-up complete.' };

  await logEnquiryActivity(enquiryId, 'followup_completed', 'Follow-up marked complete');
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return {};
}

/**
 * Converts an enquiry into a customer (creating one if the enquiry isn't
 * linked to an existing customer yet) and a booking in one step, per your
 * "convert enquiry into booking" requirement. Returns the new booking id
 * so the caller can redirect straight to it for the admin to fill in
 * pricing/dates.
 */
export async function convertEnquiryToBooking(enquiryId: string) {
  await requireProfile();
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

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      enquiry_id: enquiryId,
      customer_id: customerId,
      package_id: enquiry.package_id,
      travel_start_date: travelStart,
      travel_end_date: travelEnd,
      number_of_adults: enquiry.number_of_adults,
      number_of_children: enquiry.number_of_children,
      number_of_infants: enquiry.number_of_infants,
      base_amount: unitPrice * Math.max(paxCount, 1),
      booking_status: 'inquiry',
    })
    .select('id')
    .single();

  if (bookingError || !booking) return { error: 'Could not create booking.' };

  await supabase.from('enquiries').update({ status: 'confirmed' }).eq('id', enquiryId);

  await logEnquiryActivity(enquiryId, 'converted_to_booking', 'Converted to a booking', {
    booking_id: booking.id,
  });

  revalidatePath('/admin/enquiries');
  revalidatePath('/admin/bookings');
  return { bookingId: booking.id };
}
