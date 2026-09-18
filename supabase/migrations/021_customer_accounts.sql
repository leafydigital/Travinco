-- Customer-facing accounts, entirely separate from public.profiles
-- (staff/admin accounts). A customer signing up creates a row here
-- linked to their own auth.users row via a trigger. A customer's
-- booking history is looked up by matching their account's email
-- against public.customers.email — the same email staff enter when
-- logging a booking for them — so no change to the existing booking
-- flow is needed.
create table public.customer_accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name varchar(120),
  email varchar(150) not null unique,
  created_at timestamptz not null default now()
);

alter table public.customer_accounts enable row level security;

create policy "customers can view their own account" on public.customer_accounts
  for select using (auth.uid() = id);

create policy "customers can update their own account" on public.customer_accounts
  for update using (auth.uid() = id);

-- A customer may view their own bookings/payments — matched by email,
-- not by any foreign key to customer_accounts, so this works retroactively
-- for bookings staff already logged before the customer ever signed up.
create policy "customers can view their own bookings" on public.bookings
  for select using (
    exists (
      select 1 from public.customers c
      join public.customer_accounts ca on ca.email = c.email
      where c.id = bookings.customer_id and ca.id = auth.uid()
    )
  );

create policy "customers can view their own payments" on public.payments
  for select using (
    exists (
      select 1 from public.bookings b
      join public.customers c on c.id = b.customer_id
      join public.customer_accounts ca on ca.email = c.email
      where b.id = payments.booking_id and ca.id = auth.uid()
    )
  );

-- CRITICAL: migration 009's handle_new_user() trigger fires on every
-- auth.users insert and creates a public.profiles (staff) row with
-- admin-panel access — including for a customer who just signed up on
-- the public site. This redefines that function so it skips rows
-- flagged as a customer signup, closing that gap. (If 009 has already
-- run against this database, this replaces the earlier, unsafe
-- version; if 009 hasn't run yet, that file now matches this anyway.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'is_customer_signup' = 'true' then
    return new;
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'sales_staff'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Creates the customer_accounts row automatically when someone signs up
-- through the public-facing signup form (identified by the same
-- "is_customer_signup" flag checked above, set by the signup action) —
-- kept as its own trigger/function rather than folded into
-- handle_new_user(), so the staff-signup path above stays simple.
create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'is_customer_signup' = 'true' then
    insert into public.customer_accounts (id, full_name, email)
    values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row execute function public.handle_new_customer();
