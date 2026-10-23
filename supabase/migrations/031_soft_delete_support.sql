-- =========================================================
-- MIGRATION 031: Global Soft Delete Support, Roles & Page Access
-- =========================================================

-- 1. Staff Profiles & Custom Roles
alter table public.profiles 
  add column if not exists role_title text;

alter table public.profiles 
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_profiles_is_deleted on public.profiles (is_deleted);

-- Allow both admin and super_admin to manage and soft-delete profiles
drop policy if exists "only super_admin can change roles / manage other profiles" on public.profiles;
create policy "admins can manage other profiles" on public.profiles
  for update using (public.is_admin())
  with check (public.is_admin());

-- 2. Staff Page Permissions: Convert module from enum to text
-- to support all page keys across all operational and administrative areas
alter table public.staff_permissions 
  alter column module type text using module::text;

drop policy if exists "only super_admin manages permissions" on public.staff_permissions;
create policy "admins can manage permissions" on public.staff_permissions
  for all using (public.is_admin())
  with check (public.is_admin());

-- 3. CRM Enquiries
alter table public.enquiries 
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_enquiries_is_deleted on public.enquiries (is_deleted);

-- 4. CRM Bookings
alter table public.bookings 
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_bookings_is_deleted on public.bookings (is_deleted);

-- 5. Customers
alter table public.customers 
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_customers_is_deleted on public.customers (is_deleted);

-- 6. Quotations
alter table public.quotations 
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_quotations_is_deleted on public.quotations (is_deleted);

-- 7. Invoices
alter table public.invoices 
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_invoices_is_deleted on public.invoices (is_deleted);

-- 8. Travel Packages
alter table public.travel_packages 
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_travel_packages_is_deleted on public.travel_packages (is_deleted);

-- 9. Destinations
alter table public.destinations 
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_destinations_is_deleted on public.destinations (is_deleted);

-- 10. Finance (Income & Expenses)
alter table public.income 
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_income_is_deleted on public.income (is_deleted);

alter table public.expenses 
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_expenses_is_deleted on public.expenses (is_deleted);

-- 11. Content & Marketing (Events, Offers, Gallery, Blog)
alter table public.events
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_events_is_deleted on public.events (is_deleted);

alter table public.offers
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_offers_is_deleted on public.offers (is_deleted);

alter table public.gallery
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_gallery_is_deleted on public.gallery (is_deleted);

alter table public.blog_posts
  add column if not exists is_deleted boolean not null default false;
create index if not exists idx_blog_posts_is_deleted on public.blog_posts (is_deleted);
