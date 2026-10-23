-- =========================================================
-- MIGRATION 034: Soft Delete Column & Fixed RLS for Travel Packages
-- =========================================================

-- 1. Add is_deleted column and index
alter table public.travel_packages 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_travel_packages_is_deleted 
  on public.travel_packages (is_deleted);

-- 2. Correct SELECT policy:
-- Anonymous/public users see only published & non-deleted packages.
-- Staff and admins see ALL packages (draft, published, archived, soft-deleted).
drop policy if exists "anyone can view published packages" on public.travel_packages;
create policy "anyone can view published packages" on public.travel_packages
  for select using (
    (status = 'published' and (is_deleted is false or is_deleted is null))
    or public.is_staff()
  );

-- 3. Correct UPDATE policy:
-- Staff and admins can update packages without RLS check violations.
drop policy if exists "staff update packages" on public.travel_packages;
create policy "staff update packages" on public.travel_packages
  for update using (public.is_staff())
  with check (public.is_staff());

-- 4. Correct DELETE policy:
drop policy if exists "admin delete packages" on public.travel_packages;
create policy "admin delete packages" on public.travel_packages
  for delete using (public.is_admin());

-- 5. Security-definer RPC function to guarantee soft deletion without RLS recursion:
create or replace function public.soft_delete_package(package_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.travel_packages
  set is_deleted = true
  where id = package_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_package(uuid) to authenticated, anon;

