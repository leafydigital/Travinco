import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { BlogPostForm } from '../blog-post-form';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';

export default async function EditBlogPostPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = await createClient();
  const { data: post } = await supabase.from('blog_posts').select('*').eq('id', params.id).single();

  if (!post) notFound();

  return (
    <div className="max-w-2xl space-y-5 pb-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink-900">{post.title}</h1>
          <StatusBadge status={post.status} />
        </div>
        <Link href="/admin/blog" className="btn-outline">
          Back
        </Link>
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
