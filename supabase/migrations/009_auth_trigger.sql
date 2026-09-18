-- =========================================================
-- MIGRATION 009: profiles row auto-created on signup
--
-- Admin accounts are created manually (Supabase dashboard, or a
-- service-role script — see supabase/seed/create-admin.ts), not via
-- public self-signup. This trigger just keeps profiles in sync
-- whenever a new auth.users row appears, whatever the creation path.
-- New accounts default to the lowest-privilege role; a super_admin
-- must explicitly promote them afterwards.
--
-- Updated by migration 021: skips rows created through the public
-- customer signup form (flagged is_customer_signup=true in user
-- metadata), so a customer signing up on the public site never also
-- gets a staff profiles row / admin access.
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'is_customer_signup' = 'true' then
    return new;
  end if;

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
