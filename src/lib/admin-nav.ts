import type { UserRole } from '@/types/database';

// Icon is stored as a name (string), not a component reference — a live
// React component can't be passed from this server-safe config module
// into the client-side sidebar as plain data across the Server/Client
// boundary. See admin-sidebar.tsx for where the name is resolved back
// into an actual icon component.
export const iconNames = [
  'LayoutDashboard', 'Package', 'MapPin', 'Inbox', 'ImageIcon', 'Settings',
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

// Phase 2 scope: admin navigation intentionally limited to Dashboard,
// Packages, Destinations, Enquiries, Gallery, Settings. The underlying
// routes/pages for Bookings, Customers, WhatsApp, Income, Expenses,
// Reports, Users and Activity Logs still exist in the codebase — only
// removed from this nav list per the current phase's scope, not deleted.
export const adminNav: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
      { label: 'Packages', href: '/admin/packages', icon: 'Package' },
      { label: 'Destinations', href: '/admin/destinations', icon: 'MapPin' },
      { label: 'Enquiries', href: '/admin/enquiries', icon: 'Inbox' },
      { label: 'Gallery', href: '/admin/gallery', icon: 'ImageIcon' },
      {
        label: 'Settings',
        href: '/admin/settings',
        icon: 'Settings',
        roles: ['admin', 'super_admin'],
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
