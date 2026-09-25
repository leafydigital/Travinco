// Plain enum types matching the Postgres enums defined in
// supabase/migrations/001_core.sql. These are used to type function
// inputs/outputs in application code — NOT wired into the Supabase
// client generic (see src/lib/supabase/client.ts for why).

export type UserRole = 'super_admin' | 'admin' | 'sales_staff' | 'accounts_staff';

export type CustomerSource =
  | 'website' | 'whatsapp' | 'phone' | 'walk_in' | 'referral' | 'social_media' | 'other';

export type PackageStatus = 'draft' | 'published' | 'archived';

export type PackageCategory =
  | 'honeymoon' | 'family' | 'adventure' | 'group' | 'luxury' | 'budget' | 'pilgrimage' | 'other';

export type FoodPreference = 'veg' | 'non_veg' | 'pure_veg';

export type RoomType = 'ac' | 'non_ac' | 'semi_ac';

export type EnquiryStatus =
  | 'new' | 'contacted' | 'follow_up' | 'quotation_sent' | 'negotiation'
  | 'confirmed' | 'lost' | 'closed';

export type EnquiryPriority = 'low' | 'medium' | 'high' | 'urgent';

export type EnquirySource =
  | 'website' | 'whatsapp' | 'phone' | 'walk_in' | 'referral' | 'social_media' | 'other';

export type FollowupType = 'call' | 'whatsapp' | 'email' | 'meeting' | 'other';

export type BookingStatus =
  | 'inquiry' | 'pending' | 'confirmed' | 'partially_paid' | 'fully_paid'
  | 'cancelled' | 'completed';

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';

export type PaymentMethod =
  | 'cash' | 'bank_transfer' | 'upi' | 'credit_card' | 'debit_card' | 'cheque' | 'other';

export type ContentStatus = 'draft' | 'published' | 'archived';

export type WhatsappCampaignStatus =
  | 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled' | 'failed';

export type WhatsappRecipientStatus =
  | 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'opted_out';

export type ContactMessageStatus = 'new' | 'read' | 'replied' | 'closed';

export type IncomeCategory =
  | 'package_booking' | 'flight' | 'hotel' | 'transport' | 'visa' | 'service_charge' | 'other';

export type NotificationType =
  | 'new_enquiry' | 'new_booking' | 'payment_received' | 'followup_due'
  | 'followup_overdue' | 'contact_message' | 'low_availability';
