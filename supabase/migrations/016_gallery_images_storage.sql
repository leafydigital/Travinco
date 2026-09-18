-- Creates a public Storage bucket for gallery photos uploaded directly
-- from the admin panel (JPG/PNG/WEBP), same pattern as
-- 012_package_images_storage.sql and 014_destination_images_storage.sql.
insert into storage.buckets (id, name, public)
values ('gallery-images', 'gallery-images', true)
on conflict (id) do nothing;

create policy "anyone can view gallery images"
  on storage.objects for select
  using (bucket_id = 'gallery-images');

create policy "staff can upload gallery images"
  on storage.objects for insert
  with check (bucket_id = 'gallery-images' and public.is_staff());

create policy "staff can delete gallery images"
  on storage.objects for delete
  using (bucket_id = 'gallery-images' and public.is_staff());
