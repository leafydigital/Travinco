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
  'UsersRound',
  'Database',
  'FileText',
  'ReceiptText',
  'Hotel',
  'Car',
  'MapPinned',
  'Landmark',
  'ShieldCheck',
  'ClipboardList',
  'Palette',
  'Blocks',
] as const;

export type IconName = (typeof iconNames)[number];

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  pageKey: string;
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
      { label: 'Dashboard', href: '/travinco_dashboard', icon: 'LayoutDashboard', pageKey: 'dashboard' },
      { label: 'Packages', href: '/travinco_dashboard/packages', icon: 'Package', pageKey: 'packages', module: 'packages' },
      { label: 'Destinations', href: '/travinco_dashboard/destinations', icon: 'MapPin', pageKey: 'destinations', module: 'destinations' },
      { label: 'Enquiries', href: '/travinco_dashboard/enquiries', icon: 'Inbox', pageKey: 'enquiries', module: 'enquiries' },
      { label: 'Customers', href: '/travinco_dashboard/customers', icon: 'UsersRound', pageKey: 'customers', module: 'customers' },
      { label: 'Blog', href: '/travinco_dashboard/blog', icon: 'BookOpen', pageKey: 'blog', module: 'blog' },
      { label: 'Theme', href: '/travinco_dashboard/theme', icon: 'Palette', pageKey: 'theme', module: 'theme', roles: ['admin', 'super_admin', 'sales_staff'] },
      {
        label: 'Expenses',
        href: '/travinco_dashboard/expenses',
        icon: 'Receipt',
        pageKey: 'expenses',
        module: 'finance',
        roles: ['accounts_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Rate Master',
        href: '/travinco_dashboard/master',
        icon: 'Database',
        pageKey: 'master',
        roles: ['admin', 'super_admin', 'sales_staff', 'accounts_staff'],
      },
      {
        label: 'Plugins',
        href: '/travinco_dashboard/plugins',
        icon: 'Blocks',
        pageKey: 'plugins',
        roles: ['admin', 'super_admin'],
      },
      {
        label: 'Settings',
        href: '/travinco_dashboard/settings',
        icon: 'Settings',
        pageKey: 'settings',
        roles: ['admin', 'super_admin'],
      },
    ],
  },
  {
    title: 'Tour operations',
    items: [
      {
        label: 'Quotations',
        href: '/travinco_dashboard/quotations',
        icon: 'FileText',
        pageKey: 'quotations',
        roles: ['sales_staff', 'accounts_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Invoices',
        href: '/travinco_dashboard/invoices',
        icon: 'ReceiptText',
        pageKey: 'invoices',
        roles: ['sales_staff', 'accounts_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Hotels',
        href: '/travinco_dashboard/hotels',
        icon: 'Hotel',
        pageKey: 'hotels',
        roles: ['sales_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Transportation',
        href: '/travinco_dashboard/transport',
        icon: 'Car',
        pageKey: 'transport',
        roles: ['sales_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Pickup & Drop Points',
        href: '/travinco_dashboard/pickup-points',
        icon: 'MapPinned',
        pageKey: 'pickup_points',
        roles: ['sales_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Locations & Activities',
        href: '/travinco_dashboard/locations',
        icon: 'Landmark',
        pageKey: 'locations',
        roles: ['sales_staff', 'admin', 'super_admin'],
      },
    ],
  },
  {
    title: 'Role Management',
    items: [
      {
        label: 'Roles',
        href: '/travinco_dashboard/role-management/roles',
        icon: 'ShieldCheck',
        pageKey: 'roles',
        roles: ['admin', 'super_admin'],
      },
      {
        label: 'Users',
        href: '/travinco_dashboard/users',
        icon: 'Users',
        pageKey: 'users',
        module: 'users',
        roles: ['admin', 'super_admin'],
      },
    ],
  },
];

/**
 * Filters the admin navigation according to the staff member's role and
 * granular staff_permissions overrides.
 *
 * If explicit staff_permissions exist for the user, a strict whitelist
 * is enforced: only pages with can_view = true are displayed in the sidebar.
 */
export function navForProfile(
  profile: Tables<'profiles'>,
  permissions: Tables<'staff_permissions'>[] = []
): NavSection[] {
  const hasCustomPermissions = permissions && permissions.length > 0;

  return adminNav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // 1. Super admin sees all navigation items
        if (profile.role === 'super_admin') return true;

        // 2. Role Management & system configuration items are strictly restricted to admin & super_admin
        if (item.pageKey === 'roles' || item.pageKey === 'users' || item.pageKey === 'plugins' || item.pageKey === 'settings') {
          return profile.role === 'admin';
        }

        // 3. If explicit staff_permissions exist for this profile, enforce strict whitelist
        if (hasCustomPermissions) {
          const explicit = permissions.find(
            (p) => p.module === item.pageKey || (item.module && p.module === item.module)
          );
          if (explicit !== undefined) {
            return explicit.can_view;
          }
          // Any page not explicitly granted in custom permissions is hidden
          return false;
        }

        // 4. Default role allowance fallback (when no custom permissions configured yet)
        if (item.roles && !item.roles.includes(profile.role)) {
          return false;
        }

        // 5. Default role baselines
        if (profile.role === 'sales_staff') {
          const disallowedForSales = ['income', 'expenses', 'settings', 'users', 'roles'];
          return !disallowedForSales.includes(item.pageKey);
        }

        if (profile.role === 'accounts_staff') {
          const allowedForAccounts = [
            'dashboard',
            'expenses',
            'customers',
            'quotations',
            'invoices',
            'master',
          ];
          return allowedForAccounts.includes(item.pageKey);
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
