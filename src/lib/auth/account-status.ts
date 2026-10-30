import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { escapeLike } from '@/lib/auth/signup-rules';

/**
 * Account status checks shared by every sign-in and password-recovery path.
 * An administrator can deactivate or (soft-)delete a staff member or customer;
 * either way that person must not be able to sign in or reset their password.
 */

export const ACCOUNT_DEACTIVATED_MESSAGE =
  'Your account is deactivated. Please contact the Travinco team.';
export const ACCOUNT_DELETED_MESSAGE = 'Unable to login. Please contact the Travinco team.';

export type AccountStatus = 'active' | 'deactivated' | 'deleted';

export function accountStatusMessage(status: AccountStatus): string | null {
  if (status === 'deactivated') return ACCOUNT_DEACTIVATED_MESSAGE;
  if (status === 'deleted') return ACCOUNT_DELETED_MESSAGE;
  return null;
}

const isTrue = (v: unknown) => v === true || v === 'true' || v === 1;
const isFalse = (v: unknown) => v === false || v === 'false' || v === 0;

/**
 * Status of a staff profile (public.profiles). Deleting a staff member soft-deletes
 * the profile (is_deleted = true, is_active = false) and writes a
 * `deleted_user_<id>` marker, so either signal means "deleted".
 */
export async function getStaffAccountStatus(profile: {
  id: string;
  is_active?: unknown;
  is_deleted?: unknown;
  role_title?: unknown;
}): Promise<AccountStatus> {
  if (isTrue(profile.is_deleted) || profile.role_title === '[DELETED]') return 'deleted';

  try {
    const { data: marker } = await createServiceClient()
      .from('website_settings')
      .select('key')
      .eq('key', `deleted_user_${profile.id}`)
      .maybeSingle();
    if (marker) return 'deleted';
  } catch {
    // Marker table unavailable: fall back to the profile columns only
  }

  if (isFalse(profile.is_active)) return 'deactivated';
  return 'active';
}

/**
 * Status of a customer, looked up by email in public.customers (plus the
 * website_settings fallback markers written by the admin Customers page).
 * Enquiries can create extra `customers` rows for the same email, so the account
 * only counts as deleted when every row is deleted.
 */
export async function getCustomerAccountStatus(email: string): Promise<AccountStatus> {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return 'active';

  const service = createServiceClient();
  const { data: rows, error } = await service
    .from('customers')
    .select('id, is_active, is_deleted')
    .ilike('email', escapeLike(normalized))
    .limit(20);

  if (error || !rows || rows.length === 0) return 'active';

  const ids = rows.map((r: any) => r.id as string);
  const markerKeys = ids.flatMap((id) => [`deleted_customer_${id}`, `customer_status_${id}`]);
  const { data: markers } = await service
    .from('website_settings')
    .select('key, value')
    .in('key', markerKeys);

  const markerMap = new Map<string, any>((markers ?? []).map((m: any) => [m.key, m.value]));

  const liveRows = rows.filter(
    (r: any) => !isTrue(r.is_deleted) && !isTrue(markerMap.get(`deleted_customer_${r.id}`)?.is_deleted)
  );
  if (liveRows.length === 0) return 'deleted';

  const anyInactive = liveRows.some((r: any) => {
    if (typeof r.is_active === 'boolean') return r.is_active === false;
    return isFalse(markerMap.get(`customer_status_${r.id}`)?.is_active);
  });
  return anyInactive ? 'deactivated' : 'active';
}
