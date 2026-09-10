-- =========================================================
-- MIGRATION 005: Events & offers
-- =========================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title varchar(200) not null,
  slug varchar(220) not null unique,
  description text,
  location varchar(200),
  event_date date,
  image_url text,
  status content_status not null default 'draft',
  cta_label varchar(60),
  cta_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_events_status on public.events (status);
create index idx_events_date on public.events (event_date);

create trigger trg_events_updated_at before update on public.events
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  title varchar(200) not null,
  slug varchar(220) not null unique,
  description text,
  package_id uuid references public.travel_packages (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  discount_percent numeric(5, 2) check (discount_percent between 0 and 100),
  discount_flat numeric(10, 2) check (discount_flat >= 0),
  valid_from date not null,
  valid_to date not null,
  image_url text,
  terms text,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_offer_validity check (valid_to >= valid_from),
  constraint chk_offer_has_discount check (discount_percent is not null or discount_flat is not null)
);

comment on table public.offers is
  'Public site only shows offers where status = published and valid_to >= current_date (enforced in query, not RLS, since past offers should still be admin-visible).';

create index idx_offers_status on public.offers (status);
create index idx_offers_validity on public.offers (valid_from, valid_to);
create index idx_offers_package on public.offers (package_id);

create trigger trg_offers_updated_at before update on public.offers
  for each row execute function public.touch_updated_at();
