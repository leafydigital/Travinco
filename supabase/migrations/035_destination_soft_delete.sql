-- =========================================================
-- MIGRATION 035: Soft Delete & Active Support for Destinations
-- =========================================================

-- 1. Add is_deleted and is_active columns with defaults and indexes
alter table public.destinations 
  add column if not exists is_deleted boolean not null default false;

alter table public.destinations 
  add column if not exists is_active boolean not null default true;

create index if not exists idx_destinations_is_deleted 
  on public.destinations (is_deleted);

create index if not exists idx_destinations_is_active 
  on public.destinations (is_active);

-- 2. Correct SELECT policy for destinations
drop policy if exists "anyone can view published destinations" on public.destinations;
create policy "anyone can view published destinations" on public.destinations
  for select using (
    ((status = 'published') and (is_deleted is false or is_deleted is null))
    or public.is_staff()
  );

-- 3. Correct UPDATE policy for destinations
drop policy if exists "staff update destinations" on public.destinations;
create policy "staff update destinations" on public.destinations
  for update using (public.is_staff())
  with check (public.is_staff());

-- 4. Correct DELETE policy for destinations
drop policy if exists "staff delete destinations" on public.destinations;
create policy "staff delete destinations" on public.destinations
  for delete using (public.is_admin());

-- 5. Security-definer RPC function to guarantee soft deletion without RLS recursion
create or replace function public.soft_delete_destination(destination_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.destinations
  set is_deleted = true
  where id = destination_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_destination(uuid) to authenticated, anon;
