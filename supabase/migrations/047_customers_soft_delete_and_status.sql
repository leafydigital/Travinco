-- =========================================================
-- MIGRATION 047: Soft Delete & Status for Customers
-- =========================================================

-- 1. Ensure phone column can be empty/nullable for web signups
alter table public.customers 
  alter column phone drop not null;

-- 2. Ensure is_deleted column exists with default and index
alter table public.customers 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_customers_is_deleted 
  on public.customers (is_deleted);

-- 3. Ensure is_active column exists with default and index
alter table public.customers 
  add column if not exists is_active boolean not null default true;

create index if not exists idx_customers_is_active 
  on public.customers (is_active);

-- 4. RPC function for atomic soft deletion
create or replace function public.soft_delete_customer(cust_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers
  set is_deleted = true,
      updated_at = now()
  where id = cust_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_customer(uuid) to authenticated, anon;

-- 5. RPC function for toggling customer active/inactive status
create or replace function public.toggle_customer_status(cust_id uuid, set_active boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers
  set is_active = set_active,
      updated_at = now()
  where id = cust_id;
  return true;
end;
$$;

grant execute on function public.toggle_customer_status(uuid, boolean) to authenticated, anon;

-- 6. Allow staff to read customer_accounts so customer signups can be viewed/synced
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'customer_accounts' 
    and policyname = 'staff view customer_accounts'
  ) then
    create policy "staff view customer_accounts" on public.customer_accounts
      for select using (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
        )
      );
  end if;
end;
$$;
