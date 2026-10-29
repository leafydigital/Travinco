'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Pencil,
  RotateCcw,
  Layout,
  TrendingUp,
  Heart,
  Eye,
  Upload,
  Plus,
  Trash2,
  MapPinned,
  ShieldCheck,
  HeadphonesIcon,
  Wallet,
  ExternalLink,
  Save,
  RefreshCw,
  Compass,
  ArrowRight,
  MapPin,
  SlidersHorizontal,
  Calendar,
  Quote,
  Star,
  BookOpen,
} from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import type {
  HomePageContent,
  HeroContent,
  DestinationsContent,
  ExperienceCard,
  ExperienceStat,
  CapturedRoadContent,
  HowItWorksStep,
  AyurvedaSectionContent,
  TestimonialItem,
  BlogSectionContent,
  FinalCtaContent,
} from '@/lib/home-page-content-types';
import { DEFAULT_HOME_PAGE_CONTENT } from '@/lib/home-page-content-types';
import {
  saveHomePageContentAction,
  deleteThemeImageAction,
  type ThemeImageItem,
} from './actions';
import { formatDate } from '@/lib/utils/format';
import { ModalPortal } from '@/components/ui/modal-portal';

interface DestinationItem {
  id: string;
  name: string;
  slug: string;
  cover_image_url: string | null;
  description: string | null;
}

interface BlogPostItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  created_at: string;
}

interface HomePageEditorProps {
  initialContent: HomePageContent;
  themeImages: ThemeImageItem[];
  destinations: DestinationItem[];
  recentPosts?: BlogPostItem[];
  isAdmin?: boolean;
  lastUploadedImage?: ThemeImageItem | null;
  onOpenUpload: (placement: 'hero' | 'captured_road' | 'ayurveda') => void;
  onDeleteImage?: (item: ThemeImageItem) => void;
}

function getExperienceIcon(key: string) {
  switch (key) {
    case 'shield':
      return ShieldCheck;
    case 'headphones':
      return HeadphonesIcon;
    case 'wallet':
      return Wallet;
    case 'map':
    default:
      return MapPinned;
  }
}

type SectionKey =
  | 'hero'
  | 'destinations'
  | 'experience'
  | 'captured_road'
  | 'how_it_works'
  | 'ayurveda'
  | 'testimonials'
  | 'blog'
  | 'final_cta';

export function HomePageEditor({
  initialContent,
  themeImages,
  destinations,
  recentPosts = [],
  isAdmin = true,
  lastUploadedImage,
  onOpenUpload,
  onDeleteImage,
}: HomePageEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<HomePageContent>(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [activeEditSection, setActiveEditSection] = useState<SectionKey | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const [itemToDelete, setItemToDelete] = useState<ThemeImageItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper to open in-page confirmation modal before deletion
  const handleDeleteImage = (item: ThemeImageItem) => {
    setItemToDelete(item);
  };

  // Execute deletion upon modal confirmation
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const targetItem = itemToDelete;
    const label =
      targetItem.placement === 'hero'
        ? 'Hero Slide'
        : targetItem.placement === 'captured_road'
        ? 'Road Moment'
        : 'Ayurveda Image';

    setIsDeleting(true);
    // Optimistic instant removal from editor and parent state
    setDeletedIds((prev) => new Set([...prev, targetItem.id]));
    if (onDeleteImage) {
      onDeleteImage(targetItem);
    }
    if (content.ayurveda?.image_url === targetItem.image_url) {
      setContent((prev) => ({
        ...prev,
        ayurveda: {
          ...prev.ayurveda,
          image_url: DEFAULT_HOME_PAGE_CONTENT.ayurveda.image_url,
        },
      }));
      setIsDirty(true);
    }

    try {
      const res = await deleteThemeImageAction(targetItem.id);
      if (res.success) {
        toast.success(`${label} deleted permanently.`);
        setItemToDelete(null);
      } else {
        // Revert if error returned
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(targetItem.id);
          return next;
        });
        toast.error(res.error || 'Failed to delete image.');
      }
    } catch (err: any) {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetItem.id);
        return next;
      });
      toast.error('Failed to delete image. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Automatically update Ayurveda background if a new Ayurveda image was just uploaded
  useEffect(() => {
    if (
      lastUploadedImage &&
      lastUploadedImage.page === 'home' &&
      (lastUploadedImage.placement === 'ayurveda' || lastUploadedImage.placement === 'wellness')
    ) {
      setContent((prev) => ({
        ...prev,
        ayurveda: {
          ...(prev.ayurveda || DEFAULT_HOME_PAGE_CONTENT.ayurveda),
          image_url: lastUploadedImage.image_url,
        },
      }));
      setIsDirty(true);
      toast.success(
        'New Ayurveda photo selected as background! Click "Save Ayurveda Section" to publish.'
      );
    }
  }, [lastUploadedImage]);

  // Active hero slides
  const heroImages = useMemo(() => {
    return themeImages.filter(
      (img) => img.page === 'home' && img.placement === 'hero' && img.is_active && !img.is_deleted && !deletedIds.has(img.id)
    );
  }, [themeImages, deletedIds]);

  // Road moment images
  const roadImages = useMemo(() => {
    return themeImages.filter(
      (img) => img.page === 'home' && img.placement === 'captured_road' && img.is_active && !img.is_deleted && !deletedIds.has(img.id)
    );
  }, [themeImages, deletedIds]);

  // Ayurveda images
  const ayurvedaImages = useMemo(() => {
    return themeImages.filter(
      (img) =>
        img.page === 'home' &&
        (img.placement === 'ayurveda' || img.placement === 'wellness') &&
        img.is_active &&
        !img.is_deleted &&
        !deletedIds.has(img.id)
    );
  }, [themeImages, deletedIds]);

  // Helpers to update individual sections
  const updateHero = (field: keyof HeroContent, value: string) => {
    setContent((prev) => ({
      ...prev,
      hero: { ...prev.hero, [field]: value },
    }));
    setIsDirty(true);
  };

  const updateDestinations = (field: keyof DestinationsContent, value: string) => {
    setContent((prev) => ({
      ...prev,
      destinations: { ...prev.destinations, [field]: value },
    }));
    setIsDirty(true);
  };

  const updateExperienceHeader = (field: 'eyebrow' | 'title' | 'description', value: string) => {
    setContent((prev) => ({
      ...prev,
      experience: { ...prev.experience, [field]: value },
    }));
    setIsDirty(true);
  };

  const updateExperienceCard = (index: number, field: keyof ExperienceCard, value: string) => {
    setContent((prev) => {
      const cards = [...prev.experience.cards];
      if (cards[index]) {
        cards[index] = { ...cards[index]!, [field]: value };
      }
      return {
        ...prev,
        experience: { ...prev.experience, cards },
      };
    });
    setIsDirty(true);
  };

  const updateExperienceStat = (index: number, field: keyof ExperienceStat, value: string) => {
    setContent((prev) => {
      const stats = [...(prev.experience.stats || DEFAULT_HOME_PAGE_CONTENT.experience.stats || [])];
      if (stats[index]) {
        stats[index] = { ...stats[index]!, [field]: value };
      }
      return {
        ...prev,
        experience: { ...prev.experience, stats },
      };
    });
    setIsDirty(true);
  };

  const addExperienceStat = () => {
    setContent((prev) => {
      const stats = [...(prev.experience.stats || DEFAULT_HOME_PAGE_CONTENT.experience.stats || [])];
      stats.push({ value: '1,000+', label: 'New Milestone' });
      return {
        ...prev,
        experience: { ...prev.experience, stats },
      };
    });
    setIsDirty(true);
    toast.success('New stat counter added! Remember to save Experience Section.');
  };

  const removeExperienceStat = (index: number) => {
    setContent((prev) => {
      const currentStats = prev.experience.stats || DEFAULT_HOME_PAGE_CONTENT.experience.stats || [];
      if (currentStats.length <= 1) {
        toast.error('You must keep at least one stat.');
        return prev;
      }
      const stats = currentStats.filter((_, i) => i !== index);
      return {
        ...prev,
        experience: { ...prev.experience, stats },
      };
    });
    setIsDirty(true);
  };

  const updateCapturedRoad = (field: keyof CapturedRoadContent, value: string) => {
    setContent((prev) => ({
      ...prev,
      captured_road: { ...prev.captured_road, [field]: value },
    }));
    setIsDirty(true);
  };

  const updateHowItWorksHeader = (field: 'eyebrow' | 'title' | 'description', value: string) => {
    setContent((prev) => ({
      ...prev,
      how_it_works: { ...prev.how_it_works, [field]: value },
    }));
    setIsDirty(true);
  };

  const updateHowItWorksStep = (index: number, field: keyof HowItWorksStep, value: string) => {
    setContent((prev) => {
      const steps = [...prev.how_it_works.steps];
      if (steps[index]) {
        steps[index] = { ...steps[index]!, [field]: value };
      }
      return {
        ...prev,
        how_it_works: { ...prev.how_it_works, steps },
      };
    });
    setIsDirty(true);
  };

  const updateAyurveda = (field: keyof AyurvedaSectionContent, value: string) => {
    setContent((prev) => ({
      ...prev,
      ayurveda: {
        ...(prev.ayurveda || DEFAULT_HOME_PAGE_CONTENT.ayurveda),
        [field]: value,
      },
    }));
    setIsDirty(true);
  };

  const addTestimonialItem = () => {
    setContent((prev) => ({
      ...prev,
      testimonials: {
        ...prev.testimonials,
        items: [
          ...prev.testimonials.items,
          {
            name: 'New Traveler',
            trip: 'Kerala Backwaters & Hills',
            quote: 'Our trip was organized flawlessly from start to finish. Everything was transparent, verified, and deeply memorable.',
            rating: 5,
          },
        ],
      },
    }));
    setIsDirty(true);
    toast.success('New testimonial added! Remember to save changes.');
  };

  const removeTestimonialItem = (index: number) => {
    if (content.testimonials.items.length <= 1) {
      toast.error('You must keep at least one testimonial.');
      return;
    }
    setContent((prev) => ({
      ...prev,
      testimonials: {
        ...prev.testimonials,
        items: prev.testimonials.items.filter((_, i) => i !== index),
      },
    }));
    setIsDirty(true);
    toast.info('Testimonial removed.');
  };

  const updateTestimonialsHeader = (field: 'eyebrow' | 'title' | 'description', value: string) => {
    setContent((prev) => ({
      ...prev,
      testimonials: { ...prev.testimonials, [field]: value },
    }));
    setIsDirty(true);
  };

  const updateTestimonialItem = (index: number, field: keyof TestimonialItem, value: any) => {
    setContent((prev) => {
      const items = [...prev.testimonials.items];
      if (items[index]) {
        items[index] = { ...items[index]!, [field]: value };
      }
      return {
        ...prev,
        testimonials: { ...prev.testimonials, items },
      };
    });
    setIsDirty(true);
  };

  const updateBlog = (field: keyof BlogSectionContent, value: string) => {
    setContent((prev) => ({
      ...prev,
      blog: { ...prev.blog, [field]: value },
    }));
    setIsDirty(true);
  };

  const updateFinalCta = (field: keyof FinalCtaContent, value: string) => {
    setContent((prev) => ({
      ...prev,
      final_cta: { ...prev.final_cta, [field]: value },
    }));
    setIsDirty(true);
  };

  // Save changes to database
  const handleSave = async (sectionName?: string) => {
    setIsSaving(true);
    try {
      const res = await saveHomePageContentAction(content);
      if (res.success && res.data) {
        setContent(res.data);
        setIsDirty(false);
        toast.success(
          sectionName
            ? `${sectionName} saved! Customer home page is updated.`
            : 'Home page content updated successfully!'
        );
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to save home page content.');
      }
    } catch {
      toast.error('An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default factory content
  const handleResetToDefaults = () => {
    if (confirm('Reset all home page text and card copy back to standard factory defaults?')) {
      setContent(DEFAULT_HOME_PAGE_CONTENT);
      setIsDirty(true);
      toast.info('Default copy loaded. Click "Save All Changes" to publish to customer site.');
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Top Floating Action / Status Bar ── */}
      <div className="sticky top-4 z-40 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200/90 bg-white/95 backdrop-blur-md p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
            <Layout className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-ink-900">
                Home Page Live Content Manager & Preview
              </h2>
              {isDirty && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-ink-500">
              Matches customer-facing layout. Edit text directly or upload hero photos below.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving Changes…</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save All Changes</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white text-xs font-bold">
              1
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink-900">Hero Section (100vh Banner)</h3>
              <p className="text-[11px] text-ink-500">
                Full-screen background slider with centered title and CTA button
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenUpload('hero')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 border border-brand-200/80 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition shadow-xs cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-brand-600" />
              <span>+ Upload Hero Photo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEditSection(activeEditSection === 'hero' ? null : 'hero')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeEditSection === 'hero'
                  ? 'bg-ink-900 text-white shadow-xs'
                  : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>{activeEditSection === 'hero' ? 'Close Editor' : 'Edit Hero Text'}</span>
            </button>
          </div>
        </div>

        {activeEditSection === 'hero' && (
          <div className="border-b border-brand-100 bg-brand-50/30 p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-800 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Hero Text & Action Controls
              </span>
              <button
                type="button"
                onClick={() => handleSave('Hero Section')}
                disabled={isSaving}
                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Save className="h-3 w-3" />
                <span>Save Hero Section</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Hero Eyebrow / Top Tagline
                </label>
                <input
                  type="text"
                  value={content.hero.eyebrow}
                  onChange={(e) => updateHero('eyebrow', e.target.value)}
                  placeholder="e.g. Explore Beyond Boundaries"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Hero Main Heading
                </label>
                <input
                  type="text"
                  value={content.hero.title}
                  onChange={(e) => updateHero('title', e.target.value)}
                  placeholder="e.g. Discover Asia with us"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Action Button Label
                </label>
                <input
                  type="text"
                  value={content.hero.button_text}
                  onChange={(e) => updateHero('button_text', e.target.value)}
                  placeholder="e.g. Learn More"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Action Button Link
                </label>
                <input
                  type="text"
                  value={content.hero.button_link}
                  onChange={(e) => updateHero('button_link', e.target.value)}
                  placeholder="e.g. /packages or /destinations"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-brand-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-ink-700">
                  Active Hero Slides ({heroImages.length})
                </span>
                <span className="text-[11px] text-ink-500">
                  Auto-transitions every 5 seconds on the customer site
                </span>
              </div>
              {heroImages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-300 p-4 text-center">
                  <p className="text-xs text-ink-500">
                    No custom hero images uploaded yet. Fallback destination photos are being displayed.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenUpload('hero')}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Upload your first hero image
                  </button>
                </div>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto pb-1 items-center">
                  {heroImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className="group/slide relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-ink-200 bg-ink-100 shadow-xs"
                    >
                      <Image src={img.image_url} alt="Slide" fill className="object-cover" />
                      <div className="absolute top-1 left-1 rounded bg-black/60 px-1 py-0.2 text-[9px] font-bold text-white">
                        #{idx + 1}
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImage(img);
                          }}
                          className="absolute top-1 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-red-600/90 text-white hover:bg-red-700 hover:scale-105 transition cursor-pointer shadow-xs"
                          title="Delete this hero slide"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => onOpenUpload('hero')}
                    className="flex h-16 w-28 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-300 bg-white hover:bg-brand-50 transition cursor-pointer text-brand-700 shadow-xs"
                    title="Add another hero slide"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-[10px] font-bold">+ Add Slide</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Hero Slides Strip when drawer is closed */}
        {activeEditSection !== 'hero' && heroImages.length > 0 && (
          <div className="border-b border-ink-100 bg-ink-50/70 px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
            <span className="text-[11px] font-bold text-ink-600 uppercase tracking-wider shrink-0">
              Hero Slides ({heroImages.length}):
            </span>
            <div className="flex items-center gap-2">
              {heroImages.map((img, idx) => (
                <div
                  key={img.id}
                  className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-ink-200 bg-ink-100 shadow-xs"
                >
                  <Image src={img.image_url} alt="Slide" fill className="object-cover" />
                  <div className="absolute top-0.5 left-0.5 rounded bg-black/60 px-1 py-0.2 text-[8px] font-bold text-white">
                    #{idx + 1}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(img);
                      }}
                      className="absolute top-0.5 right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-red-600/90 text-white hover:bg-red-700 transition cursor-pointer shadow-xs"
                      title="Delete this hero slide"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => onOpenUpload('hero')}
                className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-brand-300 bg-white hover:bg-brand-50 transition cursor-pointer text-brand-700 shadow-xs"
                title="Add hero slide"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-[9px] font-bold">+ Slide</span>
              </button>
            </div>
          </div>
        )}

        <div className="relative h-[320px] sm:h-[380px] w-full overflow-hidden bg-navy-950 flex flex-col justify-center items-center text-center px-4 select-none">
          {heroImages.length > 0 ? (
            <div className="absolute inset-0 z-0">
              <Image
                src={heroImages[0]!.image_url}
                alt="Hero preview"
                fill
                unoptimized
                className="object-cover brightness-[0.78] contrast-[1.05]"
              />
              <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            </div>
          ) : (
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-brand-900 to-navy-950" />
          )}

          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="inline-flex rounded-full bg-white/10 backdrop-blur-xs px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white border border-white/20">
              {content.hero.eyebrow || 'Explore Beyond Boundaries'}
            </span>

            <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tight text-white leading-tight">
              {content.hero.title || 'Discover Asia with us'}
            </h1>

            <div className="pt-2">
              <span className="btn-cta inline-flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-semibold shadow-xl rounded-full pointer-events-none">
                <span>{content.hero.button_text || 'Learn More'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>

          <div className="absolute bottom-3 right-3 z-20 rounded-md bg-black/60 backdrop-blur-xs px-2.5 py-1 text-[10px] text-white/80">
            Interactive Hero Preview
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: DESTINATIONS SECTION
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white text-xs font-bold">
              2
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink-900">
                Destination Introduction & Showcase Section
              </h3>
              <p className="text-[11px] text-ink-500">
                Section heading text and live database destinations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveEditSection(activeEditSection === 'destinations' ? null : 'destinations')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeEditSection === 'destinations'
                ? 'bg-ink-900 text-white shadow-xs'
                : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>{activeEditSection === 'destinations' ? 'Close Editor' : 'Edit Intro Text'}</span>
          </button>
        </div>

        {activeEditSection === 'destinations' && (
          <div className="border-b border-brand-100 bg-brand-50/30 p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-800 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Destinations Intro Copy Controls
              </span>
              <button
                type="button"
                onClick={() => handleSave('Destinations Section')}
                disabled={isSaving}
                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Save className="h-3 w-3" />
                <span>Save Intro Section</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Section Eyebrow
                </label>
                <input
                  type="text"
                  value={content.destinations.eyebrow}
                  onChange={(e) => updateDestinations('eyebrow', e.target.value)}
                  placeholder="e.g. Where to next"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Section Title / Main Heading
                </label>
                <input
                  type="text"
                  value={content.destinations.title}
                  onChange={(e) => updateDestinations('title', e.target.value)}
                  placeholder="e.g. Iconic & Handcrafted Destinations"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Description Text (Displayed below heading)
                </label>
                <textarea
                  rows={2}
                  value={content.destinations.description}
                  onChange={(e) => updateDestinations('description', e.target.value)}
                  placeholder="e.g. From sun-kissed turquoise lagoons to tranquil mountain sanctuaries, explore our most coveted travel regions."
                  className="input text-xs font-medium rounded-xl py-2 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  CTA Link Text
                </label>
                <input
                  type="text"
                  value={content.destinations.cta_text}
                  onChange={(e) => updateDestinations('cta_text', e.target.value)}
                  placeholder="e.g. View all destinations"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-8 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-1">
                {content.destinations.eyebrow || 'Where to next'}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
                {content.destinations.title || 'Iconic & Handcrafted Destinations'}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-ink-500 max-w-2xl leading-relaxed">
                {content.destinations.description ||
                  'From sun-kissed turquoise lagoons to tranquil mountain sanctuaries, explore our most coveted travel regions.'}
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 shrink-0">
              <span>{content.destinations.cta_text || 'View all destinations'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.slice(0, 3).map((d) => (
              <div
                key={d.id}
                className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-100 shadow-sm border border-ink-200/80"
              >
                {d.cover_image_url ? (
                  <Image src={d.cover_image_url} alt={d.name} fill className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-900 text-white font-medium text-sm">
                    {d.name}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/40 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-800 shadow-xs">
                    <MapPin className="h-3 w-3 text-brand-600" />
                    <span>{d.name}</span>
                  </span>
                </div>
                <div className="absolute bottom-0 inset-x-0 p-4 text-white">
                  <h4 className="font-display text-lg font-bold text-white">{d.name}</h4>
                  {d.description && (
                    <p className="mt-1 text-xs text-white/80 line-clamp-1 font-light">
                      {d.description}
                    </p>
                  )}
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sand-300">
                    <span>Explore Itineraries</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] text-ink-400 border-t border-ink-100 pt-3">
            <span>
              Showing first 3 live destination items dynamically fetched from the database.
            </span>
            <Link
              href="/travinco_dashboard/destinations"
              className="font-medium text-brand-600 hover:underline"
            >
              Manage Destinations DB &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: TRAVINCO EXPERIENCE SECTION
      ───────────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl border border-white/10 bg-navy-950 section-navy overflow-hidden shadow-lg text-white relative"
        style={{ backgroundColor: '#080d1a' }}
      >
        {/* Ambient atmospheric glow blobs (matches customer side) */}
        <div className="absolute -right-20 top-0 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 bottom-0 h-96 w-96 rounded-full bg-ocean-400/10 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3.5 relative z-10 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white text-xs font-bold shadow-xs">
              3
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                The Travinco Experience Section (Why Travelers Choose Us)
              </h3>
              <p className="text-[11px] text-white/60">
                Matches customer-side dark navy styling with 4 experience cards and trust pillars
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveEditSection(activeEditSection === 'experience' ? null : 'experience')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeEditSection === 'experience'
                ? 'bg-sand-400 text-navy-950 shadow-xs'
                : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>{activeEditSection === 'experience' ? 'Close Editor' : 'Edit Experience Copy'}</span>
          </button>
        </div>

        {activeEditSection === 'experience' && (
          <div className="border-b border-white/10 bg-[#0f172a] p-5 space-y-5 animate-in fade-in duration-150 text-ink-900 relative z-20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sand-300 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Experience Header & 4 Cards Editor
              </span>
              <button
                type="button"
                onClick={() => handleSave('Experience Section')}
                disabled={isSaving}
                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Save className="h-3 w-3" />
                <span>Save Experience Section</span>
              </button>
            </div>

            <div className="rounded-2xl bg-white p-4 space-y-3">
              <h4 className="text-xs font-bold text-ink-800">Section Header</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Eyebrow / Small Header
                  </label>
                  <input
                    type="text"
                    value={content.experience.eyebrow}
                    onChange={(e) => updateExperienceHeader('eyebrow', e.target.value)}
                    placeholder="e.g. The Travinco Experience"
                    className="input h-9 text-xs font-medium rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Main Title
                  </label>
                  <input
                    type="text"
                    value={content.experience.title}
                    onChange={(e) => updateExperienceHeader('title', e.target.value)}
                    placeholder="e.g. Why Travelers Choose Travinco"
                    className="input h-9 text-xs font-medium rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Description Text
                  </label>
                  <textarea
                    rows={2}
                    value={content.experience.description}
                    onChange={(e) => updateExperienceHeader('description', e.target.value)}
                    placeholder="e.g. We believe a truly great vacation should feel effortless..."
                    className="input text-xs font-medium rounded-xl py-2 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white">4 Experience Feature Cards</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {content.experience.cards.map((card, idx) => (
                  <div key={card.id || idx} className="rounded-2xl bg-white p-4 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                      <span className="text-xs font-bold text-ink-900">Card #{idx + 1}</span>
                      <select
                        value={card.icon_key}
                        onChange={(e) =>
                          updateExperienceCard(idx, 'icon_key', e.target.value as any)
                        }
                        className="rounded-lg border border-ink-200 bg-ink-50 px-2 py-1 text-[11px] font-semibold text-ink-700"
                      >
                        <option value="map">Icon: Map / Route</option>
                        <option value="shield">Icon: Shield / Stays</option>
                        <option value="headphones">Icon: Headphones / Support</option>
                        <option value="wallet">Icon: Wallet / Pricing</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-ink-600 mb-0.5">
                          Badge Label
                        </label>
                        <input
                          type="text"
                          value={card.badge}
                          onChange={(e) => updateExperienceCard(idx, 'badge', e.target.value)}
                          placeholder="e.g. Tailor-Made"
                          className="input h-8 text-xs font-medium rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-ink-600 mb-0.5">
                          Card Title
                        </label>
                        <input
                          type="text"
                          value={card.title}
                          onChange={(e) => updateExperienceCard(idx, 'title', e.target.value)}
                          placeholder="e.g. Itineraries Built For You"
                          className="input h-8 text-xs font-medium rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-ink-600 mb-0.5">
                        Card Description / Body
                      </label>
                      <textarea
                        rows={2}
                        value={card.body}
                        onChange={(e) => updateExperienceCard(idx, 'body', e.target.value)}
                        placeholder="Card explanation..."
                        className="input text-xs font-medium rounded-lg py-1.5 resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats & Milestone Numbers Editor */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-sand-300" />
                    <span>
                      Quick Stats &amp; Milestone Numbers (
                      {(content.experience.stats || DEFAULT_HOME_PAGE_CONTENT.experience.stats || []).length})
                    </span>
                  </h4>
                  <p className="text-[11px] text-white/60">
                    Animated count-up counters (e.g. 5,000+, 4.9 ★, 100%, 24/7) that run when customers scroll into view
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addExperienceStat}
                  className="inline-flex items-center gap-1 rounded-lg border border-sand-400/40 bg-sand-400/20 px-2.5 py-1 text-xs font-semibold text-sand-300 hover:bg-sand-400/30 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Add Stat Counter</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(content.experience.stats || DEFAULT_HOME_PAGE_CONTENT.experience.stats || []).map(
                  (stat, idx) => (
                    <div key={idx} className="rounded-2xl bg-white p-3.5 space-y-2 shadow-sm relative">
                      <div className="flex items-center justify-between border-b border-ink-100 pb-1.5">
                        <span className="text-[11px] font-bold text-brand-700">Counter #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeExperienceStat(idx)}
                          className="rounded-lg p-1 text-ink-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                          title="Delete this counter"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-ink-600 mb-0.5">
                          Display Value / Digits
                        </label>
                        <input
                          type="text"
                          value={stat.value}
                          onChange={(e) => updateExperienceStat(idx, 'value', e.target.value)}
                          placeholder="e.g. 5,000+ or 4.9 ★"
                          className="input h-8 text-xs font-bold rounded-lg text-ink-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-ink-600 mb-0.5">
                          Counter Label / Description
                        </label>
                        <input
                          type="text"
                          value={stat.label}
                          onChange={(e) => updateExperienceStat(idx, 'label', e.target.value)}
                          placeholder="e.g. Delighted Travelers"
                          className="input h-8 text-xs font-medium rounded-lg text-ink-700"
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-12 relative overflow-hidden z-10">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sand-300">
              {content.experience.eyebrow || 'The Travinco Experience'}
            </p>
            <h2 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight">
              {content.experience.title || 'Why Travelers Choose Travinco'}
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-white/70 max-w-2xl mx-auto leading-relaxed">
              {content.experience.description ||
                'We believe a truly great vacation should feel effortless. Here is how we ensure every moment is memorable.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {content.experience.cards.map((card, idx) => {
              const Icon = getExperienceIcon(card.icon_key);
              return (
                <div
                  key={card.id || idx}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:border-white/20 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/30 text-sand-300 border border-brand-500/20">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base text-white">{card.title}</h3>
                  <p className="mt-2 text-xs text-white/70 leading-relaxed">{card.body}</p>
                </div>
              );
            })}
          </div>

          {((content.experience.stats && content.experience.stats.length > 0)
            ? content.experience.stats
            : DEFAULT_HOME_PAGE_CONTENT.experience.stats || []
          ).length > 0 && (
            <div className="mt-12 border-t border-white/10 pt-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {(content.experience.stats && content.experience.stats.length > 0
                ? content.experience.stats
                : DEFAULT_HOME_PAGE_CONTENT.experience.stats || []
              ).map((s, idx) => (
                <div key={idx}>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-sand-300">{s.value}</p>
                  <p className="mt-1 text-xs text-white/70 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: CAPTURED ON THE ROAD (TEXT + IMAGES)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-ink-100 bg-emerald-50/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-bold">
              4
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink-900">
                Captured On The Road Section (Text & Moments Images)
              </h3>
              <p className="text-[11px] text-ink-500">
                Carousel heading copy and interactive moments modal images ({roadImages.length} uploaded)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenUpload('captured_road')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-600" />
              <span>+ Upload Moment</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEditSection(activeEditSection === 'captured_road' ? null : 'captured_road')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeEditSection === 'captured_road'
                  ? 'bg-ink-900 text-white shadow-xs'
                  : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>{activeEditSection === 'captured_road' ? 'Close Editor' : 'Edit Road Text'}</span>
            </button>
          </div>
        </div>

        {activeEditSection === 'captured_road' && (
          <div className="border-b border-emerald-100 bg-emerald-50/30 p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Road Moments Heading Controls
              </span>
              <button
                type="button"
                onClick={() => handleSave('Captured On The Road Section')}
                disabled={isSaving}
                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Save className="h-3 w-3" />
                <span>Save Road Section</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Section Eyebrow
                </label>
                <input
                  type="text"
                  value={content.captured_road.eyebrow}
                  onChange={(e) => updateCapturedRoad('eyebrow', e.target.value)}
                  placeholder="e.g. From our travelers' lenses"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Section Title
                </label>
                <input
                  type="text"
                  value={content.captured_road.title}
                  onChange={(e) => updateCapturedRoad('title', e.target.value)}
                  placeholder="e.g. Captured On The Road"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Section Description
                </label>
                <textarea
                  rows={2}
                  value={content.captured_road.description}
                  onChange={(e) => updateCapturedRoad('description', e.target.value)}
                  placeholder="e.g. Unfiltered glimpses of picturesque horizons..."
                  className="input text-xs font-medium rounded-xl py-2 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-8 bg-white">
          <div className="mb-6 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-1">
              {content.captured_road.eyebrow || "From our travelers' lenses"}
            </p>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
              {content.captured_road.title || 'Captured On The Road'}
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-ink-500 leading-relaxed">
              {content.captured_road.description ||
                'Unfiltered glimpses of picturesque horizons, serene waters, and joyful moments from past journeys.'}
            </p>
          </div>

          {roadImages.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-3 items-center">
              {roadImages.map((img, idx) => (
                <div
                  key={img.id}
                  className="group/moment relative h-44 w-64 shrink-0 overflow-hidden rounded-2xl border border-ink-200 bg-ink-100 shadow-sm"
                >
                  <Image src={img.image_url} alt="Road moment" fill className="object-cover" />
                  <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                    Moment #{idx + 1}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(img);
                      }}
                      className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-600/90 text-white hover:bg-red-700 hover:scale-105 transition cursor-pointer shadow-md"
                      title="Delete this road moment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => onOpenUpload('captured_road')}
                className="flex h-44 w-36 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-300 bg-white hover:bg-emerald-50 transition cursor-pointer text-emerald-800 shadow-xs"
                title="Add another road moment"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mb-2">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold">+ Add Moment</span>
                <span className="text-[10px] text-ink-500 mt-0.5">Upload photo</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center bg-ink-50/40">
              <p className="text-xs text-ink-500">
                No custom road moment images uploaded yet. Curated sample images are displayed on customer site.
              </p>
              <button
                type="button"
                onClick={() => onOpenUpload('captured_road')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Upload First Road Moment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: HOW YOUR JOURNEY BEGINS (3 STEPS)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white text-xs font-bold">
              5
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink-900">
                How Your Journey Begins (How It Works: 3 Steps)
              </h3>
              <p className="text-[11px] text-ink-500">
                3-step process cards explaining the traveler booking & planning experience
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveEditSection(activeEditSection === 'how_it_works' ? null : 'how_it_works')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeEditSection === 'how_it_works'
                ? 'bg-ink-900 text-white shadow-xs'
                : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>{activeEditSection === 'how_it_works' ? 'Close Editor' : 'Edit Steps'}</span>
          </button>
        </div>

        {activeEditSection === 'how_it_works' && (
          <div className="border-b border-brand-100 bg-brand-50/30 p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-800 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                How It Works Content Controls
              </span>
              <button
                type="button"
                onClick={() => handleSave('How Your Journey Begins Section')}
                disabled={isSaving}
                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Save className="h-3 w-3" />
                <span>Save Steps Section</span>
              </button>
            </div>

            <div className="rounded-2xl bg-white p-4 space-y-3">
              <h4 className="text-xs font-bold text-ink-800">Section Header</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Eyebrow / Small Header
                  </label>
                  <input
                    type="text"
                    value={content.how_it_works.eyebrow}
                    onChange={(e) => updateHowItWorksHeader('eyebrow', e.target.value)}
                    placeholder="e.g. Simple & Stress-Free"
                    className="input h-9 text-xs font-medium rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Main Title
                  </label>
                  <input
                    type="text"
                    value={content.how_it_works.title}
                    onChange={(e) => updateHowItWorksHeader('title', e.target.value)}
                    placeholder="e.g. How Your Journey Begins"
                    className="input h-9 text-xs font-medium rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Description Text
                  </label>
                  <textarea
                    rows={2}
                    value={content.how_it_works.description}
                    onChange={(e) => updateHowItWorksHeader('description', e.target.value)}
                    placeholder="Section description..."
                    className="input text-xs font-medium rounded-xl py-2 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-ink-800">3 Process Steps</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {content.how_it_works.steps.map((step, idx) => (
                  <div key={idx} className="rounded-2xl bg-white p-4 space-y-2 border border-ink-100 shadow-xs">
                    <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                      <span className="text-xs font-bold text-brand-700">Step #{idx + 1}</span>
                      <input
                        type="text"
                        value={step.step}
                        onChange={(e) => updateHowItWorksStep(idx, 'step', e.target.value)}
                        placeholder="01"
                        className="input h-7 w-14 text-xs font-bold text-center rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-ink-600 mb-0.5">
                        Step Title
                      </label>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateHowItWorksStep(idx, 'title', e.target.value)}
                        className="input h-8 text-xs font-medium rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-ink-600 mb-0.5">
                        Step Description
                      </label>
                      <textarea
                        rows={3}
                        value={step.body}
                        onChange={(e) => updateHowItWorksStep(idx, 'body', e.target.value)}
                        className="input text-xs font-medium rounded-lg py-1.5 resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-10 bg-white">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-600">
              {content.how_it_works.eyebrow || 'Simple & Stress-Free'}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
              {content.how_it_works.title || 'How Your Journey Begins'}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-ink-500 leading-relaxed">
              {content.how_it_works.description ||
                'From initial spark to seamless return, we take care of the details so you can focus on the memories.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {content.how_it_works.steps.map((s, idx) => {
              const icons = [Compass, Calendar, ShieldCheck];
              const Icon = icons[idx % icons.length] || Compass;
              return (
                <div
                  key={s.step || idx}
                  className="rounded-2xl border border-ink-100 bg-white p-6 shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-display text-3xl font-bold text-sand-300">{s.step}</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-ink-900">{s.title}</h4>
                  <p className="mt-1.5 text-xs text-ink-500 leading-relaxed">{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: KERALA AYURVEDA & WELLNESS PACKAGES
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-ink-100 bg-emerald-50/50 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-bold">
              ★
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink-900">
                Kerala Ayurveda &amp; Wellness Packages (Parallax Showcase)
              </h3>
              <p className="text-[11px] text-ink-500">
                Full-width fixed background image with right-aligned wellness feature card and link to packages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenUpload('ayurveda')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-xs cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-emerald-600" />
              <span>+ Upload Photo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEditSection(activeEditSection === 'ayurveda' ? null : 'ayurveda')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeEditSection === 'ayurveda'
                  ? 'bg-ink-900 text-white shadow-xs'
                  : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>{activeEditSection === 'ayurveda' ? 'Close Editor' : 'Edit Content & Images'}</span>
            </button>
          </div>
        </div>

        {activeEditSection === 'ayurveda' && (
          <div className="border-b border-emerald-100 bg-emerald-50/30 p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-700" />
                Ayurveda &amp; Wellness Section Controls
              </span>
              <button
                type="button"
                onClick={() => handleSave('Ayurveda & Wellness Section')}
                disabled={isSaving}
                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Save className="h-3 w-3" />
                <span>Save Ayurveda Section</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Section Eyebrow / Tagline
                </label>
                <input
                  type="text"
                  value={content.ayurveda?.eyebrow || ''}
                  onChange={(e) => updateAyurveda('eyebrow', e.target.value)}
                  placeholder="e.g. Ayurveda & Traditional Yoga"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Section Main Heading
                </label>
                <input
                  type="text"
                  value={content.ayurveda?.title || ''}
                  onChange={(e) => updateAyurveda('title', e.target.value)}
                  placeholder="e.g. REJUVENATING KERALA AYURVEDA & WELLNESS PACKAGES"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Description Text (Paragraph on card)
                </label>
                <textarea
                  rows={3}
                  value={content.ayurveda?.description || ''}
                  onChange={(e) => updateAyurveda('description', e.target.value)}
                  placeholder="Immerse yourself in authentic Kerala Ayurveda packages..."
                  className="input text-xs font-medium rounded-xl py-2 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Green Button Label
                </label>
                <input
                  type="text"
                  value={content.ayurveda?.button_text || ''}
                  onChange={(e) => updateAyurveda('button_text', e.target.value)}
                  placeholder="e.g. Learn More"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Button Redirect Link
                </label>
                <input
                  type="text"
                  value={content.ayurveda?.button_link || ''}
                  onChange={(e) => updateAyurveda('button_link', e.target.value)}
                  placeholder="e.g. /packages"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-ink-700">
                    Background Image URL
                  </label>
                  <button
                    type="button"
                    onClick={() => updateAyurveda('image_url', '/images/kerala-ayurveda-wellness.jpg')}
                    className="text-[11px] text-emerald-700 hover:underline font-medium"
                  >
                    Reset to Default Asset
                  </button>
                </div>
                <input
                  type="text"
                  value={content.ayurveda?.image_url || ''}
                  onChange={(e) => updateAyurveda('image_url', e.target.value)}
                  placeholder="e.g. /images/kerala-ayurveda-wellness.jpg or https://..."
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>
            </div>

            {/* Uploaded Ayurveda Theme Images Library */}
            <div className="pt-2 border-t border-emerald-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-ink-700">
                  Uploaded Theme Images for Ayurveda ({ayurvedaImages.length})
                </span>
                <button
                  type="button"
                  onClick={() => onOpenUpload('ayurveda')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Upload New Ayurveda Photo</span>
                </button>
              </div>

              {ayurvedaImages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-3 text-center">
                  <p className="text-xs text-ink-500">
                    Using the default high-resolution Kerala Ayurveda retreat photograph. You can upload custom images above.
                  </p>
                </div>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto pb-1 items-center">
                  {ayurvedaImages.map((img, idx) => {
                    const activeBg =
                      (content.ayurveda?.image_url &&
                      content.ayurveda.image_url !== '/images/kerala-ayurveda-wellness.jpg'
                        ? content.ayurveda.image_url
                        : ayurvedaImages[0]?.image_url) || content.ayurveda?.image_url;
                    const isSelected =
                      activeBg === img.image_url ||
                      content.ayurveda?.image_url === img.image_url;
                    return (
                      <div
                        key={img.id}
                        onClick={() => {
                          updateAyurveda('image_url', img.image_url);
                          toast.success(`Selected Ayurveda photo #${idx + 1}. Remember to save.`);
                        }}
                        className={`group/ayurveda relative h-18 w-32 shrink-0 overflow-hidden rounded-xl border cursor-pointer transition shadow-xs ${
                          isSelected
                            ? 'ring-2 ring-emerald-600 border-emerald-500 scale-102'
                            : 'border-ink-200 hover:border-emerald-400'
                        }`}
                        title="Click to use this image as background"
                      >
                        <Image src={img.image_url} alt="Ayurveda slide" fill className="object-cover" />
                        <div className="absolute top-1 left-1 rounded bg-black/60 px-1 py-0.2 text-[9px] font-bold text-white">
                          #{idx + 1}
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(img);
                            }}
                            className="absolute top-1 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-red-600/90 text-white hover:bg-red-700 hover:scale-105 transition cursor-pointer shadow-xs"
                            title="Delete this Ayurveda photo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isSelected && (
                          <div className="absolute bottom-1 right-1 rounded bg-emerald-600 px-1.5 py-0.2 text-[9px] font-bold text-white shadow-xs">
                            Active
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => onOpenUpload('ayurveda')}
                    className="flex h-18 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-teal-300 bg-white hover:bg-teal-50 transition cursor-pointer text-teal-800 shadow-xs"
                    title="Upload another Ayurveda photo"
                  >
                    <Plus className="h-4 w-4 text-teal-600" />
                    <span className="text-[10px] font-bold">+ Upload Photo</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Ayurveda Visuals Strip when drawer is closed */}
        {activeEditSection !== 'ayurveda' && ayurvedaImages.length > 0 && (
          <div className="border-b border-teal-100 bg-teal-50/40 px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
            <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider shrink-0">
              Ayurveda Photos ({ayurvedaImages.length}):
            </span>
            <div className="flex items-center gap-2">
              {ayurvedaImages.map((img, idx) => {
                const activeBg =
                  (content.ayurveda?.image_url &&
                  content.ayurveda.image_url !== '/images/kerala-ayurveda-wellness.jpg'
                    ? content.ayurveda.image_url
                    : ayurvedaImages[0]?.image_url) || content.ayurveda?.image_url;
                const isSelected =
                  activeBg === img.image_url || content.ayurveda?.image_url === img.image_url;
                return (
                  <div
                    key={img.id}
                    onClick={() => {
                      updateAyurveda('image_url', img.image_url);
                      toast.success(`Selected Ayurveda photo #${idx + 1}. Remember to click Save All Changes.`);
                    }}
                    className={`relative h-12 w-20 shrink-0 overflow-hidden rounded-lg border cursor-pointer transition shadow-xs ${
                      isSelected
                        ? 'ring-2 ring-emerald-600 border-emerald-500'
                        : 'border-ink-200 hover:border-emerald-400'
                    }`}
                    title="Click to select as background"
                  >
                    <Image src={img.image_url} alt="Ayurveda visual" fill className="object-cover" />
                    <div className="absolute top-0.5 left-0.5 rounded bg-black/60 px-1 py-0.2 text-[8px] font-bold text-white">
                      #{idx + 1}
                    </div>
                    {isSelected && (
                      <div className="absolute bottom-0.5 left-0.5 rounded bg-emerald-600 px-1 py-0.2 text-[7px] font-bold text-white">
                        Active
                      </div>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(img);
                        }}
                        className="absolute top-0.5 right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-red-600/90 text-white hover:bg-red-700 transition cursor-pointer shadow-xs"
                        title="Delete this Ayurveda photo"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => onOpenUpload('ayurveda')}
                className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-teal-300 bg-white hover:bg-teal-50 transition cursor-pointer text-teal-800 shadow-xs"
                title="Upload Ayurveda photo"
              >
                <Plus className="h-3.5 w-3.5 text-teal-600" />
                <span className="text-[9px] font-bold text-teal-800">+ Photo</span>
              </button>
            </div>
          </div>
        )}

        <div
          className="relative min-h-[360px] w-full bg-cover bg-center flex items-center justify-end p-6 sm:p-10 select-none"
          style={{
            backgroundImage: `url('${
              (content.ayurveda?.image_url &&
              content.ayurveda.image_url !== '/images/kerala-ayurveda-wellness.jpg'
                ? content.ayurveda.image_url
                : ayurvedaImages[0]?.image_url) ||
              content.ayurveda?.image_url ||
              '/images/kerala-ayurveda-wellness.jpg'
            }')`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/40 to-black/80 pointer-events-none" />

          <div className="relative z-10 max-w-lg rounded-2xl bg-black/60 backdrop-blur-md p-6 border border-white/15 text-white shadow-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/25 border border-emerald-400/35 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 mb-2">
              <Heart className="h-3 w-3 text-emerald-400" />
              <span>{content.ayurveda?.eyebrow || 'Ayurveda & Traditional Yoga'}</span>
            </span>

            <h4 className="font-display text-lg font-bold uppercase text-white leading-tight mb-2">
              {content.ayurveda?.title || 'REJUVENATING KERALA AYURVEDA & WELLNESS PACKAGES'}
            </h4>

            <p className="text-xs text-white/90 font-light leading-relaxed mb-4">
              {content.ayurveda?.description ||
                'Immerse yourself in authentic Kerala Ayurveda packages and traditional Yoga retreats. Experience holistic wellness programs, Panchakarma therapies, and mind-body rejuvenation at top-rated retreat resorts. Complete with customized wellness itineraries, resort bookings, and ground logistics by our local team in Kerala'}
            </p>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white font-semibold px-5 py-2 text-xs shadow-md">
              <span>{content.ayurveda?.button_text || 'Learn More'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="absolute bottom-3 left-3 z-20 rounded-md bg-black/60 backdrop-blur-xs px-2.5 py-1 text-[10px] text-white/80">
            Parallax Section Preview
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: REAL STORIES FROM PAST TRIPS (TESTIMONIALS)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-ink-100 bg-sand-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white text-xs font-bold">
              6
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink-900">
                Real Stories From Past Trips (Traveler Testimonials Carousel)
              </h3>
              <p className="text-[11px] text-ink-500">
                Heading copy and {content.testimonials.items.length} customer review cards (carousel on customer side)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addTestimonialItem}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 border border-brand-200/80 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-brand-600" />
              <span>+ Add Testimonial</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEditSection(activeEditSection === 'testimonials' ? null : 'testimonials')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeEditSection === 'testimonials'
                  ? 'bg-ink-900 text-white shadow-xs'
                  : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>{activeEditSection === 'testimonials' ? 'Close Editor' : 'Edit Testimonials'}</span>
            </button>
          </div>
        </div>

        {activeEditSection === 'testimonials' && (
          <div className="border-b border-sand-200 bg-sand-50/40 p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-800 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Testimonials Copy &amp; Carousel Items ({content.testimonials.items.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addTestimonialItem}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50 transition cursor-pointer shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 text-brand-600" />
                  <span>+ Add Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSave('Testimonials Section')}
                  disabled={isSaving}
                  className="btn-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  <Save className="h-3 w-3" />
                  <span>Save Testimonials Section</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 space-y-3">
              <h4 className="text-xs font-bold text-ink-800">Section Header</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Eyebrow / Small Header
                  </label>
                  <input
                    type="text"
                    value={content.testimonials.eyebrow}
                    onChange={(e) => updateTestimonialsHeader('eyebrow', e.target.value)}
                    placeholder="e.g. What travelers say"
                    className="input h-9 text-xs font-medium rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Main Title
                  </label>
                  <input
                    type="text"
                    value={content.testimonials.title}
                    onChange={(e) => updateTestimonialsHeader('title', e.target.value)}
                    placeholder="e.g. Real Stories From Past Trips"
                    className="input h-9 text-xs font-medium rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Description Text
                  </label>
                  <textarea
                    rows={2}
                    value={content.testimonials.description}
                    onChange={(e) => updateTestimonialsHeader('description', e.target.value)}
                    placeholder="Section description..."
                    className="input text-xs font-medium rounded-xl py-2 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-ink-800">
                  Customer Testimonial Cards ({content.testimonials.items.length})
                </h4>
                <button
                  type="button"
                  onClick={addTestimonialItem}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Another Review Card</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {content.testimonials.items.map((item, idx) => (
                  <div key={idx} className="rounded-2xl bg-white p-4 space-y-2.5 border border-ink-100 shadow-xs relative">
                    <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                      <span className="text-xs font-bold text-brand-700">Reviewer #{idx + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={item.rating}
                          onChange={(e) => updateTestimonialItem(idx, 'rating', Number(e.target.value))}
                          className="rounded-lg border border-ink-200 bg-ink-50 px-2 py-0.5 text-xs font-semibold cursor-pointer"
                        >
                          <option value={5}>5 Stars ★★★★★</option>
                          <option value={4}>4 Stars ★★★★</option>
                          <option value={3}>3 Stars ★★★</option>
                          <option value={2}>2 Stars ★★</option>
                          <option value={1}>1 Star ★</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeTestimonialItem(idx)}
                          className="rounded-lg p-1 text-ink-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                          title="Delete this testimonial"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-ink-600 mb-0.5">
                        Traveler Name
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateTestimonialItem(idx, 'name', e.target.value)}
                        placeholder="e.g. Ritika & Arjun"
                        className="input h-8 text-xs font-medium rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-ink-600 mb-0.5">
                        Trip Name / Route
                      </label>
                      <input
                        type="text"
                        value={item.trip}
                        onChange={(e) => updateTestimonialItem(idx, 'trip', e.target.value)}
                        placeholder="e.g. Kerala backwaters honeymoon"
                        className="input h-8 text-xs font-medium rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-ink-600 mb-0.5">
                        Quote Content
                      </label>
                      <textarea
                        rows={3}
                        value={item.quote}
                        onChange={(e) => updateTestimonialItem(idx, 'quote', e.target.value)}
                        placeholder="Review quote text..."
                        className="input text-xs font-medium rounded-lg py-1.5 resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-10 bg-sand-50/30">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-1">
                {content.testimonials.eyebrow || 'What travelers say'}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
                {content.testimonials.title || 'Real Stories From Past Trips'}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-ink-500 leading-relaxed">
                {content.testimonials.description ||
                  'Read firsthand experiences from travelers who entrusted their vacations to our specialists.'}
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 bg-white border border-ink-200 px-3 py-1.5 rounded-full shadow-xs">
              <span>{content.testimonials.items.length} Reviews (Live Carousel)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {content.testimonials.items.map((t, i) => {
              const borders = ['border-t-brand-500', 'border-t-coral-500', 'border-t-ocean-500', 'border-t-sand-500'];
              return (
                <div
                  key={i}
                  className={`card border-t-4 p-6 bg-white shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between rounded-2xl ${
                    borders[i % borders.length]
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Quote className="h-5 w-5 text-sand-400" />
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, starIndex) => (
                          <Star
                            key={starIndex}
                            className={`h-3.5 w-3.5 ${
                              starIndex < t.rating ? 'fill-sand-400 text-sand-400' : 'text-ink-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-ink-700 italic leading-relaxed min-h-[60px]">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  </div>
                  <div className="mt-5 border-t border-ink-100 pt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-ink-900">{t.name}</p>
                      <p className="text-[11px] text-brand-700 font-medium">{t.trip}</p>
                    </div>
                    <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[9px] font-bold text-sand-800">
                      Verified
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: TRAVEL STORIES & LOCAL GUIDES (BLOG POSTS FROM DB)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white text-xs font-bold">
              7
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink-900">
                Travel Stories & Local Guides (Blog Posts from Database)
              </h3>
              <p className="text-[11px] text-ink-500">
                Section heading text and live database blog articles
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveEditSection(activeEditSection === 'blog' ? null : 'blog')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeEditSection === 'blog'
                ? 'bg-ink-900 text-white shadow-xs'
                : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>{activeEditSection === 'blog' ? 'Close Editor' : 'Edit Blog Header'}</span>
          </button>
        </div>

        {activeEditSection === 'blog' && (
          <div className="border-b border-brand-100 bg-brand-50/30 p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-800 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Blog Section Copy Controls
              </span>
              <button
                type="button"
                onClick={() => handleSave('Blog Section')}
                disabled={isSaving}
                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Save className="h-3 w-3" />
                <span>Save Blog Section</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Section Eyebrow
                </label>
                <input
                  type="text"
                  value={content.blog.eyebrow}
                  onChange={(e) => updateBlog('eyebrow', e.target.value)}
                  placeholder="e.g. From the journal"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Section Title / Main Heading
                </label>
                <input
                  type="text"
                  value={content.blog.title}
                  onChange={(e) => updateBlog('title', e.target.value)}
                  placeholder="e.g. Travel Stories & Local Guides"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Description Text
                </label>
                <textarea
                  rows={2}
                  value={content.blog.description}
                  onChange={(e) => updateBlog('description', e.target.value)}
                  placeholder="e.g. Insider advice, packing checklists..."
                  className="input text-xs font-medium rounded-xl py-2 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  CTA Link Text
                </label>
                <input
                  type="text"
                  value={content.blog.cta_text}
                  onChange={(e) => updateBlog('cta_text', e.target.value)}
                  placeholder="e.g. Read all articles"
                  className="input h-9 text-xs font-medium rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-10 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-1">
                {content.blog.eyebrow || 'From the journal'}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
                {content.blog.title || 'Travel Stories & Local Guides'}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-ink-500 max-w-2xl leading-relaxed">
                {content.blog.description ||
                  'Insider advice, packing checklists, and hidden spots recommended by our destination specialists.'}
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 shrink-0">
              <span>{content.blog.cta_text || 'Read all articles'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {recentPosts.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {recentPosts.slice(0, 4).map((post) => (
                <div
                  key={post.id}
                  className="group overflow-hidden bg-white rounded-2xl border border-ink-100 shadow-xs"
                >
                  <div className="relative aspect-video bg-ink-100">
                    {post.cover_image_url ? (
                      <Image
                        src={post.cover_image_url}
                        alt={post.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-brand-900 text-white text-xs">
                        {post.title}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] text-ink-400">{formatDate(post.created_at)}</p>
                    <p className="mt-1 font-bold text-xs sm:text-sm text-ink-900 line-clamp-2">
                      {post.title}
                    </p>
                    {post.excerpt && (
                      <p className="mt-1.5 text-[11px] text-ink-500 line-clamp-2 leading-relaxed">
                        {post.excerpt}
                      </p>
                    )}
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                      Read guide →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center bg-ink-50/40">
              <BookOpen className="mx-auto h-8 w-8 text-ink-400 mb-2" />
              <p className="text-xs text-ink-500">
                No published blog posts found in the database. Published articles from the Blog section appear here automatically.
              </p>
              <Link
                href="/travinco_dashboard/blog"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline"
              >
                Go to Blog Manager &rarr;
              </Link>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-[11px] text-ink-400 border-t border-ink-100 pt-3">
            <span>
              Dynamic blog articles automatically fetched from the database blog_posts table.
            </span>
            <Link href="/travinco_dashboard/blog" className="font-medium text-brand-600 hover:underline">
              Manage Blog Posts DB &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 8: START PLANNING TODAY (FINAL CALL TO ACTION)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink-200 bg-gradient-to-br from-brand-800 via-brand-900 to-navy-950 overflow-hidden shadow-sm text-white">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-coral-500 text-white text-xs font-bold">
              8
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                Start Planning Today Section (Final High-Impact CTA)
              </h3>
              <p className="text-[11px] text-white/60">
                Bottom banner with headline, description, and primary conversion button
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveEditSection(activeEditSection === 'final_cta' ? null : 'final_cta')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeEditSection === 'final_cta'
                ? 'bg-sand-400 text-navy-950 shadow-xs'
                : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>{activeEditSection === 'final_cta' ? 'Close Editor' : 'Edit CTA Copy'}</span>
          </button>
        </div>

        {activeEditSection === 'final_cta' && (
          <div className="border-b border-white/10 bg-navy-900/90 p-5 space-y-4 animate-in fade-in duration-150 text-ink-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sand-300 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Final CTA Controls
              </span>
              <button
                type="button"
                onClick={() => handleSave('Final CTA Section')}
                disabled={isSaving}
                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Save className="h-3 w-3" />
                <span>Save CTA Section</span>
              </button>
            </div>

            <div className="rounded-2xl bg-white p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Badge / Tagline
                  </label>
                  <input
                    type="text"
                    value={content.final_cta.badge}
                    onChange={(e) => updateFinalCta('badge', e.target.value)}
                    placeholder="e.g. Start Planning Today"
                    className="input h-9 text-xs font-medium rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Main Headline
                  </label>
                  <input
                    type="text"
                    value={content.final_cta.title}
                    onChange={(e) => updateFinalCta('title', e.target.value)}
                    placeholder="e.g. Ready For Your Next Unforgettable Journey?"
                    className="input h-9 text-xs font-medium rounded-xl"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Description Text
                  </label>
                  <textarea
                    rows={2}
                    value={content.final_cta.description}
                    onChange={(e) => updateFinalCta('description', e.target.value)}
                    placeholder="e.g. Let our specialists curate a private, personalized vacation..."
                    className="input text-xs font-medium rounded-xl py-2 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={content.final_cta.button_text}
                    onChange={(e) => updateFinalCta('button_text', e.target.value)}
                    placeholder="e.g. Plan My Trip"
                    className="input h-9 text-xs font-medium rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Button Link
                  </label>
                  <input
                    type="text"
                    value={content.final_cta.button_link}
                    onChange={(e) => updateFinalCta('button_link', e.target.value)}
                    placeholder="e.g. /booking or /packages"
                    className="input h-9 text-xs font-medium rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-8 sm:p-14 text-center max-w-2xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-sand-300 border border-white/20">
            <Compass className="h-3.5 w-3.5" />
            <span>{content.final_cta.badge || 'Start Planning Today'}</span>
          </span>

          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            {content.final_cta.title || 'Ready For Your Next Unforgettable Journey?'}
          </h2>

          <p className="text-xs sm:text-sm text-white/80 max-w-xl mx-auto font-light leading-relaxed">
            {content.final_cta.description ||
              'Let our specialists curate a private, personalized vacation designed exclusively around your rhythm, dates, and dreams.'}
          </p>

          <div className="pt-2">
            <span className="btn-cta text-xs sm:text-sm px-7 py-3 font-semibold shadow-xl inline-block pointer-events-none">
              {content.final_cta.button_text || 'Plan My Trip'}
            </span>
          </div>
        </div>
      </div>

      {/* ── In-Editor Delete Confirmation Dialog ── */}
      {itemToDelete && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => !isDeleting && setItemToDelete(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="card w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lg shadow-ink-900/5 border border-ink-200 p-6 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-base font-bold text-ink-950">
                    Delete {itemToDelete.placement === 'hero' ? 'Hero Slide' : itemToDelete.placement === 'captured_road' ? 'Road Moment' : 'Ayurveda Image'}?
                  </h3>
                  <p className="text-xs text-ink-600 leading-relaxed">
                    Are you sure you want to permanently delete this visual asset? It will be removed immediately from both this editor and customer-facing pages.
                  </p>
                </div>
              </div>
  
              {/* Thumbnail Preview */}
              <div className="relative h-36 w-full overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
                <Image
                  src={itemToDelete.image_url}
                  alt="Image to delete"
                  fill
                  className="object-cover"
                />
              </div>
  
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  disabled={isDeleting}
                  className="btn-ghost text-xs px-3.5 py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Deleting…</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Yes, Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
