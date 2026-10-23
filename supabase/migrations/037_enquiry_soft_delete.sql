-- =========================================================
-- MIGRATION 037: Soft Delete Support & RPC for CRM Enquiries
-- =========================================================

-- 1. Ensure soft-delete columns exist with safe defaults and indexes
alter table public.enquiries 
  add column if not exists is_deleted boolean not null default false;

alter table public.enquiries 
  add column if not exists deleted_at timestamptz;

alter table public.enquiries 
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

create index if not exists idx_enquiries_is_deleted 
  on public.enquiries (is_deleted);

-- 2. Security-definer RPC function to guarantee soft deletion without RLS check failures
create or replace function public.soft_delete_enquiry(enquiry_id uuid, admin_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.enquiries
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = coalesce(admin_id, auth.uid()),
      updated_at = now()
  where id = enquiry_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_enquiry(uuid, uuid) to authenticated, anon;
