import type { UserRole } from '@/types/database';
import {
  LayoutDashboard, Package, MapPin, CalendarDays, Tag, Image as ImageIcon,
  Inbox, ClipboardList, Users, MessageCircle, Megaphone, Wallet,
  Receipt, BarChart3, Settings, ShieldCheck, ScrollText,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[]; // omit = all staff roles
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export const adminNav: NavSection[] = [
  {
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard }],
  },
  {
    title: 'Travel',
    items: [
      { label: 'Packages', href: '/admin/packages', icon: Package },
      { label: 'Destinations', href: '/admin/destinations', icon: MapPin },
      { label: 'Events', href: '/admin/events', icon: CalendarDays },
      { label: 'Offers', href: '/admin/offers', icon: Tag },
      { label: 'Gallery', href: '/admin/gallery', icon: ImageIcon },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Enquiries', href: '/admin/enquiries', icon: Inbox },
      { label: 'Bookings', href: '/admin/bookings', icon: ClipboardList },
      { label: 'Customers', href: '/admin/customers', icon: Users },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { label: 'WhatsApp', href: '/admin/whatsapp', icon: MessageCircle },
      { label: 'Campaigns', href: '/admin/whatsapp/campaigns', icon: Megaphone },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        label: 'Income',
        href: '/admin/income',
        icon: Wallet,
        roles: ['accounts_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Expenses',
        href: '/admin/expenses',
        icon: Receipt,
        roles: ['accounts_staff', 'admin', 'super_admin'],
      },
      {
        label: 'Reports',
        href: '/admin/reports',
        icon: BarChart3,
        roles: ['accounts_staff', 'admin', 'super_admin'],
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Settings',
        href: '/admin/settings',
        icon: Settings,
        roles: ['admin', 'super_admin'],
      },
      {
        label: 'Admin users',
        href: '/admin/users',
        icon: ShieldCheck,
        roles: ['super_admin'],
      },
      {
        label: 'Activity logs',
        href: '/admin/activity-logs',
        icon: ScrollText,
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
