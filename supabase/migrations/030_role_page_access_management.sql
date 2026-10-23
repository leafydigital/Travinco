-- =========================================================
-- MIGRATION 030: Role-Based Page Access Management & Custom Roles
-- =========================================================

-- 1. Alter staff_permissions.module from admin_module enum to text
-- to support all page keys across all operational and administrative areas.
alter table public.staff_permissions 
  alter column module type text using module::text;

-- 2. Drop the restrictive super_admin-only write policy
drop policy if exists "only super_admin manages permissions" on public.staff_permissions;

-- 3. Allow all admins (admin and super_admin) to manage staff permissions
create policy "admins can manage permissions" on public.staff_permissions
  for all using (public.is_admin())
  with check (public.is_admin());

-- 4. Support custom role titles on profiles
alter table public.profiles
  add column if not exists role_title text;
