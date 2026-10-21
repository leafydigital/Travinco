import { createClient } from '@/lib/supabase/server';
import { BlogExplorer, type BlogExplorerPost } from '@/components/public/blog-explorer';
import { getBlogPageContent } from '@/lib/blog-page-content';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Blog & Travel Stories | Travinco',
  description:
    'Explore inspiring travel guides, wellness retreats, cultural journeys, and practical tips from the field curated by Travinco specialists.',
};

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: { search?: string; q?: string };
}) {
  const supabase = await createClient();

  const [
    { data: postsData },
    { data: deletedSettingsData },
    pageContent,
  ] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, created_at, status, is_deleted')
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
    supabase.from('website_settings').select('key').like('key', 'deleted_blog_%'),
    getBlogPageContent(),
  ]);

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_blog_', ''))
  );

  // Guarantee that deleted posts never show on customer side
  const mappedPosts: BlogExplorerPost[] = (postsData ?? [])
    .filter((p: any) => p.is_deleted !== true && !deletedKeys.has(p.id))
    .map((p: any) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      cover_image_url: p.cover_image_url,
      created_at: p.created_at,
    }));

  return (
    <BlogExplorer
      initialPosts={mappedPosts}
      pageContent={pageContent}
    />
  );
}
