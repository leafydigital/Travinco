-- =========================================================
-- MIGRATION 032: Auto-confirm staff users & Custom Roles
-- =========================================================

-- 1. Confirm all existing unconfirmed accounts so they can log in immediately
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;

-- 2. Trigger to automatically pre-confirm all future staff signups
create or replace function public.auto_confirm_staff_user()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.raw_user_meta_data->>'is_customer_signup' is distinct from 'true' then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_confirm_staff on auth.users;
create trigger trg_auto_confirm_staff
  before insert on auth.users
  for each row
  execute function public.auto_confirm_staff_user();

-- 3. Dedicated RPC function to confirm a staff member by email on creation / login
-- (Strictly protects customer accounts so customers still require confirmation)
create or replace function public.confirm_staff_email(p_email text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_is_customer boolean := false;
begin
  select id, (raw_user_meta_data->>'is_customer_signup' = 'true')
  into v_user_id, v_is_customer
  from auth.users
  where lower(trim(email)) = lower(trim(p_email));

  if v_user_id is null then
    return false;
  end if;

  -- Protect customer signups on public site
  if v_is_customer then
    return false;
  end if;

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = v_user_id;

  return true;
end;
$$;

grant execute on function public.confirm_staff_email(text) to anon, authenticated, service_role;

-- 4. Ensure profiles table has role_title and is_deleted columns
alter table public.profiles
  add column if not exists role_title text;

alter table public.profiles
  add column if not exists is_deleted boolean default false;

-- 5. Convert staff_permissions module column to text
alter table public.staff_permissions 
  alter column module type text using module::text;

-- 6. Update staff_permissions RLS policy to allow admins to manage permissions
drop policy if exists "only super_admin manages permissions" on public.staff_permissions;
create policy "admins can manage permissions" on public.staff_permissions
  for all using (public.is_admin()) with check (public.is_admin());
