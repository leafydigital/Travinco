-- =========================================================
-- MIGRATION 002: Travel package CMS
-- =========================================================

create table public.travel_packages (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete restrict,
  title varchar(200) not null,
  slug varchar(220) not null unique,
  category package_category not null default 'other',
  status package_status not null default 'draft',
  is_featured boolean not null default false,

  duration_days int not null check (duration_days > 0),
  duration_nights int not null check (duration_nights >= 0),

  base_price numeric(10, 2) not null check (base_price >= 0),
  discount_price numeric(10, 2) check (discount_price >= 0),
  currency varchar(3) not null default 'INR',

  short_description varchar(500),
  full_description text,
  highlights text[] not null default '{}',
  terms_and_conditions text,

  available_from date,
  available_to date,
  total_seats int check (total_seats > 0),
  seats_booked int not null default 0 check (seats_booked >= 0),
  pickup_info text,

  cover_image_url text,

  meta_title varchar(160),
  meta_description varchar(320),

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_discount_lower check (discount_price is null or discount_price <= base_price),
  constraint chk_seats_within_total check (total_seats is null or seats_booked <= total_seats),
  constraint chk_available_dates check (available_to is null or available_from is null or available_to >= available_from)
);

comment on table public.travel_packages is
  'Package data is never hardcoded in the frontend — every public package page reads from this table.';

create index idx_packages_status on public.travel_packages (status);
create index idx_packages_destination on public.travel_packages (destination_id);
create index idx_packages_featured on public.travel_packages (is_featured) where is_featured = true;
create index idx_packages_category on public.travel_packages (category);
create index idx_packages_title_trgm on public.travel_packages using gin (title gin_trgm_ops);

create trigger trg_packages_updated_at before update on public.travel_packages
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------

create table public.package_images (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.travel_packages (id) on delete cascade,
  image_url text not null,
  alt_text varchar(200),
  is_cover boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_package_images_package on public.package_images (package_id);

-- ---------------------------------------------------------

create table public.package_itineraries (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.travel_packages (id) on delete cascade,
  day_number int not null check (day_number > 0),
  title varchar(200) not null,
  description text,
  hotel varchar(200),
  meals varchar(100),
  transport varchar(200),
  activities text[] not null default '{}',
  image_url text,

  unique (package_id, day_number)
);

create index idx_itineraries_package on public.package_itineraries (package_id);

-- ---------------------------------------------------------

create table public.package_inclusions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.travel_packages (id) on delete cascade,
  item varchar(255) not null,
  sort_order int not null default 0
);

create index idx_inclusions_package on public.package_inclusions (package_id);

create table public.package_exclusions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.travel_packages (id) on delete cascade,
  item varchar(255) not null,
  sort_order int not null default 0
);

create index idx_exclusions_package on public.package_exclusions (package_id);

-- ---------------------------------------------------------
-- GALLERY (site-wide gallery, independent of any one package)
-- ---------------------------------------------------------

create table public.gallery (
  id uuid primary key default gen_random_uuid(),
  title varchar(200),
  image_url text not null,
  category varchar(100),
  status content_status not null default 'published',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_gallery_status on public.gallery (status);
create index idx_gallery_category on public.gallery (category);
