-- Storage bucket for site-level images (currently just the logo), same
-- pattern as the package/destination/gallery/blog image buckets.
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

create policy "anyone can view site images"
  on storage.objects for select
  using (bucket_id = 'site-images');

create policy "staff can upload site images"
  on storage.objects for insert
  with check (bucket_id = 'site-images' and public.is_staff());

create policy "staff can delete site images"
  on storage.objects for delete
  using (bucket_id = 'site-images' and public.is_staff());
