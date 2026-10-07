-- =========================================================
-- MIGRATION 027: Customer RLS Security and Data Isolation
--
-- Strengthens Row Level Security so customer accounts can securely
-- query their own bookings, payments, passengers, customer profile,
-- and enquiries via standard anon-key Supabase client sessions,
-- while strictly blocking cross-customer access and isolating
-- customer data from unauthenticated or other customer access.
-- =========================================================

-- Helper function: get customer UUIDs matching the authenticated customer's email
-- Runs with SECURITY DEFINER so RLS on customers/customer_accounts does not
-- prevent evaluating the foreign key lookup.
create or replace function public.customer_own_customer_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select c.id from public.customers c
  join public.customer_accounts ca on ca.email = c.email
  where ca.id = auth.uid();
$$;

-- Helper function: get the email of the authenticated customer
create or replace function public.customer_own_email()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select email::text from public.customer_accounts
  where id = auth.uid();
$$;

-- Allow customers to view their own matching customer record in public.customers
create policy "customers can view their own customer record" on public.customers
  for select using (id in (select public.customer_own_customer_ids()));

-- Drop and recreate bookings policy to use the secure helper function
drop policy if exists "customers can view their own bookings" on public.bookings;
create policy "customers can view their own bookings" on public.bookings
  for select using (customer_id in (select public.customer_own_customer_ids()));

-- Drop and recreate payments policy to use the secure helper function
drop policy if exists "customers can view their own payments" on public.payments;
create policy "customers can view their own payments" on public.payments
  for select using (
    exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id
        and b.customer_id in (select public.customer_own_customer_ids())
    )
  );

-- Allow customers to view their own booking passengers
create policy "customers can view their own booking passengers" on public.booking_passengers
  for select using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_passengers.booking_id
        and b.customer_id in (select public.customer_own_customer_ids())
    )
  );

-- Allow customers to view their own enquiries
create policy "customers can view their own enquiries" on public.enquiries
  for select using (email = public.customer_own_email());
