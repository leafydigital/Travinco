-- =========================================================
-- MIGRATION 054: Login attempt tracking and 5-attempt account lockout
-- =========================================================

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier text not null, -- normalized email address
  portal text not null default 'customer', -- 'admin' or 'customer'
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_login_attempts_identifier_portal unique (identifier, portal)
);

comment on table public.login_attempts is
  'Tracks failed login attempts and 15-minute temporary lockouts after 5 consecutive failed attempts.';

create index if not exists idx_login_attempts_lookup
  on public.login_attempts (identifier, portal);

create index if not exists idx_login_attempts_locked_until
  on public.login_attempts (locked_until);

-- Trigger for updated_at
create trigger trg_login_attempts_updated_at
  before update on public.login_attempts
  for each row execute function public.touch_updated_at();

-- Enable RLS
alter table public.login_attempts enable row level security;

-- Allow anon and authenticated clients to insert/update their login attempts via server actions
create policy "Allow read login attempts for rate limiting"
  on public.login_attempts
  for select
  using (true);

create policy "Allow insert login attempts for rate limiting"
  on public.login_attempts
  for insert
  with check (true);

create policy "Allow update login attempts for rate limiting"
  on public.login_attempts
  for update
  using (true)
  with check (true);

create policy "Allow delete login attempts for rate limiting"
  on public.login_attempts
  for delete
  using (true);
