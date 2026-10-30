'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { validateEmailAddress } from '@/lib/validations/contact-rules';
import { staffPhoneSchema, findStaffIdentityConflict } from '@/lib/validations/staff-account';
import { escapeLike } from '@/lib/auth/signup-rules';

const profileSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .superRefine((v, ctx) => {
      const err = validateEmailAddress(v);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    }),
  phone: staffPhoneSchema,
  address: z.string().trim().max(500, 'Address is too long'),
});

/**
 * Admins edit their own email, phone number and address from the Profile page.
 * The email is also the sign-in id, so it is changed on the auth account first.
 */
export async function updateOwnProfile(raw: unknown) {
  const profile = await requireProfile();
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return { error: 'Only administrators can edit their profile.' };
  }

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const { email, phone, address } = parsed.data;

  const service = createServiceClient();
  const emailChanged = email !== profile.email?.toLowerCase();

  if (emailChanged) {
    const conflict = await findStaffIdentityConflict(service, { email, excludeId: profile.id });
    if (conflict) return { error: conflict };
    const { data: customer } = await service
      .from('customer_accounts')
      .select('id')
      .ilike('email', escapeLike(email))
      .limit(1);
    if (customer?.length) return { error: 'This email address is already used by a customer account.' };

    const { error: authError } = await service.auth.admin.updateUserById(profile.id, {
      email,
      email_confirm: true,
    });
    if (authError) return { error: authError.message || 'Could not change the email address.' };
  }

  const { error } = await service
    .from('profiles')
    .update({ email, phone, address: address || null } as any)
    .eq('id', profile.id);
  if (error) {
    if (error.message?.includes('address')) {
      return { error: 'Profile address is not set up yet. Run supabase/staff_profile_migration.sql in Supabase first.' };
    }
    return { error: 'Could not update your profile.' };
  }

  revalidatePath('/travinco_dashboard', 'layout');
  revalidatePath('/travinco_dashboard/profile');
  return { success: true, emailChanged };
}
