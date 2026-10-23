-- =========================================================
-- MIGRATION 040: Soft Delete Support & RPC for Blog Posts
-- =========================================================

-- 1. Ensure is_deleted column exists with default and index
alter table public.blog_posts 
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_blog_posts_is_deleted 
  on public.blog_posts (is_deleted);

-- 2. Update SELECT policy for blog posts:
-- Public can view published non-deleted posts; staff can view all non-deleted posts
drop policy if exists "anyone can view published blog posts" on public.blog_posts;
create policy "anyone can view published blog posts" on public.blog_posts
  for select using (
    ((status = 'published') and (is_deleted is false or is_deleted is null))
    or public.is_staff()
  );

-- 3. Security-definer RPC function to guarantee soft deletion without RLS check failures
create or replace function public.soft_delete_blog_post(post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.blog_posts
  set is_deleted = true,
      status = 'archived',
      updated_at = now()
  where id = post_id;
  return true;
end;
$$;

grant execute on function public.soft_delete_blog_post(uuid) to authenticated, anon;
