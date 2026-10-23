-- =========================================================
-- MIGRATION 041: Soft Delete Column & RPC for Expenses
-- =========================================================

-- 1. Add is_deleted column and index to expenses
alter table public.expenses 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_expenses_is_deleted 
  on public.expenses (is_deleted);

-- 2. Security-definer RPC function to guarantee soft deletion without RLS recursion
create or replace function public.soft_delete_expense(expense_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.expenses
  set is_deleted = true
  where id = expense_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_expense(uuid) to authenticated, anon;
