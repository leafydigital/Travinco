import type { UserRole, Tables } from '@/types/database';
import type { AdminModule } from '@/lib/supabase/auth-helpers';

export const iconNames = [
  'LayoutDashboard',
  'Package',
  'MapPin',
  'Inbox',
  'CalendarCheck',
  'ImageIcon',
  'Settings',
  'Tag',
  'BookOpen',
  'Users',
  'TrendingUp',
  'Receipt',
  'BarChart3',
  'MessageSquare',
  'UsersRound',
  'Database',
] as const;

export type IconName = (typeof iconNames)[number];

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  module?: AdminModule;
  roles?: UserRole[]; // default role allowance if no explicit permission
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export const adminNav: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
      { label: 'Packages', href: '/admin/packages', icon: 'Package', module: 'packages' },
      { label: 'Destinations', href: '/admin/destinations', icon: 'MapPin', module: 'destinations' },
      { label: 'Enquiries', href: '/admin/enquiries', icon: 'Inbox', module: 'enquiries' },
      { label: 'Bookings', href: '/admin/bookings', icon: 'CalendarCheck', module: 'bookings' },
      { label: 'Customers', href: '/admin/customers', icon: 'UsersRound', module: 'customers' },
      { label: 'Special offers', href: '/admin/offers', icon: 'Tag', module: 'offers' },
      { label: 'Gallery', href: '/admin/gallery', icon: 'ImageIcon', module: 'gallery' },
      { label: 'Blog', href: '/admin/blog', icon: 'BookOpen', module: 'blog' },
      {
        label: 'Income',
        href: '/admin/income',
        icon: 'TrendingUp',
        module: 'finance',
        roles: ['accounts_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Expenses',
        href: '/admin/expenses',
        icon: 'Receipt',
        module: 'finance',
        roles: ['accounts_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Reports',
        href: '/admin/reports',
        icon: 'BarChart3',
        module: 'finance',
        roles: ['accounts_staff', 'admin', 'super_admin'],
      },
      {
        label: 'WhatsApp',
        href: '/admin/whatsapp',
        icon: 'MessageSquare',
        module: 'whatsapp',
        roles: ['sales_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Master',
        href: '/admin/master',
        icon: 'Database',
        roles: ['admin', 'super_admin'],
      },
      {
        label: 'Settings',
        href: '/admin/settings',
        icon: 'Settings',
        module: 'settings',
        roles: ['admin', 'super_admin'],
      },
      {
        label: 'Users',
        href: '/admin/users',
        icon: 'Users',
        module: 'users',
        roles: ['super_admin'],
      },
    ],
  },
];

/**
 * Filters the admin navigation according to the staff member's role and
 * granular staff_permissions overrides.
 */
export function navForProfile(
  profile: Tables<'profiles'>,
  permissions: Tables<'staff_permissions'>[] = []
): NavSection[] {
  return adminNav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // 1. Super admin sees all navigation items
        if (profile.role === 'super_admin') return true;

        // 2. If this item has a configurable module, check explicit staff_permissions
        if (item.module) {
          const explicit = permissions.find((p) => p.module === item.module);
          if (explicit !== undefined) {
            return explicit.can_view;
          }
        }

        // 3. Check role-restricted items
        if (item.roles && !item.roles.includes(profile.role)) {
          return false;
        }

        // 4. Role default baselines
        if (profile.role === 'sales_staff') {
          const disallowedForSales: (AdminModule | undefined)[] = ['finance', 'settings', 'users'];
          return !disallowedForSales.includes(item.module);
        }

        if (profile.role === 'accounts_staff') {
          const allowedForAccounts: (AdminModule | undefined)[] = ['finance', 'bookings', 'customers', undefined];
          return allowedForAccounts.includes(item.module);
        }

        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

/** Backward compatibility helper for role-only navigation filtering. */
export function navForRole(role: UserRole): NavSection[] {
  return navForProfile({ role } as Tables<'profiles'>, []);
}
