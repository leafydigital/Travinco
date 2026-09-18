import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Blog' };

export default async function BlogListPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  return (
    <div className="container-page pt-32 pb-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink-900">Travel notes & guides</h1>
        <p className="mt-2 text-ink-500">Stories, tips and updates from the road</p>
      </div>

      {(posts ?? []).length === 0 ? (
        <p className="py-16 text-center text-ink-400">No posts yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(posts ?? []).map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="card-hover group overflow-hidden">
              <div className="relative aspect-video bg-ink-100">
                {post.cover_image_url && (
                  <Image
                    src={post.cover_image_url}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="p-4">
                <p className="text-xs text-ink-400">{formatDate(post.created_at)}</p>
                <p className="mt-1 font-medium text-ink-900 transition-colors group-hover:text-coral-600">
                  {post.title}
                </p>
                {post.excerpt && (
                  <p className="mt-1.5 text-sm text-ink-500 line-clamp-2">{post.excerpt}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
