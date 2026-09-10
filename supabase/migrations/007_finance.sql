-- =========================================================
-- MIGRATION 007: Income & expenses
-- =========================================================

create type income_category as enum
  ('package_booking', 'flight', 'hotel', 'transport', 'visa', 'service_charge', 'other');

create sequence public.income_number_seq start 1;

create table public.income (
  id uuid primary key default gen_random_uuid(),
  income_number varchar(30) not null unique
    default ('INC-' || to_char(now(), 'YYYY') || '-' ||
              lpad(nextval('public.income_number_seq')::text, 5, '0')),
  income_date date not null default current_date,
  category income_category not null default 'package_booking',
  description varchar(500),
  customer_id uuid references public.customers (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
  currency varchar(3) not null default 'INR',
  payment_method payment_method not null default 'bank_transfer',
  reference_number varchar(100),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_income_date on public.income (income_date);
create index idx_income_category on public.income (category);
create index idx_income_booking on public.income (booking_id);

-- ---------------------------------------------------------

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null unique,
  is_active boolean not null default true,
  sort_order int not null default 0
);

comment on table public.expense_categories is
  'Seeded with: Hotel, Transport, Flight, Staff, Office, Marketing, Food, Visa, Supplier, Commission, Other — editable from Settings > Finance.';

create sequence public.expense_number_seq start 1;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number varchar(30) not null unique
    default ('EXP-' || to_char(now(), 'YYYY') || '-' ||
              lpad(nextval('public.expense_number_seq')::text, 5, '0')),
  expense_date date not null default current_date,
  category_id uuid not null references public.expense_categories (id) on delete restrict,
  supplier varchar(200),
  description varchar(500),
  booking_id uuid references public.bookings (id) on delete set null,
  package_id uuid references public.travel_packages (id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
  currency varchar(3) not null default 'INR',
  payment_method payment_method not null default 'bank_transfer',
  reference_number varchar(100),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_expenses_date on public.expenses (expense_date);
create index idx_expenses_category on public.expenses (category_id);
create index idx_expenses_booking on public.expenses (booking_id);
