-- Storage bucket for blog post cover images, same pattern as the
-- package/destination/gallery image buckets.
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

create policy "anyone can view blog images"
  on storage.objects for select
  using (bucket_id = 'blog-images');

create policy "staff can upload blog images"
  on storage.objects for insert
  with check (bucket_id = 'blog-images' and public.is_staff());

create policy "staff can delete blog images"
  on storage.objects for delete
  using (bucket_id = 'blog-images' and public.is_staff());
