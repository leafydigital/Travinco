'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Pencil,
  Tag,
  Compass,
  Info,
  Save,
  Upload,
  BookOpen,
  Search,
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import type {
  BlogPageContent,
  BlogHeroPillar,
} from '@/lib/blog-page-content-types';
import { DEFAULT_BLOG_PAGE_CONTENT } from '@/lib/blog-page-content-types';
import {
  saveBlogPageContentAction,
  uploadBlogHeroImageAction,
} from './actions';
import { ModalPortal } from '@/components/ui/modal-portal';

interface BlogPageEditorProps {
  initialContent?: BlogPageContent;
  isAdmin?: boolean;
}

export function BlogPageEditor({
  initialContent = DEFAULT_BLOG_PAGE_CONTENT,
  isAdmin = true,
}: BlogPageEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<BlogPageContent>(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Image upload handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be under 10MB.');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const res = await uploadBlogHeroImageAction(formData);
      if (!res.success || !res.url) {
        toast.error(res.error || 'Failed to upload hero background image.');
        return;
      }

      setContent((prev) => ({
        ...prev,
        hero: {
          ...prev.hero,
          background_image_url: res.url!,
        },
      }));
      toast.success('Blog hero background image uploaded successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Error uploading image.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Pillar change
  const handlePillarChange = (index: number, field: keyof BlogHeroPillar, value: string) => {
    setContent((prev) => {
      const updated = [...prev.hero.pillars];
      const current = updated[index] || { icon_key: 'book', label: '' };
      updated[index] = {
        ...current,
        [field]: value,
      } as BlogHeroPillar;
      return {
        ...prev,
        hero: {
          ...prev.hero,
          pillars: updated,
        },
      };
    });
  };

  // Save changes execution
  const executeSave = async () => {
    setShowConfirmModal(false);
    try {
      setIsSaving(true);
      const res = await saveBlogPageContentAction(content);
      if (!res.success) {
        toast.error(res.error || 'Failed to save blog page content.');
        return;
      }
      toast.success('Blog page content & hero visuals saved successfully!');
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save blog page content.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Top Bar: Title & Actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-ink-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200">
              <Pencil className="h-3 w-3" />
              Theme Editor
            </span>
            <span className="text-xs text-ink-400 font-medium">• /blog page</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-950 mt-1">
            Blog Page Visuals &amp; Content
          </h2>
          <p className="text-xs sm:text-sm text-ink-600 mt-0.5">
            Customize the Blog hero background photo, centered typography, highlights, search placeholder, and bottom CTA banner.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={isSaving || !isAdmin}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving…' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* ── Info Box: DB connection note ── */}
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 text-emerald-900 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <strong className="font-semibold text-emerald-950">
            Dynamic Articles From Database:
          </strong>{' '}
          All blog posts, covers, excerpts, authors, and dates are fetched directly from your active database (`blog_posts`). The settings below customize the surrounding hero section background image, centered text, search bar hints, and promotional banners.
        </div>
      </div>

      {/* ── 1. HERO SECTION & BACKGROUND IMAGE ── */}
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-ink-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink-950">
                1. Hero Section &amp; Background Image
              </h3>
              <p className="text-xs text-ink-500">
                Visual header with centered typography and luxury background photo.
              </p>
            </div>
          </div>
        </div>

        {/* Live Preview Box */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
            Live Hero Preview
          </label>
          <div className="relative overflow-hidden rounded-2xl bg-navy-950 text-white min-h-[220px] sm:min-h-[260px] flex flex-col items-center justify-center text-center p-6 sm:p-8 border border-white/10 shadow-lg">
            {/* Background Image with Dark Luxury Overlay */}
            {content.hero.background_image_url && (
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-300 transform scale-100"
                style={{ backgroundImage: `url(${content.hero.background_image_url})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950/90 backdrop-blur-[1px]" />
              </div>
            )}

            <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
              {content.hero.badge && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-sand-300 border border-white/20 mb-3 shadow-xs">
                  <Tag className="h-3 w-3 text-sand-300" />
                  <span>{content.hero.badge}</span>
                </span>
              )}

              <h1 className="font-display text-2xl sm:text-4xl font-extrabold uppercase text-white tracking-tight drop-shadow-md">
                {content.hero.title || 'BLOG & STORIES'}
              </h1>

              {content.hero.subtitle && (
                <p className="mt-2 text-xs sm:text-sm text-white/80 font-light max-w-lg leading-relaxed">
                  {content.hero.subtitle}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/70">
                {content.hero.pillars.map((pillar, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5 text-brand-300" />
                    <span>{pillar.label}</span>
                    {i < content.hero.pillars.length - 1 && (
                      <span className="ml-2 text-white/30">•</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Hero Background Image Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* File Upload Button */}
          <div className="rounded-xl border border-dashed border-ink-200 bg-sand-50/50 p-4 space-y-3">
            <label className="block text-xs font-bold text-ink-900">
              Upload New Hero Background Photo
            </label>
            <p className="text-xs text-ink-500">
              Recommended: high-resolution landscape photo (1920×1080px or higher, JPG/WebP).
            </p>
            <div className="flex items-center gap-3">
              <label className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer shadow-xs">
                <Upload className="h-4 w-4 text-brand-600" />
                <span>{isUploading ? 'Uploading…' : 'Choose & Upload File'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFileChange}
                  disabled={isUploading || !isAdmin}
                  className="hidden"
                />
              </label>
              {content.hero.background_image_url && (
                <span className="text-[11px] text-ink-400 truncate max-w-[200px]">
                  Current image connected
                </span>
              )}
            </div>
          </div>

          {/* Direct URL Input */}
          <div className="rounded-xl border border-ink-200 bg-white p-4 space-y-2">
            <label className="block text-xs font-bold text-ink-900">
              Or Paste Direct Background Image URL
            </label>
            <p className="text-xs text-ink-500">
              Enter any accessible public image URL (Unsplash, Supabase CDN, etc.).
            </p>
            <input
              type="text"
              value={content.hero.background_image_url}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, background_image_url: e.target.value },
                }))
              }
              placeholder="https://images.unsplash.com/photo-..."
              className="input text-xs sm:text-sm font-mono"
            />
          </div>
        </div>

        {/* Centered Typography Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-ink-100">
          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Hero Top Badge
            </label>
            <input
              type="text"
              value={content.hero.badge}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, badge: e.target.value },
                }))
              }
              placeholder="Traveler Journals & Destination Guides"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Hero Center Title (Primary Heading)
            </label>
            <input
              type="text"
              value={content.hero.title}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, title: e.target.value },
                }))
              }
              placeholder="BLOG & STORIES"
              className="input text-xs sm:text-sm uppercase font-bold"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Hero Subtitle / Description
            </label>
            <textarea
              rows={2}
              value={content.hero.subtitle}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, subtitle: e.target.value },
                }))
              }
              placeholder="Inspirational itineraries, hidden cultural gems, insider wellness secrets..."
              className="input text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Hero Highlights / Pillars */}
        <div className="space-y-3 pt-3 border-t border-ink-100">
          <label className="block text-xs font-bold text-ink-900">
            Hero Trust Pillars / Highlights (Below Subtitle)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {content.hero.pillars.map((pillar, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-ink-50/70 p-2.5 border border-ink-200">
                <input
                  type="text"
                  value={pillar.label}
                  onChange={(e) => handlePillarChange(i, 'label', e.target.value)}
                  placeholder={`Pillar ${i + 1}`}
                  className="input text-xs bg-white h-8"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. SEARCH BAR & EMPTY STATE ── */}
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-ink-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink-950">
                2. Search Filter &amp; Zero State Copy
              </h3>
              <p className="text-xs text-ink-500">
                Configure the customer search bar placeholder and fallback messages when no blogs match.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Search Input Placeholder Hint
            </label>
            <input
              type="text"
              value={content.search.placeholder}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  search: { ...prev.search, placeholder: e.target.value },
                }))
              }
              placeholder="Search travel stories, destinations, or tips (e.g. Kerala, Ayurveda, Monsoon)..."
              className="input text-xs sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-ink-900 mb-1">
                Zero State Heading
              </label>
              <input
                type="text"
                value={content.empty_state.title}
                onChange={(e) =>
                  setContent((prev) => ({
                    ...prev,
                    empty_state: { ...prev.empty_state, title: e.target.value },
                  }))
                }
                placeholder="No articles found"
                className="input text-xs sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-ink-900 mb-1">
                Zero State Description
              </label>
              <input
                type="text"
                value={content.empty_state.description}
                onChange={(e) =>
                  setContent((prev) => ({
                    ...prev,
                    empty_state: { ...prev.empty_state, description: e.target.value },
                  }))
                }
                placeholder="We couldn’t find any blog articles matching your search..."
                className="input text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-900 mb-1">
                Zero State Reset Button Text
              </label>
              <input
                type="text"
                value={content.empty_state.button_text || ''}
                onChange={(e) =>
                  setContent((prev) => ({
                    ...prev,
                    empty_state: { ...prev.empty_state, button_text: e.target.value },
                  }))
                }
                placeholder="Show All Articles"
                className="input text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Live Zero State Preview */}
          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
              Live Zero State Preview (When Search Has 0 Matches)
            </label>
            <div className="rounded-2xl border border-dashed border-ink-200 bg-sand-50/50 p-6 text-center space-y-3 max-w-md mx-auto">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-display text-sm font-bold text-ink-900">
                  {content.empty_state.title || 'No articles found'}
                </h4>
                <p className="text-xs text-ink-500 leading-relaxed">
                  {content.empty_state.description ||
                    'We couldn’t find any blog articles matching your search. Try another topic or browse all stories.'}
                </p>
              </div>
              <div className="pt-1">
                <span className="btn-primary inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl shadow-xs">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{content.empty_state.button_text || 'Show All Articles'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. BOTTOM CTA BANNER ── */}
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-ink-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink-950">
                3. Bottom Call To Action Banner
              </h3>
              <p className="text-xs text-ink-500">
                Promote custom holiday inquiries and bespoke bookings at the bottom of the blog list.
              </p>
            </div>
          </div>
        </div>

        {/* Live CTA Banner Preview */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
            Live Banner Preview
          </label>
          <div className="relative overflow-hidden rounded-2xl bg-navy-950 text-white p-6 sm:p-8 border border-white/10 shadow-lg">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-xl space-y-3">
              {content.bottom_cta.badge && (
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sand-300 border border-white/20 shadow-xs">
                  {content.bottom_cta.badge}
                </span>
              )}
              <h4 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
                {content.bottom_cta.title}
              </h4>
              {content.bottom_cta.description && (
                <p className="text-xs sm:text-sm text-white/80 font-light leading-relaxed">
                  {content.bottom_cta.description}
                </p>
              )}
              <div className="pt-2 flex items-center gap-3">
                <span className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl shadow-md">
                  <span>{content.bottom_cta.button_text || 'Plan My Journey'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Banner Small Badge
            </label>
            <input
              type="text"
              value={content.bottom_cta.badge}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  bottom_cta: { ...prev.bottom_cta, badge: e.target.value },
                }))
              }
              placeholder="Inspired by our stories?"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Banner Main Heading
            </label>
            <input
              type="text"
              value={content.bottom_cta.title}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  bottom_cta: { ...prev.bottom_cta, title: e.target.value },
                }))
              }
              placeholder="Turn these travel stories into your own reality"
              className="input text-xs sm:text-sm font-semibold"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Banner Description
            </label>
            <textarea
              rows={2}
              value={content.bottom_cta.description}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  bottom_cta: { ...prev.bottom_cta, description: e.target.value },
                }))
              }
              placeholder="Let our trip planners craft a private, customized tour..."
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              CTA Button Text
            </label>
            <input
              type="text"
              value={content.bottom_cta.button_text}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  bottom_cta: { ...prev.bottom_cta, button_text: e.target.value },
                }))
              }
              placeholder="Plan My Journey"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              CTA Button Link
            </label>
            <input
              type="text"
              value={content.bottom_cta.button_link}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  bottom_cta: { ...prev.bottom_cta, button_link: e.target.value },
                }))
              }
              placeholder="/booking"
              className="input text-xs sm:text-sm font-mono"
            />
          </div>
        </div>
      </section>

      {/* ── Bottom Save Sticky Bar ── */}
      <div className="sticky bottom-4 z-30 flex items-center justify-between rounded-2xl bg-navy-950/90 backdrop-blur-md p-4 text-white shadow-lg shadow-ink-900/5 border border-white/10">
        <div className="flex items-center gap-2 text-xs">
          <Info className="h-4 w-4 text-sand-300" />
          <span className="font-medium text-white/90">
            Unsaved changes will be published to the customer Blog page when saved.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          disabled={isSaving || !isAdmin}
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Saving…' : 'Save Changes'}</span>
        </button>
      </div>

      {/* ── Save Confirmation Modal (Small width modal) ── */}
      {showConfirmModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
            onClick={() => setShowConfirmModal(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="card p-6 border-brand-200 bg-white shadow-lg shadow-ink-900/5 space-y-4 rounded-3xl w-full max-w-md animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Save className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink-900">
                      Publish Blog Page Changes?
                    </h3>
                    <p className="text-xs text-ink-500">
                      Confirm your updates
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-600 hover:bg-ink-200 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
  
              <p className="text-xs text-ink-600 leading-relaxed">
                Are you sure you want to save these changes? The new hero visuals, background image, typography, and promotional content will be applied immediately to the live customer Blog page.
              </p>
  
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSaving}
                  className="btn-ghost text-xs px-4 py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeSave}
                  disabled={isSaving}
                  className="btn-primary inline-flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? 'Saving…' : 'Yes, Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
