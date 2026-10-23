-- =========================================================
-- MIGRATION 046: Soft Delete Support & RPC for Invoices
-- =========================================================

-- 1. Ensure is_deleted column exists with default and index
alter table public.invoices 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_invoices_is_deleted 
  on public.invoices (is_deleted);

-- 2. Security-definer RPC function for atomic soft deletion
create or replace function public.soft_delete_invoice(inv_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invoices
  set is_deleted = true,
      status = 'cancelled',
      updated_at = now()
  where id = inv_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_invoice(uuid) to authenticated, anon;
