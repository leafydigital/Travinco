import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { BlogPostForm } from '../blog-post-form';
import Link from 'next/link';

export default async function NewBlogPostPage() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'blog', 'edit');

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-900">New blog post</h1>
        <Link href="/travinco_dashboard/blog" className="btn-outline">
          Back
        </Link>
      </div>
      <BlogPostForm />
    </div>
  );
}
