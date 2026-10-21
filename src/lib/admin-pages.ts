import type { IconName } from './admin-nav';
import type { UserRole } from '@/types/database';

export type PageCategory =
  | 'Core Operations'
  | 'Tour Operations'
  | 'Content & Marketing'
  | 'Finance & Master'
  | 'Role Management'
  | 'System';

export interface PageDefinition {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  category: PageCategory;
  description: string;
  adminOnly?: boolean;
  defaultRoles: UserRole[];
}

export const PAGE_CATALOG: PageDefinition[] = [
  // --- Core Operations ---
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/travinco_dashboard',
    icon: 'LayoutDashboard',
    category: 'Core Operations',
    description: 'Executive overview, key metrics, leads pipeline, and recent activities',
    defaultRoles: ['super_admin', 'admin', 'sales_staff', 'accounts_staff'],
  },
  {
    key: 'packages',
    label: 'Packages',
    href: '/travinco_dashboard/packages',
    icon: 'Package',
    category: 'Core Operations',
    description: 'Tour packages, itineraries, pricing tiers, and media management',
    defaultRoles: ['super_admin', 'admin', 'sales_staff'],
  },
  {
    key: 'destinations',
    label: 'Destinations',
    href: '/travinco_dashboard/destinations',
    icon: 'MapPin',
    category: 'Core Operations',
    description: 'Destination spots, states, attractions, and gallery showcases',
    defaultRoles: ['super_admin', 'admin', 'sales_staff'],
  },
  {
    key: 'enquiries',
    label: 'Enquiries',
    href: '/travinco_dashboard/enquiries',
    icon: 'Inbox',
    category: 'Core Operations',
    description: 'Customer leads, follow-up scheduler, quotation pipeline, and statuses',
    defaultRoles: ['super_admin', 'admin', 'sales_staff'],
  },
  {
    key: 'customers',
    label: 'Customers',
    href: '/travinco_dashboard/customers',
    icon: 'UsersRound',
    category: 'Core Operations',
    description: 'Client profiles, trip histories, contact info, and lifetime value',
    defaultRoles: ['super_admin', 'admin', 'sales_staff', 'accounts_staff'],
  },
  {
    key: 'leads',
    label: 'Leads',
    href: '/travinco_dashboard/leads',
    icon: 'ClipboardList',
    category: 'Core Operations',
    description: 'Travel enquiry leads — upload from Excel, search, filter, and manage statuses',
    defaultRoles: ['super_admin', 'admin', 'sales_staff', 'accounts_staff'],
  },

  // --- Tour Operations (Completed) ---
  {
    key: 'quotations',
    label: 'Quotations',
    href: '/travinco_dashboard/quotations',
    icon: 'FileText',
    category: 'Tour Operations',
    description: 'Dynamic quotation builder, live costing engine, and proposal tracking',
    defaultRoles: ['super_admin', 'admin', 'sales_staff', 'accounts_staff'],
  },
  {
    key: 'invoices',
    label: 'Invoices',
    href: '/travinco_dashboard/invoices',
    icon: 'ReceiptText',
    category: 'Tour Operations',
    description: 'Tax invoices, payment installments, balance tracking, and print templates',
    defaultRoles: ['super_admin', 'admin', 'sales_staff', 'accounts_staff'],
  },
  {
    key: 'hotels',
    label: 'Hotels',
    href: '/travinco_dashboard/hotels',
    icon: 'Hotel',
    category: 'Tour Operations',
    description: 'Hotel directory, seasonal rate periods, room types, and meal plans',
    defaultRoles: ['super_admin', 'admin', 'sales_staff'],
  },
  {
    key: 'transport',
    label: 'Transportation',
    href: '/travinco_dashboard/transport',
    icon: 'Car',
    category: 'Tour Operations',
    description: 'Vehicle fleet rates, per-km calculations, and driver allowances',
    defaultRoles: ['super_admin', 'admin', 'sales_staff'],
  },
  {
    key: 'pickup_points',
    label: 'Pickup & Drop Points',
    href: '/travinco_dashboard/pickup-points',
    icon: 'MapPinned',
    category: 'Tour Operations',
    description: 'Airports, railway hubs, and transfer connection rates',
    defaultRoles: ['super_admin', 'admin', 'sales_staff'],
  },
  {
    key: 'locations',
    label: 'Locations & Activities',
    href: '/travinco_dashboard/locations',
    icon: 'Landmark',
    category: 'Tour Operations',
    description: 'Sightseeing spots, activity entry charges, and guide fees',
    defaultRoles: ['super_admin', 'admin', 'sales_staff'],
  },

  // --- Content & Marketing ---
  {
    key: 'blog',
    label: 'Blog',
    href: '/travinco_dashboard/blog',
    icon: 'BookOpen',
    category: 'Content & Marketing',
    description: 'Travel articles, destination guides, and SEO blog posts',
    defaultRoles: ['super_admin', 'admin', 'sales_staff'],
  },
  {
    key: 'theme',
    label: 'Theme',
    href: '/travinco_dashboard/theme',
    icon: 'Palette',
    category: 'Content & Marketing',
    description: 'Customize website appearance, customer-side page banners, and theme images',
    defaultRoles: ['super_admin', 'admin', 'sales_staff'],
  },

  // --- Finance & Master ---
  {
    key: 'expenses',
    label: 'Expenses',
    href: '/travinco_dashboard/expenses',
    icon: 'Receipt',
    category: 'Finance & Master',
    description: 'Vendor disbursements, overhead costs, and category breakdown',
    defaultRoles: ['super_admin', 'admin', 'accounts_staff'],
  },
  {
    key: 'master',
    label: 'Rate Master',
    href: '/travinco_dashboard/master',
    icon: 'Database',
    category: 'Finance & Master',
    description: 'Hotel rate cards, seasonal meal plans, room categories, and contract rates',
    defaultRoles: ['super_admin', 'admin', 'sales_staff', 'accounts_staff'],
  },

  // --- Role Management ---
  {
    key: 'page_access',
    label: 'Page Access Management',
    href: '/travinco_dashboard/role-management/page-access',
    icon: 'ShieldCheck',
    category: 'Role Management',
    description: 'Granular checkbox-based page access configuration for staff members',
    adminOnly: true,
    defaultRoles: ['super_admin', 'admin'],
  },
  {
    key: 'users',
    label: 'Staff Users',
    href: '/travinco_dashboard/users',
    icon: 'Users',
    category: 'Role Management',
    description: 'Staff account provisioning, passwords, status, and role assignments',
    adminOnly: true,
    defaultRoles: ['super_admin', 'admin'],
  },

  // --- System ---
  {
    key: 'settings',
    label: 'Settings',
    href: '/travinco_dashboard/settings',
    icon: 'Settings',
    category: 'System',
    description: 'Global site configuration, company info, and booking terms',
    defaultRoles: ['super_admin', 'admin'],
  },
];

export const CATEGORIES: PageCategory[] = [
  'Core Operations',
  'Tour Operations',
  'Content & Marketing',
  'Finance & Master',
  'Role Management',
  'System',
];
