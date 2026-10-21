import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { BlogPostForm } from '../blog-post-form';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeleteBlogPostButton } from '../blog-post-row-actions';
import Link from 'next/link';

export default async function EditBlogPostPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'blog', 'view');
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const supabase = await createClient();
  const { data: post } = await supabase.from('blog_posts').select('*').eq('id', params.id).single();

  if (!post || post.is_deleted) notFound();

  return (
    <div className="max-w-2xl space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink-900">{post.title}</h1>
          <StatusBadge status={post.status} />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <DeleteBlogPostButton id={post.id} title={post.title} />}
          <Link href="/travinco_dashboard/blog" className="btn-outline">
            Back
          </Link>
        </div>
      </div>
      <BlogPostForm
        postId={post.id}
        initialValues={{
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          cover_image_url: post.cover_image_url,
        }}
      />
    </div>
  );
}
