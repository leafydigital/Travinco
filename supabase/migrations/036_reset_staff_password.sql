-- =========================================================
-- MIGRATION 036: Direct staff password reset & account check
-- =========================================================

-- Enable pgcrypto extension if not already enabled
create extension if not exists pgcrypto with schema extensions;

-- 1. Check if a staff account exists and is active (bypasses RLS for login screen)
create or replace function public.check_staff_email(p_email text)
returns json
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_is_customer boolean := false;
  v_is_active boolean := true;
  v_is_deleted boolean := false;
  v_full_name text;
begin
  -- Look up user in auth.users by email
  select id, coalesce(raw_user_meta_data->>'is_customer_signup' = 'true', false)
  into v_user_id, v_is_customer
  from auth.users
  where lower(trim(email)) = lower(trim(p_email));

  if v_user_id is null then
    return json_build_object('exists', false, 'error', 'No staff account found with this email address.');
  end if;

  if v_is_customer then
    return json_build_object('exists', false, 'error', 'This email is a customer account. Please use customer login.');
  end if;

  -- Look up profile status
  select coalesce(is_active, true), coalesce(is_deleted, false), coalesce(full_name, 'Staff Member')
  into v_is_active, v_is_deleted, v_full_name
  from public.profiles
  where id = v_user_id;

  if v_is_deleted then
    return json_build_object('exists', false, 'error', 'This staff account has been deleted.');
  end if;

  if not v_is_active then
    return json_build_object('exists', false, 'error', 'This staff account has been deactivated. Please contact your administrator.');
  end if;

  return json_build_object(
    'exists', true,
    'full_name', coalesce(v_full_name, 'Staff Member'),
    'email', lower(trim(p_email))
  );
end;
$$;

grant execute on function public.check_staff_email(text) to anon, authenticated, service_role;

-- 2. Direct password update for staff in auth.users
create or replace function public.reset_staff_password(
  p_email text,
  p_new_password text
)
returns json
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_is_customer boolean := false;
  v_is_active boolean := true;
  v_is_deleted boolean := false;
begin
  -- 1. Check auth.users
  select id, coalesce(raw_user_meta_data->>'is_customer_signup' = 'true', false)
  into v_user_id, v_is_customer
  from auth.users
  where lower(trim(email)) = lower(trim(p_email));

  if v_user_id is null or v_is_customer then
    return json_build_object('success', false, 'error', 'No staff account found with this email address.');
  end if;

  -- 2. Check profile
  select coalesce(is_active, true), coalesce(is_deleted, false)
  into v_is_active, v_is_deleted
  from public.profiles
  where id = v_user_id;

  if v_is_deleted then
    return json_build_object('success', false, 'error', 'This staff account has been deleted.');
  end if;

  if not v_is_active then
    return json_build_object('success', false, 'error', 'This staff account has been deactivated.');
  end if;

  -- 3. Update the encrypted password directly in auth.users
  update auth.users
  set encrypted_password = crypt(p_new_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = v_user_id;

  return json_build_object('success', true);
end;
$$;

grant execute on function public.reset_staff_password(text, text) to anon, authenticated, service_role;
