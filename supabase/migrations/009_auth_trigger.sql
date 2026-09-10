-- =========================================================
-- MIGRATION 009: profiles row auto-created on signup
--
-- Admin accounts are created manually (Supabase dashboard, or a
-- service-role script — see supabase/seed/create-admin.ts), not via
-- public self-signup. This trigger just keeps profiles in sync
-- whenever a new auth.users row appears, whatever the creation path.
-- New accounts default to the lowest-privilege role; a super_admin
-- must explicitly promote them afterwards.
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'sales_staff'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
