import { createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Tables } from '@/types/database';

export type CurrentProfile = Tables<'profiles'>;
export type UserRole = CurrentProfile['role'];

export type AdminModule =
  | 'packages'
  | 'destinations'
  | 'enquiries'
  | 'bookings'
  | 'customers'
  | 'leads'
  | 'offers'
  | 'gallery'
  | 'blog'
  | 'theme'
  | 'settings'
  | 'users'
  | 'finance';

export type PermissionAction = 'view' | 'edit';

/**
 * Non-throwing helper returning current staff profile or null (cached per request).
 * Uses createAdminClient() so it reads strictly from the staff/admin session cookie (sb-admin-auth-token).
 */
export const getProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Strictly reject customer accounts from being treated as staff
  const isCustomerMeta =
    user.user_metadata?.is_customer_signup === 'true' ||
    user.user_metadata?.is_customer_signup === true ||
    user.user_metadata?.role === 'customer';

  if (isCustomerMeta) return null;

  const { data: customerAccount } = await supabase
    .from('customer_accounts')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (customerAccount) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  return profile;
});

/**
 * Fetches the logged-in staff member's profile row (id, role, is_active, etc).
 * Redirects to /travinco_admin_login if unauthenticated or not an active staff member.
 * Customer sessions attempting to access staff routes are rejected.
 */
export const requireProfile = cache(async (): Promise<CurrentProfile> => {
  const profile = await getProfile();

  if (!profile) {
    redirect('/travinco_admin_login');
  }

  return profile;
});

/**
 * Fetches granular module permission overrides for the given profile.
 * Wrapped in React cache() so the layout and pages share one DB round-trip per render pass.
 */
export const getStaffPermissions = cache(async (profileId: string) => {
  const supabase = await createAdminClient();
  const [{ data: dbPerms }, { data: settingRow }] = await Promise.all([
    supabase
      .from('staff_permissions')
      .select('*')
      .eq('profile_id', profileId),
    supabase
      .from('website_settings')
      .select('value')
      .eq('key', `staff_perms_${profileId}`)
      .maybeSingle(),
  ]);

  if (settingRow?.value && Array.isArray((settingRow.value as any).pages)) {
    const grantedPages = (settingRow.value as any).pages as string[];
    return grantedPages.map((pageKey) => ({
      id: `virtual_${profileId}_${pageKey}`,
      profile_id: profileId,
      module: pageKey as any,
      can_view: true,
      can_edit: true,
      created_at: new Date().toISOString(),
    }));
  }

  return dbPerms ?? [];
});

/** Throws redirect for pages requiring a specific role tier. */
export async function assertRole(
  profile: CurrentProfile,
  allowed: UserRole[]
) {
  if (!allowed.includes(profile.role)) {
    redirect('/travinco_admin_login?reason=forbidden');
  }
}

/**
 * Evaluates whether a staff member has permission for a specific page and action.
 *
 * Rules:
 * 1. Super admin has unrestricted access to all pages and actions.
 * 2. Role Management pages ('page_access', 'users') are strictly restricted to admin & super_admin.
 * 3. If explicit records exist in `staff_permissions` for this user, a STRICT WHITELIST is enforced:
 *    only pages where can_view === true are allowed. Any page without can_view === true is rejected.
 * 4. Default role baselines apply ONLY if the user has never had permissions configured.
 */
export const hasPageAccess = cache(async (
  profile: CurrentProfile,
  pageKey: string,
  action: PermissionAction = 'view'
): Promise<boolean> => {
  if (!profile || !profile.is_active) return false;

  // 1. Super admin always has unrestricted access
  if (profile.role === 'super_admin') return true;

  // 2. Role Management pages are strictly reserved for admin and super_admin
  if (pageKey === 'page_access' || pageKey === 'users') {
    return profile.role === 'admin';
  }

  // 3. Check for granular overrides in staff_permissions
  const permissions = await getStaffPermissions(profile.id);
  if (permissions && permissions.length > 0) {
    const explicit = permissions.find((p) => p.module === pageKey);
    if (explicit) {
      // In Travinco, giving access to a page allows viewing and creating/editing items on that page.
      if (action === 'view') return Boolean(explicit.can_view);
      if (action === 'edit') return Boolean(explicit.can_view);
    }
    // With explicit permissions configured, unassigned pages are strictly forbidden
    return false;
  }

  // 4. Role default baselines (fallback when no custom permissions are set)
  switch (profile.role) {
    case 'admin':
      return true;

    case 'sales_staff': {
      const salesAllowed = [
        'dashboard', 'packages', 'destinations', 'enquiries', 'bookings',
        'customers', 'leads', 'offers', 'events', 'gallery', 'blog',
        'quotations', 'invoices', 'hotels', 'transport', 'pickup_points', 'locations', 'master', 'theme',
      ];
      return salesAllowed.includes(pageKey);
    }

    case 'accounts_staff': {
      const accountsAllowed = [
        'dashboard', 'income', 'expenses', 'bookings', 'customers', 'leads',
        'quotations', 'invoices', 'master',
      ];
      if (pageKey === 'customers' && action === 'edit') return false;
      return accountsAllowed.includes(pageKey);
    }

    default:
      return false;
  }
});

/** Throws redirect if staff member lacks page permission (for Server Components/Pages). */
export async function assertPageAccess(
  profile: CurrentProfile,
  pageKey: string,
  action: PermissionAction = 'view'
) {
  const allowed = await hasPageAccess(profile, pageKey, action);
  if (!allowed) {
    redirect('/travinco_dashboard?error=unauthorized');
  }
}

/**
 * Returns authorization status object for Server Actions without throwing Next.js redirects.
 */
export async function checkPageAccess(
  profile: CurrentProfile,
  pageKey: string,
  action: PermissionAction = 'view'
): Promise<{ allowed: boolean; error?: string }> {
  const allowed = await hasPageAccess(profile, pageKey, action);
  if (!allowed) {
    return {
      allowed: false,
      error: `You do not have permission to ${action} ${pageKey}.`,
    };
  }
  return { allowed: true };
}

/**
 * Backward-compatible wrapper for module permission checks.
 */
export const hasModulePermission = cache(async (
  profile: CurrentProfile,
  module: AdminModule | string,
  action: PermissionAction = 'view'
): Promise<boolean> => {
  if (module === 'finance') {
    // 'finance' encompasses both income and expenses
    const canIncome = await hasPageAccess(profile, 'income', action);
    const canExpenses = await hasPageAccess(profile, 'expenses', action);
    return canIncome || canExpenses;
  }
  return hasPageAccess(profile, module, action);
});

/** Throws redirect if staff member lacks module permission (for Server Components/Pages). */
export async function assertModulePermission(
  profile: CurrentProfile,
  module: AdminModule | string,
  action: PermissionAction = 'view'
) {
  const allowed = await hasModulePermission(profile, module, action);
  if (!allowed) {
    redirect('/travinco_dashboard?error=unauthorized');
  }
}

/**
 * Returns authorization status object for Server Actions without throwing Next.js redirects.
 */
export async function checkModulePermission(
  profile: CurrentProfile,
  module: AdminModule | string,
  action: PermissionAction = 'view'
): Promise<{ allowed: boolean; error?: string }> {
  const allowed = await hasModulePermission(profile, module, action);
  if (!allowed) {
    return {
      allowed: false,
      error: `You do not have permission to ${action} ${module}.`,
    };
  }
  return { allowed: true };
}
