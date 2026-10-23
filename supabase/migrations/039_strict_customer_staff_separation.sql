-- =========================================================
-- MIGRATION 039: Strict Customer and Staff Account Separation
-- =========================================================

-- 1. Ensure customer_accounts has insert policy for authenticated users inserting their own record
drop policy if exists "customers can insert their own account" on public.customer_accounts;
create policy "customers can insert their own account" on public.customer_accounts
  for insert with check (auth.uid() = id);

-- 2. Refined trigger function to handle new customer accounts
create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.raw_user_meta_data->>'is_customer_signup' = 'true' or
    new.raw_user_meta_data->>'role' = 'customer' or
    (new.raw_user_meta_data->'is_customer_signup')::text = 'true'
  ) then
    insert into public.customer_accounts (id, full_name, email)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email
    )
    on conflict (id) do update set
      full_name = coalesce(excluded.full_name, customer_accounts.full_name),
      email = excluded.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_customer on auth.users;
create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row execute function public.handle_new_customer();

-- 3. Strict handle_new_user() trigger - NEVER creates a staff profile for customer signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_customer boolean := false;
begin
  -- Check user metadata
  if (
    new.raw_user_meta_data->>'is_customer_signup' = 'true' or
    new.raw_user_meta_data->>'role' = 'customer' or
    (new.raw_user_meta_data->'is_customer_signup')::text = 'true'
  ) then
    v_is_customer := true;
  end if;

  -- Check if already present in customer_accounts
  if not v_is_customer and exists (select 1 from public.customer_accounts where id = new.id or lower(email) = lower(new.email)) then
    v_is_customer := true;
  end if;

  -- If customer, abort profile creation
  if v_is_customer then
    return new;
  end if;

  -- Only create staff profile if explicitly intended as staff
  if (
    new.raw_user_meta_data->>'is_staff' = 'true' or
    new.raw_user_meta_data->>'role' in ('admin', 'sales_staff', 'accounts_staff', 'super_admin')
  ) then
    insert into public.profiles (id, full_name, email, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
      new.email,
      coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'sales_staff'::user_role)
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Clean up any customer accounts that accidentally received a staff profile
delete from public.profiles
where id in (select id from public.customer_accounts)
  and role not in ('super_admin', 'admin');

delete from public.profiles
where lower(email) in (select lower(email) from public.customer_accounts)
  and role not in ('super_admin', 'admin');
