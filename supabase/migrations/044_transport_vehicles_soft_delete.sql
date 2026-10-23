-- =========================================================
-- MIGRATION 044: Soft Delete Support & RPC for Transportation
-- =========================================================

-- 1. Ensure is_deleted column exists with default and index
alter table public.transport_vehicles 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_transport_vehicles_is_deleted 
  on public.transport_vehicles (is_deleted);

-- 2. Security-definer RPC function for atomic soft deletion
create or replace function public.soft_delete_transport_vehicle(vehicle_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.transport_vehicles
  set is_deleted = true,
      updated_at = now()
  where id = vehicle_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_transport_vehicle(bigint) to authenticated, anon;
