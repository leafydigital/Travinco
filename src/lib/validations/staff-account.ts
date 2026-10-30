import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js/mobile';
import { isFakePhone } from '@/lib/validations/phone';
import { USERNAME_MAX, USERNAME_MIN, escapeLike } from '@/lib/auth/signup-rules';
import type { createServiceClient } from '@/lib/supabase/service';

/**
 * Staff username: the alternative to the email on the /app sign-in page.
 * No spaces and no "@" (anything with "@" is treated as an email at sign-in).
 */
export function validateStaffUsername(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Username is required';
  if (/\s/.test(value)) return 'Username cannot contain spaces';
  if (v.includes('@')) return 'Username cannot contain "@"';
  if (v.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters`;
  if (v.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters`;
  return null;
}

export const staffUsernameSchema = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    const err = validateStaffUsername(v);
    if (err) ctx.addIssue({ code: 'custom', message: err });
  });

export const staffPhoneSchema = z
  .string()
  .trim()
  .refine((v) => isValidPhoneNumber(v) && !isFakePhone(v), { message: 'Enter a valid phone number' });

/**
 * Returns an error message when another team account already uses this username or email
 * (case-insensitive). Pass `excludeId` when editing an existing account.
 */
export async function findStaffIdentityConflict(
  service: ReturnType<typeof createServiceClient>,
  { username, email, excludeId }: { username?: string; email?: string; excludeId?: string }
): Promise<string | null> {
  if (username) {
    let q = service.from('profiles').select('id').ilike('username', escapeLike(username)).limit(1);
    if (excludeId) q = q.neq('id', excludeId);
    const { data, error } = await q;
    if (error?.message?.includes('username')) {
      return 'Usernames are not set up yet. Run supabase/staff_profile_migration.sql in Supabase first.';
    }
    if (data?.length) return 'This username is already taken.';
  }
  if (email) {
    let q = service.from('profiles').select('id').ilike('email', escapeLike(email)).limit(1);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    if (data?.length) return 'Another team account already uses this email address.';
  }
  return null;
}
