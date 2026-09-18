import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { BlogPostRowActions } from './blog-post-row-actions';

export default async function AdminBlogPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">Blog</h1>
        <Link href="/admin/blog/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New post
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Image</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(posts ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-ink-400">
                    No blog posts yet.
                  </td>
                </tr>
              )}
              {(posts ?? []).map((post) => (
                <tr key={post.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <div className="relative h-12 w-16 overflow-hidden rounded-lg bg-ink-100">
                      {post.cover_image_url ? (
                        <Image
                          src={post.cover_image_url}
                          alt={post.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-ink-300">
                          No image
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/blog/${post.id}`}
                      className="font-medium text-ink-800 hover:text-brand-700"
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-500">{formatDate(post.created_at)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <BlogPostRowActions id={post.id} status={post.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
