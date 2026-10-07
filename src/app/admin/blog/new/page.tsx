import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { BlogPostForm } from '../blog-post-form';

export default async function NewBlogPostPage() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'blog', 'edit');

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">New blog post</h1>
      <BlogPostForm />
    </div>
  );
}
