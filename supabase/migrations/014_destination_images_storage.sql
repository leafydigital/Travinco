-- Creates a public Storage bucket for destination cover photos uploaded
-- directly from the admin panel (JPG/PNG/WEBP), same pattern as
-- 012_package_images_storage.sql.
insert into storage.buckets (id, name, public)
values ('destination-images', 'destination-images', true)
on conflict (id) do nothing;

create policy "anyone can view destination images"
  on storage.objects for select
  using (bucket_id = 'destination-images');

create policy "staff can upload destination images"
  on storage.objects for insert
  with check (bucket_id = 'destination-images' and public.is_staff());

create policy "staff can delete destination images"
  on storage.objects for delete
  using (bucket_id = 'destination-images' and public.is_staff());
