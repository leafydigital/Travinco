import { createClient } from '@/lib/supabase/server';
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
  | 'settings'
  | 'users'
  | 'finance';

export type PermissionAction = 'view' | 'edit';

/**
 * Fetches the logged-in user's profile row (id, role, is_active, etc).
 * Redirects to /login if there's no session. If the authenticated session
 * belongs to a customer account (no profiles row), signs them out and
 * redirects to /login?reason=not_staff.
 *
 * Wrapped in React cache() so multiple Server Components and layouts in the
 * same render pass share a single database round-trip.
 */
export const requireProfile = cache(async (): Promise<CurrentProfile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/travinco_admin_login');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    await supabase.auth.signOut();
    redirect('/travinco_admin_login?reason=not_staff');
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect('/travinco_admin_login?reason=deactivated');
  }

  return profile;
});

/**
 * Fetches granular module permission overrides for the given profile.
 * Wrapped in React cache() so the layout and pages share one DB round-trip
 * per render pass — prevents the admin layout from querying this table on
 * every sidebar navigation.
 */
export const getStaffPermissions = cache(async (profileId: string) => {
  const supabase = await createClient();
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

/** Non-throwing helper returning current profile or null (cached per request) */
export const getProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  return profile;
});

/** Throws redirect for pages requiring a specific role tier. */
export async function assertRole(
  profile: CurrentProfile,
  allowed: UserRole[]
) {
  if (!allowed.includes(profile.role)) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {}
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
      if (action === 'view') return explicit.can_view;
      if (action === 'edit') return explicit.can_view && explicit.can_edit;
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
        'customers', 'offers', 'events', 'gallery', 'blog',
        'quotations', 'invoices', 'hotels', 'transport', 'pickup_points', 'locations',
      ];
      return salesAllowed.includes(pageKey);
    }

    case 'accounts_staff': {
      const accountsAllowed = [
        'dashboard', 'income', 'expenses', 'bookings', 'customers',
        'quotations', 'invoices',
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
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {}
    redirect('/travinco_admin_login?reason=forbidden');
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
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {}
    redirect('/travinco_admin_login?reason=forbidden');
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
