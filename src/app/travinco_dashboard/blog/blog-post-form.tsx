'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HField } from '@/components/admin/horizontal-field';
import { slugify } from '@/lib/validations/package';
import type { BlogPostFormValues } from '@/lib/validations/content';
import { createBlogPost, updateBlogPost } from './actions';
import { uploadBlogImage } from './upload-actions';

export function BlogPostForm({
  postId,
  initialValues,
}: {
  postId?: string;
  initialValues?: Partial<BlogPostFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(postId));
  const [showSlugField, setShowSlugField] = useState(Boolean(postId));
  const [values, setValues] = useState<Partial<BlogPostFormValues>>(initialValues ?? {});

  function set<K extends keyof BlogPostFormValues>(key: K, value: BlogPostFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleCoverImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.set('file', file);
    const result = await uploadBlogImage(formData);
    if (result.error) {
      toast.error(result.error);
    } else if (result.url) {
      set('cover_image_url', result.url);
      toast.success('Cover image uploaded');
    }
    setIsUploading(false);
    e.target.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = postId ? await updateBlogPost(postId, values) : await createBlogPost(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(postId ? 'Post updated' : 'Post created as draft');
      if (!postId && 'id' in result && result.id) {
        router.push(`/travinco_dashboard/blog/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3 p-4 sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
        <HField label="Title" required htmlFor="blog-title" labelWidth="sm:w-28">
          <input
            id="blog-title"
            required
            className="input"
            value={values.title ?? ''}
            onChange={(e) => {
              set('title', e.target.value);
              if (!slugTouched) set('slug', slugify(e.target.value));
            }}
          />
        </HField>

        {!showSlugField ? (
          <div className="flex items-center sm:pl-[7.75rem] lg:pl-0">
            <button
              type="button"
              onClick={() => setShowSlugField(true)}
              className="text-xs text-brand-600 hover:underline"
            >
              Customize page URL
            </button>
          </div>
        ) : (
          <HField label="Slug (URL)" required htmlFor="blog-slug" labelWidth="sm:w-28 lg:w-20">
            <input
              id="blog-slug"
              required
              className="input"
              title="Used in the public URL, e.g. /blog/kerala-monsoon-travel-tips"
              value={values.slug ?? ''}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
            />
          </HField>
        )}
      </div>

      <HField
        label="Excerpt"
        htmlFor="blog-excerpt"
        labelWidth="sm:w-28"
      >
        <textarea
          id="blog-excerpt"
          rows={2}
          maxLength={500}
          placeholder="Shown on the homepage card — keep it under 500 characters."
          className="input resize-y"
          value={values.excerpt ?? ''}
          onChange={(e) => set('excerpt', e.target.value)}
        />
      </HField>

      <HField label="Cover image" labelWidth="sm:w-28">
        <div className="flex flex-wrap items-center gap-3">
          {values.cover_image_url && (
            <div className="h-14 w-24 overflow-hidden rounded-lg border border-ink-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={values.cover_image_url} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCoverImageSelect}
            disabled={isUploading}
            className="block text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
          {isUploading && <p className="text-xs text-brand-600">Uploading…</p>}
        </div>
      </HField>

      <HField
        label="Post content"
        htmlFor="blog-content"
        labelWidth="sm:w-28"
      >
        <textarea
          id="blog-content"
          rows={8}
          placeholder="Plain text or simple paragraphs — each blank line becomes a new paragraph on the post page."
          className="input resize-y"
          value={values.content ?? ''}
          onChange={(e) => set('content', e.target.value)}
        />
      </HField>

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : postId ? 'Save changes' : 'Create draft'}
        </button>
      </div>
    </form>
  );
}
