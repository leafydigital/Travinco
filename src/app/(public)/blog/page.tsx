import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { BlogExplorer, type BlogExplorerPost } from '@/components/public/blog-explorer';
import { getBlogPageContent } from '@/lib/blog-page-content';
import { getPageTitlesContent } from '@/lib/page-titles-content';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const titlesContent = await getPageTitlesContent();
  const title = titlesContent.titles?.blog || 'Blog & Travel Stories | Travinco';
  return {
    title: { absolute: title },
    description:
      'Explore inspiring travel guides, wellness retreats, cultural journeys, and practical tips from the field curated by Travinco specialists.',
  };
}

async function BlogPostsSection({ pageContent }: { pageContent: any }) {
  const supabase = await createClient();

  const [
    { data: postsData },
    { data: deletedSettingsData },
  ] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, created_at, status')
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
    supabase.from('website_settings').select('key').like('key', 'deleted_blog_%'),
  ]);

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_blog_', ''))
  );

  const mappedPosts: BlogExplorerPost[] = (postsData ?? [])
    .filter((p: any) => !deletedKeys.has(p.id))
    .map((p: any) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      cover_image_url: p.cover_image_url,
      created_at: p.created_at,
    }));

  return <BlogExplorer initialPosts={mappedPosts} pageContent={pageContent} isLoading={false} />;
}

export default async function BlogListPage() {
  const pageContent = await getBlogPageContent();

  return (
    <Suspense
      fallback={
        <BlogExplorer initialPosts={[]} pageContent={pageContent} isLoading={true} />
      }
    >
      <BlogPostsSection pageContent={pageContent} />
    </Suspense>
  );
}
