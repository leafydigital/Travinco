-- =========================================================
-- MIGRATION 045: Soft Delete Support & RPC for Quotations
-- =========================================================

-- 1. Ensure is_deleted column exists with default and index
alter table public.quotations 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_quotations_is_deleted 
  on public.quotations (is_deleted);

-- 2. Security-definer RPC function for atomic soft deletion
create or replace function public.soft_delete_quotation(quote_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quotations
  set is_deleted = true,
      updated_at = now()
  where id = quote_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_quotation(uuid) to authenticated, anon;
