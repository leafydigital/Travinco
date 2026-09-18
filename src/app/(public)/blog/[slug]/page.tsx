import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { formatDate } from '@/lib/utils/format';
import { ArrowLeft } from 'lucide-react';

export const revalidate = 300;

async function getPost(slug: string) {
  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) {
    console.error('Error loading blog post:', error);
    return null;
  }

  return post;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: 'Post not found' };

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.cover_image_url ? [{ url: post.cover_image_url }] : undefined,
      type: 'article',
    },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  // Plain-text content is split on blank lines into paragraphs, matching
  // the hint given in the admin editor.
  const paragraphs = (post.content ?? '').split(/\n\s*\n/).filter((p: string) => p.trim());

  return (
    <div className="pt-32">
      <div className="container-page max-w-2xl pb-16">
        <Link href="/blog" className="mb-6 flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Back to blog
        </Link>

        <p className="text-sm text-ink-400">{formatDate(post.created_at)}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
          {post.title}
        </h1>

        {post.cover_image_url && (
          <div className="relative mt-6 aspect-video overflow-hidden rounded-xl2 bg-ink-100">
            <Image src={post.cover_image_url} alt={post.title} fill className="object-cover" priority />
          </div>
        )}

        <div className="prose prose-ink mt-8 max-w-none">
          {paragraphs.length > 0 ? (
            paragraphs.map((para: string, i: number) => (
              <p key={i} className="mb-4 text-ink-700">
                {para}
              </p>
            ))
          ) : (
            <p className="text-ink-400">This post doesn&apos;t have any content yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
