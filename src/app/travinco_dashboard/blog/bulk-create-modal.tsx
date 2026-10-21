'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { TextField, TextAreaField } from '@/components/ui/form-fields';
import { bulkCreateBlogPosts, type BulkBlogPostInput } from './actions';
import { uploadBlogImage } from './upload-actions';
import { slugify } from '@/lib/validations/package';
import type { ContentStatus } from '@/types/database';

export type BulkBlogCard = {
  id: string;
  title: string;
  slug: string;
  slugTouched: boolean;
  showSlugField: boolean;
  excerpt: string;
  cover_image_url: string;
  content: string;
  status: ContentStatus;
  isCollapsed: boolean;
};

function createEmptyBlogCard(): BulkBlogCard {
  return {
    id: Math.random().toString(36).substring(2, 9),
    title: '',
    slug: '',
    slugTouched: false,
    showSlugField: false,
    excerpt: '',
    cover_image_url: '',
    content: '',
    status: 'draft',
    isCollapsed: false,
  };
}

interface BulkCreateBlogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BulkCreateBlogsModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkCreateBlogsModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cards, setCards] = useState<BulkBlogCard[]>([
    createEmptyBlogCard(),
    createEmptyBlogCard(),
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleCardImageUpload(index: number, file: File) {
    const card = cards[index];
    if (!card) return;
    setUploadingCardId(card.id);
    const formData = new FormData();
    formData.set('file', file);
    const res = await uploadBlogImage(formData);
    if (res.error) {
      toast.error(res.error);
    } else if (res.url) {
      updateCard(index, 'cover_image_url', res.url);
      toast.success('Cover image uploaded');
    }
    setUploadingCardId(null);
  }

  function updateCard<K extends keyof BulkBlogCard>(
    index: number,
    field: K,
    value: BulkBlogCard[K]
  ) {
    setCards((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const updated = { ...c, [field]: value };
        if (field === 'title' && typeof value === 'string' && !c.slugTouched) {
          updated.slug = slugify(value);
        }
        return updated;
      })
    );
  }

  function addCard() {
    setCards((prev) => [...prev, createEmptyBlogCard()]);
  }

  function addMultipleCards(count: number) {
    setCards((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => createEmptyBlogCard()),
    ]);
  }

  function duplicateCard(index: number) {
    setCards((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const clone: BulkBlogCard = {
        ...source,
        id: Math.random().toString(36).substring(2, 9),
        title: source.title ? `${source.title} (Copy)` : '',
        slug: source.slug ? `${source.slug}-copy` : '',
        slugTouched: true,
        showSlugField: true,
      };
      const copy = [...prev];
      copy.splice(index + 1, 0, clone);
      return copy;
    });
  }

  function removeCard(index: number) {
    if (cards.length <= 1) {
      setCards([createEmptyBlogCard()]);
      return;
    }
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  function clearEmptyCards() {
    const valid = cards.filter((c) => c.title.trim().length > 0);
    setCards(valid.length > 0 ? valid : [createEmptyBlogCard()]);
  }

  function handleBulkSave() {
    setFormError(null);

    const validCards = cards.filter((c) => c.title.trim().length > 0);
    if (validCards.length === 0) {
      setFormError('Please enter at least one blog post with a title.');
      return;
    }

    const invalidTitle = validCards.find((c) => c.title.trim().length < 3);
    if (invalidTitle) {
      setFormError(`"${invalidTitle.title}" is too short. Titles must be at least 3 characters.`);
      return;
    }

    const payload: BulkBlogPostInput[] = validCards.map((c) => ({
      title: c.title.trim(),
      slug: c.slug.trim() || slugify(c.title.trim()),
      excerpt: c.excerpt.trim() || null,
      content: c.content.trim() || null,
      cover_image_url: c.cover_image_url.trim() || null,
      status: c.status,
    }));

    startTransition(async () => {
      const res = await bulkCreateBlogPosts(payload);
      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
      } else {
        toast.success(`Successfully saved ${res.count ?? validCards.length} blog posts!`);
        router.refresh();
        if (onSuccess) onSuccess();
        onClose();
      }
    });
  }

  const validCount = cards.filter((c) => c.title.trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-ink-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-5 sm:px-6 py-4 bg-ink-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-2xs">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink-900">Bulk Create Blog Posts</h2>
                <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                  Batch Mode
                </span>
              </div>
              <p className="text-xs text-ink-500">
                Quickly add multiple blog articles with excerpts, cover images, and content at once.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 border border-brand-200">
              {cards.length} post{cards.length !== 1 ? 's' : ''} in queue
            </span>

            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {formError && (
            <div className="flex items-center gap-2.5 rounded-xl border border-coral-200 bg-coral-50 p-3 text-xs text-coral-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-coral-600" />
              <span className="font-medium">{formError}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* List of Blog Form Cards */}
            <div className="space-y-4">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  className="card space-y-4 p-5 bg-white border border-ink-150 rounded-xl shadow-2xs relative transition-all"
                >
                  {/* Card Top Bar with Title, Status & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 border border-brand-200">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-ink-900">
                          {card.title.trim() ? card.title : `Blog Post #${index + 1}`}
                        </h3>
                        {card.slug && (
                          <span className="text-[11px] text-ink-400 font-mono">
                            /{card.slug}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status selector */}
                      <select
                        value={card.status}
                        onChange={(e) =>
                          updateCard(index, 'status', e.target.value as ContentStatus)
                        }
                        className={`input h-8 text-xs py-1 px-2.5 font-medium cursor-pointer ${
                          card.status === 'published'
                            ? 'text-emerald-700 bg-emerald-50/60 border-emerald-200'
                            : 'text-ink-600'
                        }`}
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>

                      {/* Duplicate */}
                      <button
                        type="button"
                        onClick={() => duplicateCard(index)}
                        title="Duplicate post"
                        className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 hover:bg-brand-50 hover:text-brand-700 transition cursor-pointer"
                      >
                        <Copy className="h-3 w-3" />
                        <span className="hidden sm:inline">Duplicate</span>
                      </button>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeCard(index)}
                        title="Remove post"
                        className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-coral-600 hover:bg-coral-50 hover:border-coral-200 transition cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>

                      {/* Toggle Collapse */}
                      <button
                        type="button"
                        onClick={() => updateCard(index, 'isCollapsed', !card.isCollapsed)}
                        title={card.isCollapsed ? 'Expand details' : 'Collapse'}
                        className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 transition cursor-pointer"
                      >
                        {card.isCollapsed ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Exact fields from BlogPostForm */}
                  {!card.isCollapsed && (
                    <div className="space-y-4 pt-1">
                      {/* 1. Title */}
                      <TextField
                        label="Title"
                        required
                        placeholder="e.g. 10 Best Places to Visit in Kerala During Monsoon"
                        value={card.title}
                        onChange={(e) => updateCard(index, 'title', e.target.value)}
                      />

                      {/* 2. Slug (URL) with Customize toggle */}
                      <div>
                        {!card.showSlugField ? (
                          <button
                            type="button"
                            onClick={() => updateCard(index, 'showSlugField', true)}
                            className="text-xs text-brand-600 hover:underline"
                          >
                            Customize page URL
                          </button>
                        ) : (
                          <TextField
                            label="Slug (URL)"
                            required
                            value={card.slug}
                            onChange={(e) => {
                              updateCard(index, 'slugTouched', true);
                              updateCard(index, 'slug', slugify(e.target.value));
                            }}
                            hint="Used in the public URL, e.g. /blog/kerala-monsoon-travel-tips."
                          />
                        )}
                      </div>

                      {/* 3. Excerpt */}
                      <TextAreaField
                        label="Excerpt"
                        rows={2}
                        placeholder="Short summary displayed on cards and search results…"
                        value={card.excerpt}
                        onChange={(e) => updateCard(index, 'excerpt', e.target.value)}
                        hint="Shown on the homepage card — keep it under 500 characters."
                      />

                      {/* 4. Cover image upload & preview */}
                      <div>
                        <label className="label">Cover image</label>
                        {card.cover_image_url && (
                          <div className="mb-2 relative h-36 w-full max-w-sm overflow-hidden rounded-lg border border-ink-100 group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={card.cover_image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => updateCard(index, 'cover_image_url', '')}
                              className="absolute top-1.5 right-1.5 rounded-full bg-ink-900/70 p-1 text-white hover:bg-coral-600 transition"
                              title="Remove image"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCardImageUpload(index, file);
                            e.target.value = '';
                          }}
                          disabled={uploadingCardId === card.id || isPending}
                          className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                        />
                        {uploadingCardId === card.id && (
                          <p className="mt-1.5 text-xs text-brand-600 flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Uploading…</span>
                          </p>
                        )}
                      </div>

                      {/* 5. Post Content */}
                      <TextAreaField
                        label="Post content"
                        rows={6}
                        placeholder="Write article content. Plain text or paragraphs — each blank line becomes a new paragraph on the post page…"
                        value={card.content}
                        onChange={(e) => updateCard(index, 'content', e.target.value)}
                        hint="Plain text or simple paragraphs — each blank line becomes a new paragraph on the post page."
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Add Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addCard}
                  disabled={isPending}
                  className="btn-outline inline-flex items-center gap-1.5 h-9 text-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4 text-brand-600" />
                  <span>Add Another Post</span>
                </button>
                <button
                  type="button"
                  onClick={() => addMultipleCards(3)}
                  disabled={isPending}
                  className="btn-outline inline-flex items-center gap-1.5 h-9 text-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add 3 Posts</span>
                </button>
                <button
                  type="button"
                  onClick={clearEmptyCards}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-ink-500 hover:text-ink-800 transition cursor-pointer"
                >
                  <span>Clear empty</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-ink-500">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                <span>Unique URL slugs are automatically generated from post titles.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-ink-100 px-5 sm:px-6 py-3.5 bg-ink-50/70">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-500">
              Ready to save:
            </span>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-200">
              {validCount} post{validCount !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-outline h-9 text-xs px-4 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleBulkSave}
              disabled={validCount === 0 || isPending}
              className="btn-primary inline-flex items-center gap-2 h-9 text-xs px-5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving {validCount} posts…</span>
                </>
              ) : (
                <>
                  <Layers className="h-3.5 w-3.5" />
                  <span>Bulk Save {validCount > 0 ? `(${validCount})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BulkCreateBlogsButton({
  className = '',
}: {
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`btn-outline inline-flex items-center gap-2 shadow-2xs hover:shadow-xs transition cursor-pointer ${className}`}
        title="Quickly add multiple blog posts at once"
      >
        <Layers className="h-4 w-4 text-brand-600" />
        <span>Bulk create</span>
      </button>

      <BulkCreateBlogsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
