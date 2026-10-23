'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Pencil,
  Tag,
  Info,
  Save,
  Upload,
  ShieldCheck,
  Compass,
  Star,
  Search,
  Layers,
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  PackagesPageContent,
  PackagesHeroPillar,
} from '@/lib/packages-page-content-types';
import { DEFAULT_PACKAGES_PAGE_CONTENT } from '@/lib/packages-page-content-types';
import {
  savePackagesPageContentAction,
  uploadPackageHeroImageAction,
} from './actions';

interface PackagesPageEditorProps {
  initialContent?: PackagesPageContent;
  isAdmin?: boolean;
}

export function PackagesPageEditor({
  initialContent = DEFAULT_PACKAGES_PAGE_CONTENT,
  isAdmin = true,
}: PackagesPageEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<PackagesPageContent>(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

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

      const res = await uploadPackageHeroImageAction(formData);
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
      toast.success('Hero background image uploaded successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Error uploading image.');
    } finally {
      setIsUploading(false);
      // Reset input value so same file can be re-selected if desired
      e.target.value = '';
    }
  };

  // Pillar change
  const handlePillarChange = (index: number, field: keyof PackagesHeroPillar, value: string) => {
    setContent((prev) => {
      const updated = [...prev.hero.pillars];
      const current = updated[index] || { icon_key: 'shield', label: '' };
      updated[index] = {
        ...current,
        [field]: value,
      } as PackagesHeroPillar;
      return {
        ...prev,
        hero: {
          ...prev.hero,
          pillars: updated,
        },
      };
    });
  };

  // Save changes
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await savePackagesPageContentAction(content);
      if (!res.success) {
        toast.error(res.error || 'Failed to save packages page content.');
        return;
      }
      toast.success('Packages page content & hero background saved successfully!');
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save packages page content.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Top Bar: Title, Live Link, Actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-ink-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200">
              <Pencil className="h-3 w-3" />
              Theme Editor
            </span>
            <span className="text-xs text-ink-400 font-medium">• /packages page</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-950 mt-1">
            Package Page Visuals &amp; Content
          </h2>
          <p className="text-xs sm:text-sm text-ink-600 mt-0.5">
            Customize the Hero background photo, centered typography, trust pillars, search placeholder, and bottom CTA banner.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleSave}
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
            Dynamic Packages From Database:
          </strong>{' '}
          All travel package cards, images, prices, destinations, and duration details are fetched directly from your active database. The settings below customize the surrounding hero section background image, centered text, search bar hints, and promotional banners.
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
                {content.hero.title || 'PACKAGES'}
              </h1>

              {content.hero.subtitle && (
                <p className="mt-2 text-xs sm:text-sm text-white/80 font-light max-w-lg leading-relaxed">
                  {content.hero.subtitle}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/70">
                {content.hero.pillars.map((pillar, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
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
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              {isUploading && (
                <span className="text-xs font-medium text-brand-700 animate-pulse">
                  Uploading image to server…
                </span>
              )}
            </div>
          </div>

          {/* Or Image URL Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-ink-900">
              Hero Background Image URL
            </label>
            <input
              type="url"
              value={content.hero.background_image_url}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, background_image_url: e.target.value },
                }))
              }
              placeholder="https://..."
              className="input text-xs sm:text-sm font-mono"
            />
            <p className="text-[11px] text-ink-400">
              You can paste any direct CDN or Unsplash image URL.
            </p>
          </div>
        </div>

        {/* Hero Typography Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Top Badge Text
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
              placeholder="Curated Vacations & Handcrafted Itineraries"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Hero Main Heading (Centered)
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
              placeholder="PACKAGES"
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
              placeholder="Discover our handpicked holiday packages..."
              className="input text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Trust Pillars */}
        <div className="space-y-3 pt-2">
          <label className="block text-xs font-bold text-ink-900">
            Trust Pillars (3 Highlights)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {content.hero.pillars.map((pillar, i) => (
              <div key={i} className="rounded-xl border border-ink-200 p-3 bg-sand-50/40 space-y-1">
                <span className="text-[11px] font-semibold text-ink-400">Pillar #{i + 1}</span>
                <input
                  type="text"
                  value={pillar.label}
                  onChange={(e) => handlePillarChange(i, 'label', e.target.value)}
                  placeholder={`Pillar ${i + 1}`}
                  className="input text-xs h-9"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. SEARCH & EMPTY STATE COPY ── */}
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 border-b border-ink-100 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-50 text-ocean-700">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink-950">
              2. Search Bar &amp; Zero-State Text
            </h3>
            <p className="text-xs text-ink-500">
              Customize the customer search placeholder and zero-results fallback messaging.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Search Input Placeholder
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
              placeholder="Search packages by name (e.g. Munnar, Kerala, Maldives)..."
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              No Results Found Heading
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
              placeholder="No packages found"
              className="input text-xs sm:text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Reset Button Label
            </label>
            <input
              type="text"
              value={content.empty_state.button_text}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  empty_state: { ...prev.empty_state, button_text: e.target.value },
                }))
              }
              placeholder="Show All Packages"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-ink-900 mb-1">
              No Results Found Message
            </label>
            <textarea
              rows={2}
              value={content.empty_state.description}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  empty_state: { ...prev.empty_state, description: e.target.value },
                }))
              }
              placeholder="We couldn't find any packages matching your search..."
              className="input text-xs sm:text-sm"
            />
          </div>
        </div>
      </section>

      {/* ── 3. BOTTOM CUSTOM HOLIDAY BANNER ── */}
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 border-b border-ink-100 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sand-100 text-sand-800">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink-950">
              3. Custom Vacation Callout Banner (Bottom of Page)
            </h3>
            <p className="text-xs text-ink-500">
              Displays at the bottom of the packages catalog to convert visitors seeking custom travel routes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Banner Badge / Eyebrow
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
              placeholder="Looking for a custom route?"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Banner Title
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
              placeholder="We design private custom holidays tailored to you"
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
              placeholder="Don't see your dream route? Share your dates..."
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
              placeholder="Request Custom Plan"
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
      <div className="sticky bottom-4 z-30 flex items-center justify-between rounded-2xl bg-navy-950/90 backdrop-blur-md p-4 text-white shadow-2xl border border-white/10">
        <div className="flex items-center gap-2 text-xs">
          <Info className="h-4 w-4 text-sand-300" />
          <span className="font-medium text-white/90">
            Unsaved changes will be published to the customer Packages page when saved.
          </span>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !isAdmin}
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Saving…' : 'Save Changes'}</span>
        </button>
      </div>
    </div>
  );
}
