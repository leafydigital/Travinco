-- =========================================================
-- MIGRATION 001: Extensions, enums, and foundational tables
-- =========================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------

create type user_role as enum ('super_admin', 'admin', 'sales_staff', 'accounts_staff');

create type customer_source as enum
  ('website', 'whatsapp', 'phone', 'walk_in', 'referral', 'social_media', 'other');

create type package_status as enum ('draft', 'published', 'archived');

create type package_category as enum
  ('honeymoon', 'family', 'adventure', 'group', 'luxury', 'budget', 'pilgrimage', 'other');

create type enquiry_status as enum
  ('new', 'contacted', 'follow_up', 'quotation_sent', 'negotiation',
   'confirmed', 'lost', 'closed');

create type enquiry_priority as enum ('low', 'medium', 'high', 'urgent');

create type enquiry_source as enum
  ('website', 'whatsapp', 'phone', 'walk_in', 'referral', 'social_media', 'other');

create type followup_type as enum ('call', 'whatsapp', 'email', 'meeting', 'other');

create type booking_status as enum
  ('inquiry', 'pending', 'confirmed', 'partially_paid', 'fully_paid',
   'cancelled', 'completed');

create type payment_status as enum ('pending', 'partial', 'paid', 'refunded');

create type payment_method as enum
  ('cash', 'bank_transfer', 'upi', 'credit_card', 'debit_card', 'cheque', 'other');

create type content_status as enum ('draft', 'published', 'archived');

create type whatsapp_campaign_status as enum
  ('draft', 'scheduled', 'sending', 'completed', 'cancelled', 'failed');

create type whatsapp_recipient_status as enum
  ('pending', 'sent', 'delivered', 'read', 'failed', 'opted_out');

create type contact_message_status as enum ('new', 'read', 'replied', 'closed');

create type notification_type as enum
  ('new_enquiry', 'new_booking', 'payment_received', 'followup_due',
   'followup_overdue', 'contact_message', 'low_availability');

-- ---------------------------------------------------------
-- PROFILES  (extends auth.users — one row per admin/staff login)
-- ---------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name varchar(120) not null,
  email varchar(150) not null unique,
  phone varchar(20),
  role user_role not null default 'sales_staff',
  is_active boolean not null default true,
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Admin/staff accounts. One row per auth.users row, created via trigger on signup.';

create index idx_profiles_role on public.profiles (role);
create index idx_profiles_is_active on public.profiles (is_active) where is_active = true;

-- ---------------------------------------------------------
-- CUSTOMERS
-- ---------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(120) not null,
  phone varchar(20) not null,
  whatsapp_number varchar(20),
  email varchar(150),
  address text,
  city varchar(100),
  state varchar(100),
  country varchar(100) default 'India',
  source customer_source not null default 'website',
  tags text[] not null default '{}',
  notes text,
  whatsapp_opt_in boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_customer_contact check (phone is not null or email is not null)
);

comment on table public.customers is 'Deduplicated customer records, linked from enquiries and bookings.';

create index idx_customers_phone on public.customers (phone);
create index idx_customers_email on public.customers (email);
create index idx_customers_full_name_trgm on public.customers using gin (full_name gin_trgm_ops);

-- ---------------------------------------------------------
-- DESTINATIONS
-- ---------------------------------------------------------

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null,
  slug varchar(140) not null unique,
  country varchar(100),
  description text,
  cover_image_url text,
  status content_status not null default 'draft',
  is_featured boolean not null default false,
  sort_order int not null default 0,
  meta_title varchar(160),
  meta_description varchar(320),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_destinations_status on public.destinations (status);
create index idx_destinations_featured on public.destinations (is_featured) where is_featured = true;

-- ---------------------------------------------------------
-- updated_at auto-touch trigger (reused by every table below)
-- ---------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger trg_destinations_updated_at before update on public.destinations
  for each row execute function public.touch_updated_at();
