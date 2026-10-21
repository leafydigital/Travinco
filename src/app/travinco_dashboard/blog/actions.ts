'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { blogPostSchema } from '@/lib/validations/content';
import { slugify } from '@/lib/validations/package';
import { revalidatePath } from 'next/cache';
import type { ContentStatus } from '@/types/database';

export async function createBlogPost(raw: unknown) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'blog', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to manage blog posts.' };

  const parsed = blogPostSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      ...parsed.data,
      cover_image_url: parsed.data.cover_image_url || null,
      status: 'draft',
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'A post with this slug already exists.' };
    return { error: 'Could not create post.' };
  }

  revalidatePath('/travinco_dashboard/blog');
  revalidatePath('/');
  return { id: data.id };
}

export async function updateBlogPost(id: string, raw: unknown) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'blog', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to manage blog posts.' };

  const parsed = blogPostSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('blog_posts')
    .update({ ...parsed.data, cover_image_url: parsed.data.cover_image_url || null })
    .eq('id', id);

  if (error) return { error: 'Could not update post.' };
  revalidatePath('/travinco_dashboard/blog');
  revalidatePath(`/travinco_dashboard/blog/${id}`);
  revalidatePath('/');
  return {};
}

export async function setBlogPostStatus(id: string, status: ContentStatus) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'blog', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to manage blog posts.' };

  const supabase = await createClient();
  const { error } = await supabase.from('blog_posts').update({ status }).eq('id', id);
  if (error) return { error: 'Could not update status.' };
  revalidatePath('/travinco_dashboard/blog');
  revalidatePath('/');
  return {};
}

export async function deleteBlogPost(id: string) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'blog', 'edit');
  const isAdmin = ['admin', 'super_admin'].includes(profile.role);
  if (!isAdmin && !perm.allowed) {
    return { error: perm.error || 'You do not have permission to delete blog posts.' };
  }

  const supabase = await createClient();

  // 1. Try RPC soft_delete_blog_post
  const { error: rpcError } = await supabase.rpc('soft_delete_blog_post', {
    post_id: id,
  });

  // 2. Fallback to direct update if RPC is pending migration
  if (rpcError) {
    let { error } = await supabase
      .from('blog_posts')
      .update({ is_deleted: true, status: 'archived', updated_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error && error.message?.includes('is_deleted')) {
      const fallback = await supabase
        .from('blog_posts')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', id);
      error = fallback.error;
    }

    if (error) return { error: 'Could not delete post.' };
  }

  // 3. Fallback tracking in website_settings so post is guaranteed soft-deleted
  try {
    await supabase.from('website_settings').upsert({
      key: `deleted_blog_${id}`,
      value: { is_deleted: true, deleted_at: new Date().toISOString() },
    });
  } catch (err) {
    console.warn('Failed to record deleted_blog marker:', err);
  }

  revalidatePath('/travinco_dashboard/blog');
  revalidatePath(`/travinco_dashboard/blog/${id}`);
  revalidatePath('/');
  return {};
}

export type BulkBlogPostInput = {
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  cover_image_url?: string | null;
  status?: ContentStatus;
};

export async function bulkCreateBlogPosts(
  items: BulkBlogPostInput[]
): Promise<{ error?: string; count?: number; ids?: string[] }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'blog', 'edit');
  if (!perm.allowed) {
    return { error: perm.error || 'You do not have permission to create blog posts.' };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Please provide at least one blog post to save.' };
  }

  // Filter items with a valid title (minimum 3 characters)
  const candidates = items.filter((b) => b && typeof b.title === 'string' && b.title.trim().length >= 3);
  if (candidates.length === 0) {
    return { error: 'Each blog post must have a valid title (at least 3 characters).' };
  }

  const supabase = await createClient();

  // Fetch all existing post slugs to prevent duplicate slugs
  const { data: existingPosts } = await supabase.from('blog_posts').select('slug');
  const usedSlugs = new Set((existingPosts || []).map((p: any) => (p.slug || '').toLowerCase()));

  // Prepare payload with unique slugs and proper defaults
  const payload = candidates.map((item) => {
    const rawTitle = item.title.trim();
    let baseSlug = item.slug ? slugify(item.slug) : slugify(rawTitle);
    if (!baseSlug) baseSlug = 'blog-post';
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    usedSlugs.add(slug);

    return {
      title: rawTitle,
      slug,
      excerpt: item.excerpt ? item.excerpt.trim() : null,
      content: item.content ? item.content.trim() : null,
      cover_image_url: item.cover_image_url || null,
      status: (item.status === 'published' ? 'published' : 'draft') as ContentStatus,
      created_by: profile.id,
    };
  });

  const { data, error } = await supabase
    .from('blog_posts')
    .insert(payload)
    .select('id');

  if (error) {
    console.error('Error in bulkCreateBlogPosts:', error);
    return { error: error.message || 'Could not bulk create blog posts. Please try again.' };
  }

  revalidatePath('/travinco_dashboard/blog');
  revalidatePath('/');
  revalidatePath('/blog');

  return { count: data?.length ?? payload.length, ids: (data || []).map((d: any) => d.id) };
}
