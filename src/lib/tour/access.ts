import type { CurrentProfile, UserRole } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';

/** Who can open each Tour Operations area. Database RLS mirrors this. */
export const TOUR_ROLES = {
  quotations: ['sales_staff', 'accounts_staff', 'admin', 'super_admin'],
  invoices: ['sales_staff', 'accounts_staff', 'admin', 'super_admin'],
  masters: ['sales_staff', 'admin', 'super_admin'],
} satisfies Record<string, UserRole[]>;

export type TourArea = keyof typeof TOUR_ROLES;

export const isAdminRole = (p: Pick<CurrentProfile, 'role'>) => p.role === 'admin' || p.role === 'super_admin';
export const isFinanceRole = (p: Pick<CurrentProfile, 'role'>) =>
  p.role === 'accounts_staff' || p.role === 'admin' || p.role === 'super_admin';

/** Master data (hotels, transport, points, locations, day plans, settings) is edited by admins only. */
export const canEditMasters = isAdminRole;
/** Only admins may change the markup on a quotation; staff always get the standard markup. */
export const canOverrideMarkup = isAdminRole;

export function canAccess(p: Pick<CurrentProfile, 'role'>, area: TourArea) {
  return (TOUR_ROLES[area] as UserRole[]).includes(p.role);
}

/** Page guard (Server Components). */
export function assertTourAccess(p: CurrentProfile, area: TourArea) {
  if (!canAccess(p, area)) redirect('/admin?error=forbidden');
}
