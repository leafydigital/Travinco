-- Supports multiple videos per package, same pattern as package_images.
-- The existing travel_packages.video_url column (migration 011) stays
-- as-is for backward compatibility with any package that already has a
-- single video set there; new/updated packages use this table instead,
-- and the public package page shows videos from both sources combined.
create table public.package_videos (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.travel_packages (id) on delete cascade,
  video_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_package_videos_package on public.package_videos (package_id);

alter table public.package_videos enable row level security;

create policy "anyone can view videos of published packages" on public.package_videos
  for select using (
    exists (
      select 1 from public.travel_packages p
      where p.id = package_id and (p.status = 'published' or public.is_staff())
    )
  );

create policy "staff manage package videos" on public.package_videos
  for all using (public.is_staff()) with check (public.is_staff());
