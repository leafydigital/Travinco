-- Per-module view/edit permission checkboxes, layered on top of the
-- existing role enum (super_admin/admin/sales_staff/accounts_staff).
-- A role still sets the baseline; a row here can grant (or, later,
-- restrict) a specific staff member's access to a specific module
-- beyond what their role alone would imply. One row per
-- (profile, module) pair.
create type public.admin_module as enum (
  'packages', 'destinations', 'enquiries', 'offers', 'gallery', 'blog', 'settings', 'users'
);

create table public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  module public.admin_module not null,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),

  unique (profile_id, module)
);

alter table public.staff_permissions enable row level security;

-- Every staff member can read their own permission rows (needed so the
-- app can gate its own UI); only super_admin can write any of this.
create policy "staff can view their own permissions" on public.staff_permissions
  for select using (profile_id = auth.uid() or public.is_admin());

create policy "only super_admin manages permissions" on public.staff_permissions
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');
