// Plain row-shape interfaces matching supabase/migrations/*.sql exactly.
// These describe the data your own code works with. They are NOT wired
// into the Supabase client's generic type parameter — the client in
// src/lib/supabase/*.ts is untyped on purpose (see client.ts comment).
// Use these to type variables after a query returns, e.g.:
//   const { data } = await supabase.from('enquiries').select('*');
//   const enquiries = (data ?? []) as Enquiry[];

import type {
  UserRole, CustomerSource, PackageStatus, PackageCategory, EnquiryStatus,
  EnquiryPriority, EnquirySource, FollowupType, BookingStatus, PaymentStatus,
  PaymentMethod, ContentStatus, WhatsappCampaignStatus, WhatsappRecipientStatus,
  ContactMessageStatus, IncomeCategory, NotificationType,
} from './enums';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  source: CustomerSource;
  tags: string[];
  notes: string | null;
  whatsapp_opt_in: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Destination {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  description: string | null;
  cover_image_url: string | null;
  status: ContentStatus;
  is_featured: boolean;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TravelPackage {
  id: string;
  destination_id: string;
  title: string;
  slug: string;
  category: PackageCategory;
  status: PackageStatus;
  is_featured: boolean;
  duration_days: number;
  duration_nights: number;
  base_price: number;
  discount_price: number | null;
  currency: string;
  short_description: string | null;
  full_description: string | null;
  highlights: string[];
  terms_and_conditions: string | null;
  available_from: string | null;
  available_to: string | null;
  total_seats: number | null;
  seats_booked: number;
  pickup_info: string | null;
  cover_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackageImage {
  id: string;
  package_id: string;
  image_url: string;
  alt_text: string | null;
  is_cover: boolean;
  sort_order: number;
  created_at: string;
}

export interface PackageItinerary {
  id: string;
  package_id: string;
  day_number: number;
  title: string;
  description: string | null;
  hotel: string | null;
  meals: string | null;
  transport: string | null;
  activities: string[];
  image_url: string | null;
}

export interface PackageInclusion {
  id: string;
  package_id: string;
  item: string;
  sort_order: number;
}

export interface PackageExclusion {
  id: string;
  package_id: string;
  item: string;
  sort_order: number;
}

export interface GalleryImage {
  id: string;
  title: string | null;
  image_url: string;
  category: string | null;
  status: ContentStatus;
  sort_order: number;
  created_at: string;
}

export interface Enquiry {
  id: string;
  enquiry_number: string;
  customer_id: string | null;
  customer_name: string;
  phone: string;
  whatsapp_number: string | null;
  email: string | null;
  package_id: string | null;
  destination: string | null;
  travel_date: string | null;
  return_date: string | null;
  number_of_adults: number;
  number_of_children: number;
  number_of_infants: number;
  budget: number | null;
  message: string | null;
  source: EnquirySource;
  assigned_staff: string | null;
  status: EnquiryStatus;
  priority: EnquiryPriority;
  last_contacted_at: string | null;
  next_followup_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnquiryFollowup {
  id: string;
  enquiry_id: string;
  followup_date: string;
  followup_time: string | null;
  followup_type: FollowupType;
  note: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EnquiryActivity {
  id: string;
  enquiry_id: string;
  activity_type: string;
  description: string;
  metadata: Record<string, unknown>;
  performed_by: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  enquiry_id: string | null;
  customer_id: string;
  package_id: string;
  travel_start_date: string;
  travel_end_date: string;
  number_of_adults: number;
  number_of_children: number;
  number_of_infants: number;
  base_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_received: number;
  balance_amount: number;
  payment_status: PaymentStatus;
  booking_status: BookingStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingPassenger {
  id: string;
  booking_id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  passenger_type: 'adult' | 'child' | 'infant';
  id_proof_type: string | null;
  id_proof_number: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface EventItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  event_date: string | null;
  image_url: string | null;
  status: ContentStatus;
  cta_label: string | null;
  cta_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  package_id: string | null;
  event_id: string | null;
  discount_percent: number | null;
  discount_flat: number | null;
  valid_from: string;
  valid_to: string;
  image_url: string | null;
  terms: string | null;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface WhatsappContact {
  id: string;
  customer_id: string | null;
  phone: string;
  display_name: string | null;
  tags: string[];
  opt_in: boolean;
  opted_in_at: string | null;
  opted_out_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsappTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
  provider_template_id: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsappCampaign {
  id: string;
  name: string;
  template_id: string | null;
  message_override: string | null;
  media_url: string | null;
  audience_filter: Record<string, unknown>;
  scheduled_at: string | null;
  status: WhatsappCampaignStatus;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsappCampaignRecipient {
  id: string;
  campaign_id: string;
  contact_id: string;
  delivery_status: WhatsappRecipientStatus;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failure_reason: string | null;
  provider_message_id: string | null;
}

export interface Income {
  id: string;
  income_number: string;
  income_date: string;
  category: IncomeCategory;
  description: string | null;
  customer_id: string | null;
  booking_id: string | null;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  category_id: string;
  supplier: string | null;
  description: string | null;
  booking_id: string | null;
  package_id: string | null;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  subject: string | null;
  message: string;
  status: ContactMessageStatus;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  recipient_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface WebsiteSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// Re-export enums so callers can do a single import from '@/types'
export * from './enums';
