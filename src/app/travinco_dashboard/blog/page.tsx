import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { BlogPostRowActions } from './blog-post-row-actions';
import { BulkCreateBlogsButton } from './bulk-create-modal';
import { Suspense } from 'react';

/* ── skeleton ─────────────────────────────────────────────── */
function BlogTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-ink-50 last:border-0">
          <td className="px-5 py-3">
            <div className="h-12 w-16 animate-pulse rounded-lg bg-ink-100" />
          </td>
          {Array.from({ length: 4 }).map((_, j) => (
            <td key={j} className="px-5 py-3">
              <div className="h-4 w-full animate-pulse rounded bg-ink-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ── data rows (streamed) ─────────────────────────────────── */
async function BlogRows() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'blog', 'view');
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const supabase = await createClient();

  // Fetch blog posts and any soft-deleted markers concurrently
  const [
    { data: posts, error: postsError },
    { data: deletedSettingsData },
  ] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('website_settings')
      .select('key')
      .like('key', 'deleted_blog_%'),
  ]);

  if (postsError) {
    console.error('Error fetching blog posts:', postsError.message);
  }

  const deletedBlogKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_blog_', ''))
  );

  const filteredPosts = (posts ?? []).filter((p: any) => {
    if (!p) return false;
    if (p.is_deleted === true || p.is_deleted === 'true' || p.is_deleted === 1) return false;
    if (p.status === 'archived') return false;
    if (deletedBlogKeys.has(p.id)) return false;
    return true;
  });

  if (filteredPosts.length === 0) {
    return (
      <tr>
        <td colSpan={5} className="px-5 py-10 text-center text-ink-400">
          No blog posts yet.
        </td>
      </tr>
    );
  }

  return (
    <>
      {filteredPosts.map((post) => (
        <tr key={post.id} className="border-b border-ink-50 last:border-0 hover:bg-sand-50/40 transition-colors">
          <td className="px-5 py-3">
            <div className="relative h-12 w-16 overflow-hidden rounded-lg bg-ink-100 border border-ink-200/50 shadow-2xs">
              {post.cover_image_url ? (
                <Image
                  src={post.cover_image_url}
                  alt={post.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                  unoptimized
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
              href={`/travinco_dashboard/blog/${post.id}`}
              className="font-medium text-ink-800 hover:text-brand-700 hover:underline"
            >
              {post.title}
            </Link>
          </td>
          <td className="px-5 py-3 text-ink-500">{formatDate(post.created_at)}</td>
          <td className="px-5 py-3">
            <StatusBadge status={post.status} />
          </td>
          <td className="px-5 py-3 text-right">
            <BlogPostRowActions
              id={post.id}
              title={post.title}
              status={post.status}
              isAdmin={isAdmin}
            />
          </td>
        </tr>
      ))}
    </>
  );
}

/* ── page shell (instant) ─────────────────────────────────── */
export default async function AdminBlogPage() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'blog', 'view');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">Blog</h1>
        <div className="flex items-center gap-2.5">
          <BulkCreateBlogsButton />
          <Link href="/travinco_dashboard/blog/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New post
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="w-full overflow-x-auto overflow-y-hidden">
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
              <Suspense fallback={<BlogTableSkeleton />}>
                <BlogRows />
              </Suspense>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
