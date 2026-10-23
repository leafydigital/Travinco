-- =========================================================
-- MIGRATION 049: Theme Images & Customer-Side Customization
-- =========================================================

-- 1. Storage bucket for theme images
insert into storage.buckets (id, name, public)
values ('theme-images', 'theme-images', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'anyone can view theme images'
  ) then
    create policy "anyone can view theme images"
      on storage.objects for select
      using (bucket_id = 'theme-images');
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'staff can upload theme images'
  ) then
    create policy "staff can upload theme images"
      on storage.objects for insert
      with check (bucket_id = 'theme-images');
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'staff can update theme images'
  ) then
    create policy "staff can update theme images"
      on storage.objects for update
      using (bucket_id = 'theme-images');
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'staff can delete theme images'
  ) then
    create policy "staff can delete theme images"
      on storage.objects for delete
      using (bucket_id = 'theme-images');
  end if;
end;
$$;

-- 2. Theme Images Table
create table if not exists public.theme_images (
  id uuid primary key default gen_random_uuid(),
  page text not null default 'home', -- 'home', 'about', 'gallery', 'common'
  placement text not null default 'hero', -- 'hero', 'banner', 'story', 'showcase', 'background'
  image_url text not null,
  title text,
  subtitle text,
  badge text,
  button_text text,
  link_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 3. Indexes
create index if not exists idx_theme_images_page on public.theme_images(page) where is_deleted = false;
create index if not exists idx_theme_images_active on public.theme_images(is_active) where is_deleted = false;
create index if not exists idx_theme_images_sort on public.theme_images(sort_order);

-- 4. RLS Policies
alter table public.theme_images enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'theme_images' and policyname = 'anyone can view active theme images'
  ) then
    create policy "anyone can view active theme images"
      on public.theme_images for select
      using (is_deleted = false);
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'theme_images' and policyname = 'authenticated can insert theme images'
  ) then
    create policy "authenticated can insert theme images"
      on public.theme_images for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'theme_images' and policyname = 'authenticated can update theme images'
  ) then
    create policy "authenticated can update theme images"
      on public.theme_images for update
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'theme_images' and policyname = 'authenticated can delete theme images'
  ) then
    create policy "authenticated can delete theme images"
      on public.theme_images for delete
      using (true);
  end if;
end;
$$;
