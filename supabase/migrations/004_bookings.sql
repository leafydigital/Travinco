-- =========================================================
-- MIGRATION 004: Bookings, passengers, payments
-- =========================================================

create sequence public.booking_number_seq start 1;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number varchar(30) not null unique
    default ('BK-' || to_char(now(), 'YYYY') || '-' ||
              lpad(nextval('public.booking_number_seq')::text, 5, '0')),

  enquiry_id uuid references public.enquiries (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  package_id uuid not null references public.travel_packages (id) on delete restrict,

  travel_start_date date not null,
  travel_end_date date not null,

  number_of_adults int not null default 1 check (number_of_adults >= 1),
  number_of_children int not null default 0 check (number_of_children >= 0),
  number_of_infants int not null default 0 check (number_of_infants >= 0),

  base_amount numeric(10, 2) not null check (base_amount >= 0),
  discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(10, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(10, 2) generated always as
    (base_amount - discount_amount + tax_amount) stored,

  amount_received numeric(10, 2) not null default 0 check (amount_received >= 0),
  balance_amount numeric(10, 2) not null default 0,

  payment_status payment_status not null default 'pending',
  booking_status booking_status not null default 'inquiry',

  notes text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_travel_dates check (travel_end_date >= travel_start_date)
);

comment on table public.bookings is
  'total_amount is always base - discount + tax (generated column). balance_amount and payment_status are kept correct by trg_bookings_balance whenever the money columns change.';

create index idx_bookings_status on public.bookings (booking_status);
create index idx_bookings_payment_status on public.bookings (payment_status);
create index idx_bookings_customer on public.bookings (customer_id);
create index idx_bookings_package on public.bookings (package_id);
create index idx_bookings_travel_dates on public.bookings (travel_start_date);

create trigger trg_bookings_updated_at before update on public.bookings
  for each row execute function public.touch_updated_at();

create or replace function public.recalc_booking_balance()
returns trigger
language plpgsql
as $$
begin
  new.balance_amount := new.total_amount - new.amount_received;

  if new.amount_received <= 0 then
    new.payment_status := 'pending';
  elsif new.amount_received >= new.total_amount then
    new.payment_status := 'paid';
  else
    new.payment_status := 'partial';
  end if;

  return new;
end;
$$;

create trigger trg_bookings_balance
  before insert or update of base_amount, discount_amount, tax_amount, amount_received
  on public.bookings
  for each row execute function public.recalc_booking_balance();

-- ---------------------------------------------------------

create table public.booking_passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  full_name varchar(120) not null,
  age int check (age >= 0 and age <= 130),
  gender varchar(20),
  passenger_type varchar(20) not null default 'adult'
    check (passenger_type in ('adult', 'child', 'infant')),
  id_proof_type varchar(50),
  id_proof_number varchar(100),
  created_at timestamptz not null default now()
);

comment on table public.booking_passengers is
  'id_proof_number is sensitive — RLS restricts SELECT to staff roles only, never exposed via any public API.';

create index idx_passengers_booking on public.booking_passengers (booking_id);

-- ---------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  payment_method payment_method not null default 'bank_transfer',
  payment_date date not null default current_date,
  reference_number varchar(100),
  notes text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_payments_booking on public.payments (booking_id);
create index idx_payments_date on public.payments (payment_date);

-- Keep bookings.amount_received in sync with the sum of its payments,
-- so amount_received is never hand-edited out of step with reality.
create or replace function public.sync_booking_amount_received()
returns trigger
language plpgsql
as $$
declare
  target_booking_id uuid := coalesce(new.booking_id, old.booking_id);
begin
  update public.bookings
  set amount_received = coalesce(
    (select sum(amount) from public.payments where booking_id = target_booking_id),
    0
  )
  where id = target_booking_id;

  return null;
end;
$$;

create trigger trg_payments_sync_after_change
  after insert or update or delete on public.payments
  for each row execute function public.sync_booking_amount_received();
