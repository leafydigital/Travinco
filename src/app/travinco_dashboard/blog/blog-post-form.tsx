'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField } from '@/components/ui/form-fields';
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
        router.push(`/admin/blog/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="card space-y-4 p-5">
        <TextField
          label="Title"
          required
          value={values.title ?? ''}
          onChange={(e) => {
            set('title', e.target.value);
            if (!slugTouched) set('slug', slugify(e.target.value));
          }}
        />

        <div>
          {!showSlugField ? (
            <button
              type="button"
              onClick={() => setShowSlugField(true)}
              className="text-xs text-brand-600 hover:underline"
            >
              Customize page URL
            </button>
          ) : (
            <TextField
              label="Slug (URL)"
              required
              value={values.slug ?? ''}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
              hint="Used in the public URL, e.g. /blog/kerala-monsoon-travel-tips."
            />
          )}
        </div>

        <TextAreaField
          label="Excerpt"
          rows={2}
          value={values.excerpt ?? ''}
          onChange={(e) => set('excerpt', e.target.value)}
          hint="Shown on the homepage card — keep it under 500 characters."
        />
      </div>

      <div className="card space-y-3 p-5">
        <label className="label">Cover image</label>
        {values.cover_image_url && (
          <div className="h-40 w-full max-w-sm overflow-hidden rounded-lg border border-ink-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={values.cover_image_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleCoverImageSelect}
          disabled={isUploading}
          className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {isUploading && <p className="text-xs text-brand-600">Uploading…</p>}
      </div>

      <div className="card space-y-4 p-5">
        <TextAreaField
          label="Post content"
          rows={14}
          value={values.content ?? ''}
          onChange={(e) => set('content', e.target.value)}
          hint="Plain text or simple paragraphs — each blank line becomes a new paragraph on the post page."
        />
      </div>

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : postId ? 'Save changes' : 'Create draft'}
        </button>
      </div>
    </form>
  );
}
