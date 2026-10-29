'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Star,
  Pencil,
  Type,
  Save,
  Upload,
  ShieldCheck,
  Compass,
  Clock,
  MessageCircle,
  Phone,
  CheckCircle2,
  Image as ImageIcon,
  Headphones,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import type {
  ContactPageContent,
  ContactHeroPillar,
} from '@/lib/contact-page-content-types';
import { DEFAULT_CONTACT_PAGE_CONTENT } from '@/lib/contact-page-content-types';
import {
  saveContactPageContentAction,
  uploadContactHeroImageAction,
} from './actions';

interface ContactPageEditorProps {
  initialContent?: ContactPageContent;
  isAdmin?: boolean;
}

const PILLAR_ICONS = [
  { key: 'clock', label: 'Clock', icon: Clock },
  { key: 'compass', label: 'Compass', icon: Compass },
  { key: 'message', label: 'Message / Chat', icon: MessageCircle },
  { key: 'phone', label: 'Phone', icon: Phone },
  { key: 'shield', label: 'Shield / Security', icon: ShieldCheck },
  { key: 'star', label: 'Star / Luxury', icon: Star },
] as const;

const CURATED_IMAGES = [
  {
    name: 'Luxury Travel Concierge',
    url: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=2000&q=80',
  },
  {
    name: 'Scenic Mountain & Valley',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2000&q=80',
  },
  {
    name: 'Tropical Coast & Palms',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80',
  },
  {
    name: 'Kerala Serene Backwaters',
    url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=2000&q=80',
  },
];

export function ContactPageEditor({
  initialContent = DEFAULT_CONTACT_PAGE_CONTENT,
  isAdmin = true,
}: ContactPageEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<ContactPageContent>(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Image file upload handler
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

      const res = await uploadContactHeroImageAction(formData);
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
      e.target.value = '';
    }
  };

  // Pillar change handler
  const handlePillarChange = (
    index: number,
    field: keyof ContactHeroPillar,
    value: string
  ) => {
    setContent((prev) => {
      const updated = [...prev.hero.pillars];
      const current = updated[index] || { icon_key: 'clock', label: '' };
      updated[index] = {
        ...current,
        [field]: value,
      } as ContactHeroPillar;
      return {
        ...prev,
        hero: {
          ...prev.hero,
          pillars: updated,
        },
      };
    });
  };

  // Save changes handler
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await saveContactPageContentAction(content);
      if (!res.success) {
        toast.error(res.error || 'Failed to save contact page content.');
        return;
      }
      toast.success('Contact page visuals & content saved successfully!');
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save contact page content.');
    } finally {
      setIsSaving(false);
    }
  };

  const getPillarIcon = (iconKey?: string) => {
    const found = PILLAR_ICONS.find((i) => i.key === iconKey);
    return found ? found.icon : Clock;
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
            <span className="text-xs text-ink-400 font-medium">• /contact page</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-950 mt-1">
            Contact Page Visuals &amp; Content
          </h2>
          <p className="text-xs sm:text-sm text-ink-600 mt-0.5">
            Customize the top Hero background photo, atmospheric overlay, titles, trust pillars, and contact section headings.
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

      {/* ── Live Hero Preview ── */}
      <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-ink-50/80 border-b border-ink-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-ink-800 uppercase tracking-wider">
              Live Hero Preview (Matches Customer View)
            </span>
          </div>
          <span className="text-[11px] text-ink-500">Live preview reflects edits below</span>
        </div>

        <div className="relative overflow-hidden bg-navy-950 text-white py-16 sm:py-20 px-6 sm:px-12 text-center">
          {/* Background Image & Overlay */}
          {content.hero?.background_image_url && (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-500"
              style={{ backgroundImage: `url(${content.hero.background_image_url})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950/95 backdrop-blur-[1px]" />
            </div>
          )}

          {/* Ambient Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
            {content.hero?.badge && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wider uppercase text-sand-300 border border-white/20 backdrop-blur-md mb-4 shadow-sm">
                {content.hero.badge}
              </span>
            )}

            <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-extrabold uppercase text-white tracking-tight drop-shadow-md">
              {content.hero?.title || 'CONTACT US'}
            </h1>

            {content.hero?.subtitle && (
              <p className="mt-3 text-sm sm:text-base text-white/85 font-light leading-relaxed max-w-xl">
                {content.hero.subtitle}
              </p>
            )}

            {/* Highlights / Trust Pillars */}
            {content.hero?.pillars && content.hero.pillars.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-5 text-xs sm:text-sm text-white/85 font-medium">
                {content.hero.pillars.map((pillar, i) => {
                  const PillarIcon = getPillarIcon(pillar.icon_key);
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <PillarIcon className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{pillar.label || `Pillar ${i + 1}`}</span>
                      {i < content.hero.pillars.length - 1 && (
                        <span className="ml-3 text-white/30 hidden sm:inline">•</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 1: Hero Visuals & Background Photo ── */}
      <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-200">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink-950">
              1. Hero Background Image &amp; Media
            </h3>
            <p className="text-xs text-ink-500">
              Upload a high-resolution photo or select a curated background image.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Upload or URL Row */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Hero Background Image URL
            </label>
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <input
                type="url"
                value={content.hero?.background_image_url || ''}
                onChange={(e) =>
                  setContent((prev) => ({
                    ...prev,
                    hero: { ...prev.hero, background_image_url: e.target.value },
                  }))
                }
                placeholder="https://images.unsplash.com/..."
                className="input text-xs sm:text-sm flex-1 font-mono"
              />
              <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 text-xs font-semibold cursor-pointer transition shrink-0">
                <Upload className="h-4 w-4" />
                <span>{isUploading ? 'Uploading…' : 'Upload Image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFileChange}
                  disabled={isUploading || !isAdmin}
                  className="hidden"
                />
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-500">
              Recommended: 1920x1080 or higher JPG/PNG/WebP. A dark gradient is automatically overlaid for maximum text legibility.
            </p>
          </div>

          {/* Quick Pick Curated Backgrounds */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-2">
              Or Pick A Curated Atmosphere:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CURATED_IMAGES.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setContent((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, background_image_url: item.url },
                    }))
                  }
                  className={`group relative rounded-xl overflow-hidden border p-2 text-left transition cursor-pointer flex flex-col justify-end h-24 ${
                    content.hero?.background_image_url === item.url
                      ? 'border-brand-600 ring-2 ring-brand-500/30 shadow-xs'
                      : 'border-ink-200 hover:border-brand-400'
                  }`}
                  style={{
                    backgroundImage: `linear-gradient(to top, rgba(15,23,42,0.85), rgba(15,23,42,0.2)), url(${item.url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <span className="text-[11px] font-semibold text-white leading-tight drop-shadow-sm">
                    {item.name}
                  </span>
                  {content.hero?.background_image_url === item.url && (
                    <span className="absolute top-1.5 right-1.5 bg-brand-600 text-white p-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Hero Header & Typography ── */}
      <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 text-sand-800 border border-sand-300">
            <Type className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink-950">
              2. Hero Titles &amp; Typography
            </h3>
            <p className="text-xs text-ink-500">
              Configure the pill badge, display heading, and welcoming subtitle text.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Hero Badge (Pill)
            </label>
            <input
              type="text"
              value={content.hero?.badge || ''}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, badge: e.target.value },
                }))
              }
              placeholder="e.g. We're Here For You"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Hero Display Title (H1)
            </label>
            <input
              type="text"
              value={content.hero?.title || ''}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, title: e.target.value },
                }))
              }
              placeholder="e.g. CONTACT US"
              className="input text-xs sm:text-sm uppercase font-bold"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Hero Subtitle / Description
            </label>
            <textarea
              rows={2}
              value={content.hero?.subtitle || ''}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, subtitle: e.target.value },
                }))
              }
              placeholder="e.g. Tell us where you want to go, and our bespoke trip designers will tailor your journey down to the finest detail."
              className="input text-xs sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Section 3: Trust Highlights / Hero Pillars ── */}
      <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink-950">
              3. Hero Trust Pillars (3 Highlights)
            </h3>
            <p className="text-xs text-ink-500">
              Key assurances displayed right under the hero title (e.g., response time, WhatsApp, personal concierge).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((idx) => {
            const pillar = content.hero?.pillars?.[idx] || { label: '', icon_key: 'clock' };
            return (
              <div
                key={idx}
                className="rounded-xl border border-ink-200 p-4 bg-sand-50/40 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                    Pillar #{idx + 1}
                  </span>
                  <span className="text-[10px] text-ink-400">Trust Badge</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-600 mb-1">
                    Icon
                  </label>
                  <select
                    value={pillar.icon_key || 'clock'}
                    onChange={(e) =>
                      handlePillarChange(idx, 'icon_key', e.target.value as any)
                    }
                    className="input text-xs"
                  >
                    {PILLAR_ICONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-600 mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={pillar.label || ''}
                    onChange={(e) => handlePillarChange(idx, 'label', e.target.value)}
                    placeholder="e.g. Rapid 2-Hour Response"
                    className="input text-xs"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Contact Details ── */}
      <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-200">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink-950">
              4. Contact Details
            </h3>
            <p className="text-xs text-ink-500">
              Phone, WhatsApp, email, office address, working hours and map shown on the Contact page. The WhatsApp number also powers the WhatsApp button in the site header.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Phone Number
            </label>
            <input
              type="text"
              value={content.phone || ''}
              onChange={(e) =>
                setContent((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="e.g. +91 98765 43210"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={content.email || ''}
              onChange={(e) =>
                setContent((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="e.g. hello@travinco.com"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              WhatsApp Number
            </label>
            <input
              type="text"
              value={content.whatsapp || ''}
              onChange={(e) =>
                setContent((prev) => ({ ...prev, whatsapp: e.target.value }))
              }
              placeholder="e.g. +91 98765 43210"
              className="input text-xs sm:text-sm"
            />
            <p className="mt-1 text-[11px] text-ink-500">
              Used for the header WhatsApp button and the Contact page chat link.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Working Hours
            </label>
            <input
              type="text"
              value={content.working_hours || ''}
              onChange={(e) =>
                setContent((prev) => ({ ...prev, working_hours: e.target.value }))
              }
              placeholder="e.g. Mon – Sat, 9:30 AM – 6:30 PM"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Office Address
            </label>
            <textarea
              rows={2}
              value={content.address || ''}
              onChange={(e) =>
                setContent((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder="e.g. 2nd Floor, MG Road, Kochi, Kerala 682016"
              className="input text-xs sm:text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
              Google Maps Embed URL
            </label>
            <input
              type="url"
              value={content.map_embed_url || ''}
              onChange={(e) =>
                setContent((prev) => ({ ...prev, map_embed_url: e.target.value }))
              }
              placeholder="https://www.google.com/maps/embed?pb=..."
              className="input text-xs sm:text-sm"
            />
            <p className="mt-1 text-[11px] text-ink-500">
              In Google Maps: Share → Embed a map → copy only the <code>src</code> URL from the iframe code.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 5: Contact Section Headings ── */}
      <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink-950">
              5. Contact Section Headings (Below Hero)
            </h3>
            <p className="text-xs text-ink-500">
              Customize the section headings for the direct assistance cards and inquiry form.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left card headings: Direct Assistance */}
          <div className="p-4 rounded-xl border border-ink-150 bg-ink-50/30 space-y-3">
            <div className="flex items-center gap-2">
              <Headphones className="h-4 w-4 text-brand-600" />
              <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                Direct Assistance Section (Left Column)
              </h4>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-600 mb-1">
                Badge
              </label>
              <input
                type="text"
                value={content.info_badge || ''}
                onChange={(e) =>
                  setContent((prev) => ({ ...prev, info_badge: e.target.value }))
                }
                placeholder="e.g. Direct Assistance"
                className="input text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-600 mb-1">
                Title
              </label>
              <input
                type="text"
                value={content.info_title || ''}
                onChange={(e) =>
                  setContent((prev) => ({ ...prev, info_title: e.target.value }))
                }
                placeholder="e.g. Speak with our travel specialists"
                className="input text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-600 mb-1">
                Subtitle
              </label>
              <textarea
                rows={2}
                value={content.info_subtitle || ''}
                onChange={(e) =>
                  setContent((prev) => ({ ...prev, info_subtitle: e.target.value }))
                }
                placeholder="e.g. Reach out via phone, WhatsApp, email, or visit our local concierge office."
                className="input text-xs"
              />
            </div>
          </div>

          {/* Right card headings: Inquiry Form */}
          <div className="p-4 rounded-xl border border-ink-150 bg-ink-50/30 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-brand-600" />
              <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                Inquiry Form Section (Right Column)
              </h4>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-600 mb-1">
                Badge
              </label>
              <input
                type="text"
                value={content.form_badge || ''}
                onChange={(e) =>
                  setContent((prev) => ({ ...prev, form_badge: e.target.value }))
                }
                placeholder="e.g. Send an Inquiry"
                className="input text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-600 mb-1">
                Title
              </label>
              <input
                type="text"
                value={content.form_title || ''}
                onChange={(e) =>
                  setContent((prev) => ({ ...prev, form_title: e.target.value }))
                }
                placeholder="e.g. Plan Your Next Journey With Us"
                className="input text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-600 mb-1">
                Subtitle
              </label>
              <textarea
                rows={2}
                value={content.form_subtitle || ''}
                onChange={(e) =>
                  setContent((prev) => ({ ...prev, form_subtitle: e.target.value }))
                }
                placeholder="e.g. Fill out the form below and our destination concierge will prepare your tailored travel proposal."
                className="input text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Save Sticky Bar ── */}
      <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-2xl bg-white/95 backdrop-blur-md p-4 border border-ink-200 shadow-xl">
        <div className="flex items-center gap-2 text-xs text-ink-600">
          <span className="h-2 w-2 rounded-full bg-brand-500" />
          <span>Save changes when you&apos;re done editing. Updates reflect live immediately.</span>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !isAdmin}
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Saving…' : 'Save Contact Content'}</span>
        </button>
      </div>
    </div>
  );
}
