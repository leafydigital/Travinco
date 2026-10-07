import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Tables } from '@/types/database';

export type CurrentProfile = Tables<'profiles'>;
export type UserRole = CurrentProfile['role'];

export type AdminModule =
  | 'packages'
  | 'destinations'
  | 'enquiries'
  | 'bookings'
  | 'customers'
  | 'offers'
  | 'gallery'
  | 'blog'
  | 'settings'
  | 'users'
  | 'finance'
  | 'whatsapp';

export type PermissionAction = 'view' | 'edit';

/**
 * Fetches the logged-in user's profile row (id, role, is_active, etc).
 * Redirects to /login if there's no session. If the authenticated session
 * belongs to a customer account (no profiles row), signs them out and
 * redirects to /login?reason=not_staff.
 */
export async function requireProfile(): Promise<CurrentProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    await supabase.auth.signOut();
    redirect('/login?reason=not_staff');
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect('/login?reason=deactivated');
  }

  return profile;
}

/** Non-throwing helper returning current profile or null */
export async function getProfile(): Promise<CurrentProfile | null> {
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
}

/** Throws redirect for pages requiring a specific role tier. */
export function assertRole(
  profile: CurrentProfile,
  allowed: UserRole[]
) {
  if (!allowed.includes(profile.role)) {
    redirect('/admin?error=forbidden');
  }
}

/**
 * Evaluates whether a staff member has permission for a specific module and action.
 *
 * Hierarchy:
 * 1. Super admin has full access to every module and action.
 * 2. User management edit/creation is exclusively reserved for super_admin.
 * 3. Explicit override rows in the `staff_permissions` table take precedence.
 * 4. Fallback to default role baseline:
 *    - admin: All operational and financial modules (cannot manage users without super_admin).
 *    - sales_staff: packages, destinations, enquiries, bookings, customers, offers, gallery, blog, whatsapp.
 *    - accounts_staff: finance, bookings, customers (view).
 */
export async function hasModulePermission(
  profile: CurrentProfile,
  module: AdminModule,
  action: PermissionAction = 'view'
): Promise<boolean> {
  if (!profile || !profile.is_active) return false;

  // 1. super_admin always has unrestricted access
  if (profile.role === 'super_admin') return true;

  // 2. Editing staff user accounts is strictly restricted to super_admin
  if (module === 'users' && action === 'edit') {
    return false;
  }

  // 3. Check for granular overrides in staff_permissions
  const checkableModules = [
    'packages', 'destinations', 'enquiries', 'offers',
    'gallery', 'blog', 'settings', 'users',
  ];

  if (checkableModules.includes(module)) {
    const supabase = await createClient();
    const { data: permission } = await supabase
      .from('staff_permissions')
      .select('can_view, can_edit')
      .eq('profile_id', profile.id)
      .eq('module', module)
      .maybeSingle();

    if (permission) {
      if (action === 'view') return permission.can_view;
      if (action === 'edit') return permission.can_view && permission.can_edit;
    }
  }

  // 4. Role default baselines
  switch (profile.role) {
    case 'admin':
      if (module === 'users') {
        return action === 'view';
      }
      return true;

    case 'sales_staff':
      const salesAllowedModules: AdminModule[] = [
        'packages', 'destinations', 'enquiries', 'bookings',
        'customers', 'offers', 'gallery', 'blog', 'whatsapp',
      ];
      return salesAllowedModules.includes(module);

    case 'accounts_staff':
      if (module === 'finance') return true;
      if (module === 'bookings') return true; // View bookings and manage payments
      if (module === 'customers') return action === 'view';
      return false;

    default:
      return false;
  }
}

/** Throws redirect if staff member lacks module permission (for Server Components/Pages). */
export async function assertModulePermission(
  profile: CurrentProfile,
  module: AdminModule,
  action: PermissionAction = 'view'
) {
  const allowed = await hasModulePermission(profile, module, action);
  if (!allowed) {
    redirect('/admin?error=forbidden');
  }
}

/**
 * Returns authorization status object for Server Actions without throwing Next.js redirects.
 */
export async function checkModulePermission(
  profile: CurrentProfile,
  module: AdminModule,
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
