-- Simple blog feature: a post has a title, slug, cover image, short
-- excerpt (shown on cards), and full body content. Admin-managed only —
-- no comments, categories, or author accounts, matching the requested
-- "edit option only" scope.
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title varchar(200) not null,
  slug varchar(220) not null unique,
  excerpt text,
  content text,
  cover_image_url text,
  status content_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_blog_posts_status on public.blog_posts (status);
create index idx_blog_posts_created on public.blog_posts (created_at);

alter table public.blog_posts enable row level security;

create policy "anyone can view published blog posts" on public.blog_posts
  for select using (status = 'published' or public.is_staff());

create policy "staff manage blog posts" on public.blog_posts
  for all using (public.is_staff()) with check (public.is_staff());
