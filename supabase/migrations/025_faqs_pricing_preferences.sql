-- =========================================================
-- MIGRATION 025: Package FAQs, age-banded pricing, and
-- food/room preferences on enquiries & bookings.
--
-- Closes the gap between this CRM and the reference package page at
-- booking.travinco.com/tours/vietnam-explorer-7-days-6-nights — that
-- page has an FAQ accordion, separate adult/child/infant pricing, and
-- the public booking flow needs to capture food preference and room
-- type per the original CRM brief.
-- =========================================================

-- ---------------------------------------------------------
-- FAQs per package
-- ---------------------------------------------------------
create table public.package_faqs (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.travel_packages (id) on delete cascade,
  question varchar(300) not null,
  answer text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_package_faqs_package on public.package_faqs (package_id);

alter table public.package_faqs enable row level security;

create policy "view faqs with parent visibility" on public.package_faqs
  for select using (
    exists (select 1 from public.travel_packages p
            where p.id = package_id and (p.status = 'published' or public.is_staff()))
  );
create policy "staff write faqs" on public.package_faqs
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------
-- Age-banded pricing on travel_packages (base_price/discount_price
-- already cover the adult rate — these add child/infant rates,
-- matching the reference page's "Adult / Child (2-11 yrs) / Infant
-- (0-2 yrs)" pricing breakdown).
-- ---------------------------------------------------------
alter table public.travel_packages
  add column child_price numeric(10, 2) check (child_price is null or child_price >= 0),
  add column infant_price numeric(10, 2) check (infant_price is null or infant_price >= 0),
  add column child_age_range varchar(50) default '2-11 yrs',
  add column infant_age_range varchar(50) default '0-2 yrs';

-- ---------------------------------------------------------
-- Food preference & room type — planned in the original CRM brief for
-- the public booking/enquiry flow, not yet on either table.
-- ---------------------------------------------------------
create type food_preference as enum ('veg', 'non_veg', 'pure_veg');
create type room_type as enum ('ac', 'non_ac', 'semi_ac');

alter table public.enquiries
  add column food_preference food_preference,
  add column room_type room_type;

alter table public.bookings
  add column food_preference food_preference,
  add column room_type room_type;
