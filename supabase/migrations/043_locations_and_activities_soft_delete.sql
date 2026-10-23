-- =========================================================================
-- MIGRATION 043: Soft Delete Support & RPCs for Locations & Activities tabs
-- Includes: locations, location_activities, location_distances, day_plans
-- =========================================================================

-- 1. Ensure is_deleted column & index on locations
alter table public.locations 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_locations_is_deleted 
  on public.locations (is_deleted);

-- 2. Ensure is_deleted column & index on location_activities
alter table public.location_activities 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_location_activities_is_deleted 
  on public.location_activities (is_deleted);

-- 3. Ensure is_deleted column & index on location_distances
alter table public.location_distances 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_location_distances_is_deleted 
  on public.location_distances (is_deleted);

-- 4. Ensure is_deleted column & index on day_plans
alter table public.day_plans 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_day_plans_is_deleted 
  on public.day_plans (is_deleted);

-- 5. Atomic Security-Definer RPC functions for soft deletion
create or replace function public.soft_delete_location(loc_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.locations
  set is_deleted = true
  where id = loc_id;
  return true;
end;
$$;

create or replace function public.soft_delete_location_activity(act_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.location_activities
  set is_deleted = true,
      updated_at = now()
  where id = act_id;
  return true;
end;
$$;

create or replace function public.soft_delete_location_distance(dist_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.location_distances
  set is_deleted = true
  where id = dist_id;
  return true;
end;
$$;

create or replace function public.soft_delete_day_plan(plan_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.day_plans
  set is_deleted = true,
      updated_at = now()
  where id = plan_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_location(bigint) to authenticated, anon;
grant execute on function public.soft_delete_location_activity(bigint) to authenticated, anon;
grant execute on function public.soft_delete_location_distance(bigint) to authenticated, anon;
grant execute on function public.soft_delete_day_plan(bigint) to authenticated, anon;
