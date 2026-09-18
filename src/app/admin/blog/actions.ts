'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { blogPostSchema } from '@/lib/validations/content';
import { revalidatePath } from 'next/cache';
import type { ContentStatus } from '@/types/database';

export async function createBlogPost(raw: unknown) {
  const profile = await requireProfile();
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

  revalidatePath('/admin/blog');
  revalidatePath('/');
  return { id: data.id };
}

export async function updateBlogPost(id: string, raw: unknown) {
  await requireProfile();
  const parsed = blogPostSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('blog_posts')
    .update({ ...parsed.data, cover_image_url: parsed.data.cover_image_url || null })
    .eq('id', id);

  if (error) return { error: 'Could not update post.' };
  revalidatePath('/admin/blog');
  revalidatePath(`/admin/blog/${id}`);
  revalidatePath('/');
  return {};
}

export async function setBlogPostStatus(id: string, status: ContentStatus) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('blog_posts').update({ status }).eq('id', id);
  if (error) return { error: 'Could not update status.' };
  revalidatePath('/admin/blog');
  revalidatePath('/');
  return {};
}

export async function deleteBlogPost(id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  if (error) return { error: 'Could not delete post.' };
  revalidatePath('/admin/blog');
  revalidatePath('/');
  return {};
}
