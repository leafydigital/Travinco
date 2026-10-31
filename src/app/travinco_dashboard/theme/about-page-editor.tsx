'use client';

import { useState } from 'react';
import { reportThemeErrors } from '@/lib/theme-form-errors';
import { validateAboutPageContent } from '@/lib/validations/theme';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Pencil,
  Tag,
  Info,
  Save,
  Upload,
  Compass,
  Users,
  ShieldCheck,
  Heart,
  Star,
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  Building,
  X,
  Globe,
  HelpCircle,
  ChevronDown,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import type {
  AboutPageContent,
  AboutHeroPillar,
  AboutStatItem,
  AboutFeatureCard,
  AboutFaqItem,
} from '@/lib/about-page-content-types';
import {
  DEFAULT_ABOUT_PAGE_CONTENT,
  DEFAULT_ABOUT_OVERVIEW_CARDS,
  DEFAULT_ABOUT_FAQS,
} from '@/lib/about-page-content-types';
import {
  saveAboutPageContentAction,
  uploadAboutHeroImageAction,
  uploadAboutStoryImageAction,
} from './actions';
import { ModalPortal } from '@/components/ui/modal-portal';

interface AboutPageEditorProps {
  initialContent?: AboutPageContent;
  isAdmin?: boolean;
}

export function AboutPageEditor({
  initialContent = DEFAULT_ABOUT_PAGE_CONTENT,
  isAdmin = true,
}: AboutPageEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<AboutPageContent>(() => ({
    ...DEFAULT_ABOUT_PAGE_CONTENT,
    ...initialContent,
    overview_cards:
      Array.isArray(initialContent?.overview_cards) && initialContent.overview_cards.length > 0
        ? initialContent.overview_cards
        : DEFAULT_ABOUT_PAGE_CONTENT.overview_cards,
    faqs:
      initialContent?.faqs?.title && Array.isArray(initialContent?.faqs?.items)
        ? initialContent.faqs
        : DEFAULT_ABOUT_PAGE_CONTENT.faqs,
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [previewFaqOpen, setPreviewFaqOpen] = useState<number | null>(0);

  // Hero Image upload handler
  const handleHeroImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setIsUploadingHero(true);
      const formData = new FormData();
      formData.append('image', file);

      const res = await uploadAboutHeroImageAction(formData);
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
      toast.success('About hero background image uploaded successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Error uploading image.');
    } finally {
      setIsUploadingHero(false);
      e.target.value = '';
    }
  };

  // Story Image upload handler
  const handleStoryImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setIsUploadingStory(true);
      const formData = new FormData();
      formData.append('image', file);

      const res = await uploadAboutStoryImageAction(formData);
      if (!res.success || !res.url) {
        toast.error(res.error || 'Failed to upload story image.');
        return;
      }

      setContent((prev) => ({
        ...prev,
        story: {
          ...prev.story,
          image_url: res.url!,
        },
      }));
      toast.success('Story feature image uploaded successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Error uploading image.');
    } finally {
      setIsUploadingStory(false);
      e.target.value = '';
    }
  };

  // Pillar change
  const handlePillarChange = (index: number, field: keyof AboutHeroPillar, value: string) => {
    setContent((prev) => {
      const updated = [...prev.hero.pillars];
      const current = updated[index] || { icon_key: 'shield', label: '' };
      updated[index] = {
        ...current,
        [field]: value,
      } as AboutHeroPillar;
      return {
        ...prev,
        hero: {
          ...prev.hero,
          pillars: updated,
        },
      };
    });
  };

  // Stat change
  const handleStatChange = (index: number, field: keyof AboutStatItem, value: string) => {
    setContent((prev) => {
      const updated = [...prev.story.stats];
      const current = updated[index] || { value: '', label: '' };
      updated[index] = {
        ...current,
        [field]: value,
      };
      return {
        ...prev,
        story: {
          ...prev.story,
          stats: updated,
        },
      };
    });
  };

  // Overview card change handler
  const handleOverviewCardChange = (
    index: number,
    field: keyof AboutFeatureCard,
    value: any
  ) => {
    setContent((prev) => {
      const cards = [...(prev.overview_cards || DEFAULT_ABOUT_OVERVIEW_CARDS)];
      const current = cards[index] || { heading: '', text: '', bullet_points: [] };
      cards[index] = {
        ...current,
        [field]: value,
      };
      return {
        ...prev,
        overview_cards: cards,
      };
    });
  };

  // Add bullet point to overview card
  const handleAddBulletPoint = (cardIndex: number) => {
    setContent((prev) => {
      const cards = [...(prev.overview_cards || DEFAULT_ABOUT_OVERVIEW_CARDS)];
      const current = cards[cardIndex] || { heading: '', text: '', bullet_points: [] };
      const bullets = [...(current.bullet_points || []), ''];
      cards[cardIndex] = { ...current, bullet_points: bullets };
      return { ...prev, overview_cards: cards };
    });
  };

  // Update specific bullet point
  const handleUpdateBulletPoint = (cardIndex: number, bulletIndex: number, value: string) => {
    setContent((prev) => {
      const cards = [...(prev.overview_cards || DEFAULT_ABOUT_OVERVIEW_CARDS)];
      const current = cards[cardIndex] || { heading: '', text: '', bullet_points: [] };
      const bullets = [...(current.bullet_points || [])];
      bullets[bulletIndex] = value;
      cards[cardIndex] = { ...current, bullet_points: bullets };
      return { ...prev, overview_cards: cards };
    });
  };

  // Remove specific bullet point
  const handleRemoveBulletPoint = (cardIndex: number, bulletIndex: number) => {
    setContent((prev) => {
      const cards = [...(prev.overview_cards || DEFAULT_ABOUT_OVERVIEW_CARDS)];
      const current = cards[cardIndex] || { heading: '', text: '', bullet_points: [] };
      const bullets = (current.bullet_points || []).filter((_, idx) => idx !== bulletIndex);
      cards[cardIndex] = { ...current, bullet_points: bullets };
      return { ...prev, overview_cards: cards };
    });
  };

  // FAQ header change handler
  const handleFaqHeaderChange = (field: 'badge' | 'title' | 'subtitle', value: string) => {
    setContent((prev) => ({
      ...prev,
      faqs: {
        ...(prev.faqs || DEFAULT_ABOUT_FAQS),
        [field]: value,
      },
    }));
  };

  // FAQ item change handler
  const handleFaqItemChange = (index: number, field: keyof AboutFaqItem, value: string) => {
    setContent((prev) => {
      const currentFaqs = prev.faqs || DEFAULT_ABOUT_FAQS;
      const updatedItems = [...currentFaqs.items];
      updatedItems[index] = {
        ...updatedItems[index]!,
        [field]: value,
      };
      return {
        ...prev,
        faqs: {
          ...currentFaqs,
          items: updatedItems,
        },
      };
    });
  };

  // Add FAQ item
  const handleAddFaqItem = () => {
    setContent((prev) => {
      const currentFaqs = prev.faqs || DEFAULT_ABOUT_FAQS;
      return {
        ...prev,
        faqs: {
          ...currentFaqs,
          items: [
            ...currentFaqs.items,
            { question: 'New Question?', answer: 'Answer details here...' },
          ],
        },
      };
    });
  };

  // Remove FAQ item
  const handleRemoveFaqItem = (index: number) => {
    setContent((prev) => {
      const currentFaqs = prev.faqs || DEFAULT_ABOUT_FAQS;
      return {
        ...prev,
        faqs: {
          ...currentFaqs,
          items: currentFaqs.items.filter((_, i) => i !== index),
        },
      };
    });
  };


  // Save changes execution
  const executeSave = async () => {
    setShowConfirmModal(false);
    try {
      setIsSaving(true);
      const res = await saveAboutPageContentAction(content);
      if (!res.success) {
        toast.error(res.error || 'Failed to save about page content.');
        return;
      }
      toast.success('About page content, 4 cards & FAQ saved successfully!');
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save about page content.');
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
            <span className="text-xs text-ink-400 font-medium">• /about page</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-950 mt-1">
            About Us Page Visuals &amp; Content
          </h2>
          <p className="text-xs sm:text-sm text-ink-600 mt-0.5">
            Customize the About hero background photo, centered typography, story narrative, milestone stats, 4 strategic mission/services cards, and tour planning FAQs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              if (!reportThemeErrors(validateAboutPageContent(content))) setShowConfirmModal(true);
            }}
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
            Live Customer-Facing About Page:
          </strong>{' '}
          All content configured here updates the live customer <code className="bg-emerald-100/80 px-1 py-0.5 rounded text-[11px] font-mono">/about</code> page including the top atmospheric hero section with dark luxury background image, the brand story with photo, traveler stats, the 4 mission &amp; services overview cards (2 per row), and the tour planning FAQ dropdown accordion.
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
                {content.hero.title || 'ABOUT TRAVINCO'}
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
                <span>{isUploadingHero ? 'Uploading…' : 'Choose & Upload File'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleHeroImageChange}
                  disabled={isUploadingHero || !isAdmin}
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
            <input data-field="hero.background_image_url"
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
            <input data-field="hero.badge"
              type="text"
              value={content.hero.badge}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, badge: e.target.value },
                }))
              }
              placeholder="Our Heritage & Journey"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Hero Center Title (Primary Heading)
            </label>
            <input data-field="hero.title"
              type="text"
              value={content.hero.title}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, title: e.target.value },
                }))
              }
              placeholder="ABOUT TRAVINCO"
              className="input text-xs sm:text-sm uppercase font-bold"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Hero Subtitle / Description
            </label>
            <textarea data-field="hero.subtitle"
              rows={2}
              value={content.hero.subtitle}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, subtitle: e.target.value },
                }))
              }
              placeholder="We plan trips the way we’d want them planned for ourselves..."
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
                <input data-field={`hero.pillars.${i}.label`}
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

      {/* ── 2. OUR STORY & HERITAGE SECTION ("WHO WE ARE") ── */}
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-ink-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink-950">
                2. Our Story &amp; Agency Milestones (Who We Are)
              </h3>
              <p className="text-xs text-ink-500">
                Share your agency&apos;s story narrative, featured photograph, and key milestone statistics.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Story Copy */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink-900 mb-1">
                Story Badge
              </label>
              <input data-field="story.badge"
                type="text"
                value={content.story.badge}
                onChange={(e) =>
                  setContent((prev) => ({
                    ...prev,
                    story: { ...prev.story, badge: e.target.value },
                  }))
                }
                placeholder="Who We Are"
                className="input text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-900 mb-1">
                Story Main Title
              </label>
              <input data-field="story.title"
                type="text"
                value={content.story.title}
                onChange={(e) =>
                  setContent((prev) => ({
                    ...prev,
                    story: { ...prev.story, title: e.target.value },
                  }))
                }
                placeholder="Crafting meaningful journeys that linger long after..."
                className="input text-xs sm:text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-900 mb-1">
                Paragraph 1 (Founding Vision)
              </label>
              <textarea
                rows={3}
                value={content.story.paragraph_1}
                onChange={(e) =>
                  setContent((prev) => ({
                    ...prev,
                    story: { ...prev.story, paragraph_1: e.target.value },
                  }))
                }
                placeholder="Founded by passionate travelers who believe..."
                className="input text-xs sm:text-sm leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-900 mb-1">
                Paragraph 2 (Commitment to Quality)
              </label>
              <textarea
                rows={3}
                value={content.story.paragraph_2}
                onChange={(e) =>
                  setContent((prev) => ({
                    ...prev,
                    story: { ...prev.story, paragraph_2: e.target.value },
                  }))
                }
                placeholder="Every hotel, luxury houseboat, wildlife lodge..."
                className="input text-xs sm:text-sm leading-relaxed"
              />
            </div>
          </div>

          {/* Right Column: Story Image & Upload */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-ink-900">
              Featured Story Photograph
            </label>
            <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-ink-100 border border-ink-200">
              {content.story.image_url ? (
                <Image
                  src={content.story.image_url}
                  alt="Our Story"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-400">
                  <ImageIcon className="h-10 w-10 stroke-1" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer shadow-xs">
                <Upload className="h-4 w-4 text-brand-600" />
                <span>{isUploadingStory ? 'Uploading…' : 'Upload Story Photo'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleStoryImageChange}
                  disabled={isUploadingStory || !isAdmin}
                  className="hidden"
                />
              </label>
              <input data-field="story.image_url"
                type="text"
                value={content.story.image_url}
                onChange={(e) =>
                  setContent((prev) => ({
                    ...prev,
                    story: { ...prev.story, image_url: e.target.value },
                  }))
                }
                placeholder="Or paste image URL..."
                className="input text-xs font-mono flex-1 h-9"
              />
            </div>
          </div>
        </div>

        {/* Agency Milestone Stats */}
        <div className="pt-4 border-t border-ink-100">
          <label className="block text-xs font-bold text-ink-900 mb-2">
            Agency Milestones &amp; Stats
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {content.story.stats.map((stat, i) => (
              <div key={i} className="rounded-xl bg-ink-50/70 p-3 border border-ink-200 space-y-1.5">
                <label className="block text-[10px] font-bold uppercase text-ink-400">
                  Stat {i + 1}
                </label>
                <input data-field={`story.stats.${i}.value`}
                  type="text"
                  value={stat.value}
                  onChange={(e) => handleStatChange(i, 'value', e.target.value)}
                  placeholder="e.g. 12+"
                  className="input text-sm font-bold bg-white h-8"
                />
                <input data-field={`story.stats.${i}.label`}
                  type="text"
                  value={stat.label}
                  onChange={(e) => handleStatChange(i, 'label', e.target.value)}
                  placeholder="Label e.g. Years"
                  className="input text-xs bg-white h-8"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. STRATEGIC OVERVIEW & SERVICES (4 CARDS, 2 PER ROW) ── */}
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-ink-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink-950">
                3. Strategic Overview &amp; Core Services (4 Cards)
              </h3>
              <p className="text-xs text-ink-500">
                Displayed directly below the &quot;Who We Are&quot; section in a 2-cards-per-row grid on the customer page.
              </p>
            </div>
          </div>
        </div>

        {/* Live Visual Preview of the 4 Cards */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
            Live 4-Cards Preview (2 per row)
          </label>
          <div className="rounded-2xl border border-ink-200 bg-sand-50/60 p-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(content.overview_cards || DEFAULT_ABOUT_OVERVIEW_CARDS).map((card, i) => (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-2xl bg-white p-5 border border-ink-200/90 shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-200">
                        {card.icon_key === 'globe' ? (
                          <Globe className="h-4.5 w-4.5" />
                        ) : card.icon_key === 'shield' ? (
                          <ShieldCheck className="h-4.5 w-4.5" />
                        ) : card.icon_key === 'users' ? (
                          <Users className="h-4.5 w-4.5" />
                        ) : (
                          <Compass className="h-4.5 w-4.5" />
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-ink-400 bg-sand-100 px-2 py-0.5 rounded-full">
                        {`0${i + 1}`}
                      </span>
                    </div>

                    <h4 className="font-display text-sm sm:text-base font-bold text-ink-950">
                      {card.heading || `Card ${i + 1} Heading`}
                    </h4>
                    <p className="mt-2 text-xs text-ink-600 leading-relaxed">
                      {card.text || 'Card description text...'}
                    </p>

                    {card.bullet_points && card.bullet_points.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-ink-100 space-y-2">
                        {card.bullet_points.map((b, bIdx) => (
                          <div key={bIdx} className="flex items-start gap-2 text-xs text-ink-700">
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Cards Editor Form */}
        <div className="space-y-6 pt-2">
          {(content.overview_cards || DEFAULT_ABOUT_OVERVIEW_CARDS).map((card, i) => (
            <div
              key={i}
              className="rounded-2xl border border-ink-200 bg-ink-50/40 p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                    {i + 1}
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-900">
                    Card #{i + 1}: {card.heading || 'Untitled'}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-medium text-ink-500">Icon:</label>
                  <select
                    value={card.icon_key || 'compass'}
                    onChange={(e) => handleOverviewCardChange(i, 'icon_key', e.target.value)}
                    className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs font-medium text-ink-700"
                  >
                    <option value="compass">Compass (Mission)</option>
                    <option value="users">Users (Experts)</option>
                    <option value="globe">Globe (Domestic &amp; Int&apos;l)</option>
                    <option value="shield">Shield (Why Choose)</option>
                    <option value="heart">Heart</option>
                    <option value="star">Star</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-ink-900 mb-1">
                    Card Heading
                  </label>
                  <input data-field={`overview_cards.${i}.heading`}
                    type="text"
                    value={card.heading}
                    onChange={(e) => handleOverviewCardChange(i, 'heading', e.target.value)}
                    placeholder="Card heading..."
                    className="input text-xs sm:text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-900 mb-1">
                    Card Text / Content
                  </label>
                  <textarea data-field={`overview_cards.${i}.text`}
                    rows={3}
                    value={card.text}
                    onChange={(e) => handleOverviewCardChange(i, 'text', e.target.value)}
                    placeholder="Card description text..."
                    className="input text-xs sm:text-sm leading-relaxed"
                  />
                </div>

                {/* Bullet points section for cards that include them */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-ink-900">
                      Bullet Points ({card.bullet_points?.length || 0})
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddBulletPoint(i)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Bullet Point</span>
                    </button>
                  </div>

                  {card.bullet_points && card.bullet_points.length > 0 ? (
                    <div className="space-y-2">
                      {card.bullet_points.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-ink-400 w-5 text-right shrink-0">
                            {bIdx + 1}.
                          </span>
                          <input
                            type="text"
                            value={bullet}
                            onChange={(e) =>
                              handleUpdateBulletPoint(i, bIdx, e.target.value)
                            }
                            placeholder="e.g. Service Title: Description of service..."
                            className="input text-xs bg-white flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveBulletPoint(i, bIdx)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                            title="Remove Bullet"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink-400 italic">
                      No bullet points for this card (standard paragraph card). Click &quot;Add Bullet Point&quot; above if you wish to add bullet items.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. FREQUENTLY ASKED QUESTIONS (FAQ DROPDOWNS) ── */}
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-ink-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink-950">
                4. Frequently Asked Questions (Tour Planning FAQ)
              </h3>
              <p className="text-xs text-ink-500">
                Displayed in an interactive accordion dropdown directly below the 4 feature cards on the customer page.
              </p>
            </div>
          </div>
        </div>

        {/* Live Interactive Preview of FAQ Accordion */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
            Live FAQ Accordion Preview (Click to test dropdowns)
          </label>
          <div className="rounded-2xl border border-ink-200 bg-sand-50/60 p-5 sm:p-6">
            <div className="text-center max-w-xl mx-auto mb-6">
              {(content.faqs?.badge || DEFAULT_ABOUT_FAQS.badge) && (
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200 mb-2">
                  {content.faqs?.badge || DEFAULT_ABOUT_FAQS.badge}
                </span>
              )}
              <h4 className="font-display text-base sm:text-lg font-bold text-ink-950">
                {content.faqs?.title || DEFAULT_ABOUT_FAQS.title}
              </h4>
              {(content.faqs?.subtitle || DEFAULT_ABOUT_FAQS.subtitle) && (
                <p className="text-xs text-ink-600 mt-1">
                  {content.faqs?.subtitle || DEFAULT_ABOUT_FAQS.subtitle}
                </p>
              )}
            </div>

            <div className="space-y-3 max-w-2xl mx-auto">
              {(content.faqs?.items || DEFAULT_ABOUT_FAQS.items).map((item, idx) => {
                const isOpen = previewFaqOpen === idx;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border transition-all ${
                      isOpen
                        ? 'bg-white border-brand-300 shadow-sm'
                        : 'bg-white/80 border-ink-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewFaqOpen(isOpen ? null : idx)}
                      className="flex w-full items-center justify-between p-4 text-left cursor-pointer"
                    >
                      <span className="font-display text-xs sm:text-sm font-bold text-ink-950">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-ink-400 transition-transform ${
                          isOpen ? 'rotate-180 text-brand-600' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-ink-100">
                        <p className="text-xs text-ink-600 leading-relaxed">{item.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section Headings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              FAQ Section Badge
            </label>
            <input data-field="faqs.badge"
              type="text"
              value={content.faqs?.badge ?? ''}
              onChange={(e) => handleFaqHeaderChange('badge', e.target.value)}
              placeholder="FAQ"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-ink-900 mb-1">
              FAQ Section Main Heading
            </label>
            <input data-field="faqs.title"
              type="text"
              value={content.faqs?.title ?? ''}
              onChange={(e) => handleFaqHeaderChange('title', e.target.value)}
              placeholder="Frequently Asked Questions About Our Tour Planning Services"
              className="input text-xs sm:text-sm font-semibold"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-ink-900 mb-1">
              FAQ Section Subtitle
            </label>
            <input data-field="faqs.subtitle"
              type="text"
              value={content.faqs?.subtitle ?? ''}
              onChange={(e) => handleFaqHeaderChange('subtitle', e.target.value)}
              placeholder="Find clear answers to common questions about booking, customizing, and traveling..."
              className="input text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* FAQ Items Editor List */}
        <div className="space-y-4 pt-3 border-t border-ink-100">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-ink-900">
              Questions &amp; Answers ({(content.faqs?.items || []).length})
            </label>
            <button
              type="button"
              onClick={handleAddFaqItem}
              className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-brand-600" />
              <span>Add FAQ Question</span>
            </button>
          </div>

          <div className="space-y-4">
            {(content.faqs?.items || []).map((faqItem, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-ink-200 bg-ink-50/50 p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Question #{idx + 1}
                  </span>
                  {(content.faqs?.items || []).length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFaqItem(idx)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Question
                  </label>
                  <input
                    type="text"
                    data-field={`faqs.items.${idx}.question`}
                    value={faqItem.question}
                    onChange={(e) => handleFaqItemChange(idx, 'question', e.target.value)}
                    placeholder="Enter question..."
                    className="input text-xs sm:text-sm bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Answer
                  </label>
                  <textarea
                    rows={2}
                    data-field={`faqs.items.${idx}.answer`}
                    value={faqItem.answer}
                    onChange={(e) => handleFaqItemChange(idx, 'answer', e.target.value)}
                    placeholder="Enter comprehensive answer..."
                    className="input text-xs sm:text-sm bg-white leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. BOTTOM CTA BANNER ── */}
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-ink-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink-950">
                5. Bottom Call To Action Banner
              </h3>
              <p className="text-xs text-ink-500">
                Encourage prospective travelers to begin planning their holiday at the end of the About page.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Banner Small Badge
            </label>
            <input data-field="bottom_cta.badge"
              type="text"
              value={content.bottom_cta.badge}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  bottom_cta: { ...prev.bottom_cta, badge: e.target.value },
                }))
              }
              placeholder="Start Your Story With Us"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Banner Main Heading
            </label>
            <input data-field="bottom_cta.title"
              type="text"
              value={content.bottom_cta.title}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  bottom_cta: { ...prev.bottom_cta, title: e.target.value },
                }))
              }
              placeholder="Ready to design your dream getaway?"
              className="input text-xs sm:text-sm font-semibold"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-ink-900 mb-1">
              Banner Description
            </label>
            <textarea data-field="bottom_cta.description"
              rows={2}
              value={content.bottom_cta.description}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  bottom_cta: { ...prev.bottom_cta, description: e.target.value },
                }))
              }
              placeholder="Speak directly with a private travel specialist who will handcraft..."
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 mb-1">
              CTA Button Text
            </label>
            <input data-field="bottom_cta.button_text"
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
            <input data-field="bottom_cta.button_link"
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
            Unsaved changes will be published to the customer About page when saved.
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
              if (!reportThemeErrors(validateAboutPageContent(content))) setShowConfirmModal(true);
            }}
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
                      Publish About Page Changes?
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
                Are you sure you want to save these changes? The new hero visuals, story section, milestone stats, 4 mission &amp; services cards, and tour planning FAQs will be updated immediately on the live customer About page.
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
