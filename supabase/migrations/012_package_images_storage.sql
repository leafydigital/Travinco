-- Creates a public Storage bucket for package photos uploaded directly
-- from the admin panel (JPG/PNG), rather than requiring an externally
-- hosted URL. Files are publicly readable (so the public site can show
-- them) but writes are restricted to authenticated staff via policy.
insert into storage.buckets (id, name, public)
values ('package-images', 'package-images', true)
on conflict (id) do nothing;

create policy "anyone can view package images"
  on storage.objects for select
  using (bucket_id = 'package-images');

create policy "staff can upload package images"
  on storage.objects for insert
  with check (bucket_id = 'package-images' and public.is_staff());

create policy "staff can delete package images"
  on storage.objects for delete
  using (bucket_id = 'package-images' and public.is_staff());
