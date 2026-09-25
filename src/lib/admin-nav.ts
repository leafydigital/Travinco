import type { UserRole } from '@/types/database';

// Icon is stored as a name (string), not a component reference — a live
// React component can't be passed from this server-safe config module
// into the client-side sidebar as plain data across the Server/Client
// boundary. See admin-sidebar.tsx for where the name is resolved back
// into an actual icon component.
export const iconNames = [
  'LayoutDashboard', 'Package', 'MapPin', 'Inbox', 'CalendarCheck', 'ImageIcon', 'Settings', 'Tag', 'BookOpen', 'Users',
] as const;

export type IconName = (typeof iconNames)[number];

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  roles?: UserRole[]; // omit = all staff roles
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

// Nav scope: Dashboard, Packages, Destinations, Enquiries, Special
// Offers, Gallery, Settings. The underlying routes/pages for Events,
// Bookings, Customers, WhatsApp, Income, Expenses, Reports, Users and
// Activity Logs still exist in the codebase — only removed from this
// nav list, not deleted.
export const adminNav: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
      { label: 'Packages', href: '/admin/packages', icon: 'Package' },
      { label: 'Destinations', href: '/admin/destinations', icon: 'MapPin' },
      { label: 'Enquiries', href: '/admin/enquiries', icon: 'Inbox' },
      { label: 'Bookings', href: '/admin/bookings', icon: 'CalendarCheck' },
      { label: 'Special offers', href: '/admin/offers', icon: 'Tag' },
      { label: 'Gallery', href: '/admin/gallery', icon: 'ImageIcon' },
      { label: 'Blog', href: '/admin/blog', icon: 'BookOpen' },
      {
        label: 'Settings',
        href: '/admin/settings',
        icon: 'Settings',
        roles: ['admin', 'super_admin'],
      },
      {
        label: 'Users',
        href: '/admin/users',
        icon: 'Users',
        roles: ['super_admin'],
      },
    ],
  },
];

export function navForRole(role: UserRole): NavSection[] {
  return adminNav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}
