-- =========================================================
-- MIGRATION 042: Soft Delete Support & RPC for Pickup & Drop Points
-- =========================================================

-- 1. Ensure is_deleted column exists with default and index
alter table public.pickup_drop_points 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_pickup_drop_points_is_deleted 
  on public.pickup_drop_points (is_deleted);

-- 2. Security-definer RPC function for atomic soft deletion
create or replace function public.soft_delete_pickup_drop_point(point_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pickup_drop_points
  set is_deleted = true,
      updated_at = now()
  where id = point_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_pickup_drop_point(bigint) to authenticated, anon;
