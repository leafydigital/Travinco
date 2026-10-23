-- Migration: 033_leads.sql
-- Creates or updates the leads management table safely with soft-delete & fresh_lead status

create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  contact_name     text not null,
  contact_number   text not null,
  email            text,
  package          text,
  number_of_days   integer,
  budget           numeric(12, 2),
  from_date        date,
  to_date          date,
  number_of_people integer,
  status           text not null default 'fresh_lead',
  source           text default 'manual',
  import_batch     text,
  is_deleted       boolean not null default false,
  deleted_at       timestamptz,
  deleted_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id) on delete set null
);

-- In case table was created with enum, convert to text to prevent enum 55P04 transaction errors:
alter table public.leads
  alter column status drop default;

alter table public.leads
  alter column status type text using status::text;

alter table public.leads
  alter column status set default 'fresh_lead';

-- Add soft-delete support if not already present
alter table public.leads
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create or replace function update_leads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function update_leads_updated_at();

create index if not exists idx_leads_status     on public.leads(status);
create index if not exists idx_leads_created_at on public.leads(created_at desc);
create index if not exists idx_leads_contact    on public.leads(contact_name, contact_number);
create index if not exists idx_leads_is_deleted on public.leads(is_deleted);

alter table public.leads enable row level security;

drop policy if exists "Staff can view leads" on public.leads;
create policy "Staff can view leads"
  on public.leads for select
  using (exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Staff can insert leads" on public.leads;
create policy "Staff can insert leads"
  on public.leads for insert
  with check (exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Staff can update leads" on public.leads;
create policy "Staff can update leads"
  on public.leads for update
  using (exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Admin can delete leads" on public.leads;
create policy "Admin can delete leads"
  on public.leads for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin')));
