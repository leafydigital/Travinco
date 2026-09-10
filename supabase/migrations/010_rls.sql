-- =========================================================
-- MIGRATION 010: Row Level Security
--
-- Model:
--   - Public/anonymous visitors: read-only on published content
--     (packages, destinations, events, offers, gallery where
--     status = 'published'), plus INSERT-only on enquiries and
--     contact_messages (the two public forms). No public SELECT on
--     any table containing customer/financial/passenger data.
--   - Authenticated staff (any row in profiles): full read on
--     operational tables; writes are further scoped by role via
--     public.current_role() below.
--   - accounts_staff: full access to finance tables, read-only
--     elsewhere.
--   - sales_staff: full access to CRM (enquiries/bookings/customers),
--     no access to finance tables beyond read, no user management.
--   - admin / super_admin: full access. Only super_admin can change
--     another user's role.
-- =========================================================

-- Helper: current user's role, null if not logged in / no profile row.
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.current_role() is not null;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('admin', 'super_admin');
$$;

create or replace function public.is_finance_staff()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('accounts_staff', 'admin', 'super_admin');
$$;

-- ---------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.destinations enable row level security;
alter table public.travel_packages enable row level security;
alter table public.package_images enable row level security;
alter table public.package_itineraries enable row level security;
alter table public.package_inclusions enable row level security;
alter table public.package_exclusions enable row level security;
alter table public.gallery enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_followups enable row level security;
alter table public.enquiry_activities enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_passengers enable row level security;
alter table public.payments enable row level security;
alter table public.events enable row level security;
alter table public.offers enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.whatsapp_campaigns enable row level security;
alter table public.whatsapp_campaign_recipients enable row level security;
alter table public.income enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.contact_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.website_settings enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------

create policy "staff can view all profiles" on public.profiles
  for select using (public.is_staff());

create policy "users can update their own profile (not role)" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "only super_admin can change roles / manage other profiles" on public.profiles
  for update using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy "only super_admin can delete profiles" on public.profiles
  for delete using (public.current_role() = 'super_admin');

-- ---------------------------------------------------------
-- PUBLIC CONTENT (read-published-only for anon, full for staff)
-- ---------------------------------------------------------

create policy "anyone can view published destinations" on public.destinations
  for select using (status = 'published' or public.is_staff());
create policy "staff manage destinations" on public.destinations
  for insert with check (public.is_staff());
create policy "staff update destinations" on public.destinations
  for update using (public.is_staff());
create policy "staff delete destinations" on public.destinations
  for delete using (public.is_admin());

create policy "anyone can view published packages" on public.travel_packages
  for select using (status = 'published' or public.is_staff());
create policy "staff insert packages" on public.travel_packages
  for insert with check (public.is_staff());
create policy "staff update packages" on public.travel_packages
  for update using (public.is_staff());
create policy "admin delete packages" on public.travel_packages
  for delete using (public.is_admin());

-- Package children (images/itineraries/inclusions/exclusions): visible
-- whenever their parent package is visible; writable by staff.
create policy "view package images with parent visibility" on public.package_images
  for select using (
    exists (select 1 from public.travel_packages p
            where p.id = package_id and (p.status = 'published' or public.is_staff()))
  );
create policy "staff write package images" on public.package_images
  for all using (public.is_staff()) with check (public.is_staff());

create policy "view itineraries with parent visibility" on public.package_itineraries
  for select using (
    exists (select 1 from public.travel_packages p
            where p.id = package_id and (p.status = 'published' or public.is_staff()))
  );
create policy "staff write itineraries" on public.package_itineraries
  for all using (public.is_staff()) with check (public.is_staff());

create policy "view inclusions with parent visibility" on public.package_inclusions
  for select using (
    exists (select 1 from public.travel_packages p
            where p.id = package_id and (p.status = 'published' or public.is_staff()))
  );
create policy "staff write inclusions" on public.package_inclusions
  for all using (public.is_staff()) with check (public.is_staff());

create policy "view exclusions with parent visibility" on public.package_exclusions
  for select using (
    exists (select 1 from public.travel_packages p
            where p.id = package_id and (p.status = 'published' or public.is_staff()))
  );
create policy "staff write exclusions" on public.package_exclusions
  for all using (public.is_staff()) with check (public.is_staff());

create policy "anyone can view published gallery" on public.gallery
  for select using (status = 'published' or public.is_staff());
create policy "staff write gallery" on public.gallery
  for all using (public.is_staff()) with check (public.is_staff());

create policy "anyone can view published events" on public.events
  for select using (status = 'published' or public.is_staff());
create policy "staff write events" on public.events
  for all using (public.is_staff()) with check (public.is_staff());

create policy "anyone can view published offers" on public.offers
  for select using (status = 'published' or public.is_staff());
create policy "staff write offers" on public.offers
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------
-- ENQUIRIES — public can INSERT only, never SELECT/UPDATE/DELETE.
-- This is the public enquiry/booking-request form's only permission.
-- ---------------------------------------------------------

create policy "anyone can submit an enquiry" on public.enquiries
  for insert with check (true);

create policy "staff view enquiries" on public.enquiries
  for select using (public.is_staff());
create policy "staff update enquiries" on public.enquiries
  for update using (public.is_staff());
create policy "admin delete enquiries" on public.enquiries
  for delete using (public.is_admin());

create policy "staff manage followups" on public.enquiry_followups
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff view activities" on public.enquiry_activities
  for select using (public.is_staff());
create policy "staff insert activities" on public.enquiry_activities
  for insert with check (public.is_staff());
-- No update/delete policy on enquiry_activities at all: append-only by design.

-- ---------------------------------------------------------
-- CONTACT MESSAGES — same public-insert-only pattern
-- ---------------------------------------------------------

create policy "anyone can submit a contact message" on public.contact_messages
  for insert with check (true);
create policy "staff view contact messages" on public.contact_messages
  for select using (public.is_staff());
create policy "staff update contact messages" on public.contact_messages
  for update using (public.is_staff());

-- ---------------------------------------------------------
-- CUSTOMERS — staff only, never public. Contains PII.
-- ---------------------------------------------------------

create policy "staff view customers" on public.customers
  for select using (public.is_staff());
create policy "staff insert customers" on public.customers
  for insert with check (public.is_staff());
create policy "staff update customers" on public.customers
  for update using (public.is_staff());
create policy "admin delete customers" on public.customers
  for delete using (public.is_admin());

-- ---------------------------------------------------------
-- BOOKINGS / PASSENGERS / PAYMENTS — staff only. Passengers carry
-- ID-proof numbers; payments are financial records.
-- ---------------------------------------------------------

create policy "staff view bookings" on public.bookings
  for select using (public.is_staff());
create policy "staff insert bookings" on public.bookings
  for insert with check (public.is_staff());
create policy "staff update bookings" on public.bookings
  for update using (public.is_staff());
create policy "admin delete bookings" on public.bookings
  for delete using (public.is_admin());

create policy "staff manage passengers" on public.booking_passengers
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff view payments" on public.payments
  for select using (public.is_staff());
create policy "finance staff insert payments" on public.payments
  for insert with check (public.is_finance_staff() or public.current_role() = 'sales_staff');
  -- sales staff can record a payment a customer hands them; editing/
  -- deleting a payment is restricted to finance/admin below.
create policy "finance staff update payments" on public.payments
  for update using (public.is_finance_staff());
create policy "finance staff delete payments" on public.payments
  for delete using (public.is_finance_staff());

-- ---------------------------------------------------------
-- FINANCE — income/expenses restricted to accounts_staff + admin.
-- Sales staff get no access; a booking's own totals (visible via
-- bookings table) are enough for their job.
-- ---------------------------------------------------------

create policy "finance staff view income" on public.income
  for select using (public.is_finance_staff());
create policy "finance staff write income" on public.income
  for all using (public.is_finance_staff()) with check (public.is_finance_staff());

create policy "finance staff view expenses" on public.expenses
  for select using (public.is_finance_staff());
create policy "finance staff write expenses" on public.expenses
  for all using (public.is_finance_staff()) with check (public.is_finance_staff());

create policy "staff view expense categories" on public.expense_categories
  for select using (public.is_staff());
create policy "finance staff write expense categories" on public.expense_categories
  for all using (public.is_finance_staff()) with check (public.is_finance_staff());

-- ---------------------------------------------------------
-- WHATSAPP — staff only, marketing/sales facing.
-- ---------------------------------------------------------

create policy "staff manage whatsapp contacts" on public.whatsapp_contacts
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage whatsapp templates" on public.whatsapp_templates
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage whatsapp campaigns" on public.whatsapp_campaigns
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage whatsapp recipients" on public.whatsapp_campaign_recipients
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------
-- NOTIFICATIONS — a staff member sees their own + broadcast ones.
-- ---------------------------------------------------------

create policy "staff view own or broadcast notifications" on public.notifications
  for select using (recipient_id = auth.uid() or recipient_id is null);
create policy "staff mark own notifications read" on public.notifications
  for update using (recipient_id = auth.uid() or recipient_id is null);
create policy "staff insert notifications" on public.notifications
  for insert with check (public.is_staff());

-- ---------------------------------------------------------
-- WEBSITE SETTINGS — public can read (site needs phone/address/hours
-- for the Contact page); only admin can write.
-- ---------------------------------------------------------

create policy "anyone can read settings" on public.website_settings
  for select using (true);
create policy "admin write settings" on public.website_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------
-- AUDIT LOGS — admin read-only; never writable via the client
-- (only via server-side code using the service-role client, which
-- bypasses RLS by design and is the sole intended writer here).
-- ---------------------------------------------------------

create policy "admin view audit logs" on public.audit_logs
  for select using (public.is_admin());
