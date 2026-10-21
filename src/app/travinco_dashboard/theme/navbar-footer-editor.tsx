'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Loader2,
  Sparkles,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  ChevronDown,
  Layout,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type NavbarFooterContent,
  type NavPageLink,
  DEFAULT_NAVBAR_FOOTER_CONTENT,
} from '@/lib/navbar-footer-content-types';
import {
  saveNavbarFooterContentAction,
  uploadNavbarLogoAction,
} from './actions';

interface NavbarFooterEditorProps {
  initialContent?: NavbarFooterContent;
  isAdmin?: boolean;
}

export function NavbarFooterEditor({
  initialContent = DEFAULT_NAVBAR_FOOTER_CONTENT,
  isAdmin = true,
}: NavbarFooterEditorProps) {
  const [content, setContent] = useState<NavbarFooterContent>(initialContent);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploadingDark, setIsUploadingDark] = useState(false);
  const [isUploadingLight, setIsUploadingLight] = useState(false);

  const darkLogoInputRef = useRef<HTMLInputElement>(null);
  const lightLogoInputRef = useRef<HTMLInputElement>(null);

  // Helper to update navbar subfield
  function updateNavbar<K extends keyof NavbarFooterContent['navbar']>(
    field: K,
    value: NavbarFooterContent['navbar'][K]
  ) {
    setContent((prev) => ({
      ...prev,
      navbar: { ...prev.navbar, [field]: value },
    }));
  }

  // Helper to update footer subfield
  function updateFooter<K extends keyof NavbarFooterContent['footer']>(
    field: K,
    value: NavbarFooterContent['footer'][K]
  ) {
    setContent((prev) => ({
      ...prev,
      footer: { ...prev.footer, [field]: value },
    }));
  }

  // Helper to update social links
  function updateSocial(network: string, url: string) {
    setContent((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        social: { ...prev.footer.social, [network]: url },
      },
    }));
  }

  // Handle uploading logo files
  async function handleLogoUpload(file: File, type: 'dark' | 'light') {
    if (!file) return;

    try {
      if (type === 'dark') setIsUploadingDark(true);
      else setIsUploadingLight(true);

      const fd = new FormData();
      fd.append('image', file);
      const res = await uploadNavbarLogoAction(fd);
      if (res.success && res.url) {
        if (type === 'dark') {
          updateNavbar('logo_image_url', res.url);
        } else {
          updateNavbar('logo_light_image_url', res.url);
        }
        if (content.navbar.logo_type === 'text') {
          updateNavbar('logo_type', 'image');
        }
        toast.success(
          type === 'dark'
            ? 'Scrolled Green logo uploaded successfully'
            : 'Initial Load White logo uploaded successfully'
        );
      } else {
        toast.error(res.error || 'Failed to upload logo');
      }
    } catch {
      toast.error('Error uploading logo');
    } finally {
      if (type === 'dark') {
        setIsUploadingDark(false);
        if (darkLogoInputRef.current) darkLogoInputRef.current.value = '';
      } else {
        setIsUploadingLight(false);
        if (lightLogoInputRef.current) lightLogoInputRef.current.value = '';
      }
    }
  }

  // Update specific nav link label or visibility
  function updateNavLink(index: number, patch: Partial<NavPageLink>) {
    setContent((prev) => {
      const nextLinks = [...prev.navbar.nav_links];
      const target = nextLinks[index];
      if (!target) return prev;
      nextLinks[index] = { ...target, ...patch };
      return {
        ...prev,
        navbar: { ...prev.navbar, nav_links: nextLinks },
      };
    });
  }

  // Add a new custom nav link
  function addNavLink() {
    setContent((prev) => ({
      ...prev,
      navbar: {
        ...prev.navbar,
        nav_links: [
          ...prev.navbar.nav_links,
          {
            key: `custom_${Date.now()}`,
            href: '/offers',
            label: 'Special Offers',
            visible: true,
          },
        ],
      },
    }));
  }

  // Remove nav link (only custom links)
  function removeNavLink(index: number) {
    setContent((prev) => {
      const next = [...prev.navbar.nav_links];
      next.splice(index, 1);
      return {
        ...prev,
        navbar: { ...prev.navbar, nav_links: next },
      };
    });
  }

  // Helper for footer links (explore / company)
  function updateFooterLink(
    column: 'explore_links' | 'company_links',
    index: number,
    field: 'label' | 'href',
    val: string
  ) {
    setContent((prev) => {
      const list = [...prev.footer[column]];
      const target = list[index];
      if (!target) return prev;
      list[index] = { ...target, [field]: val };
      return {
        ...prev,
        footer: { ...prev.footer, [column]: list },
      };
    });
  }

  function addFooterLink(column: 'explore_links' | 'company_links') {
    setContent((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        [column]: [
          ...prev.footer[column],
          {
            id: String(Date.now()),
            label: 'New Link',
            href: '/',
          },
        ],
      },
    }));
  }

  function removeFooterLink(column: 'explore_links' | 'company_links', index: number) {
    setContent((prev) => {
      const list = [...prev.footer[column]];
      list.splice(index, 1);
      return {
        ...prev,
        footer: { ...prev.footer, [column]: list },
      };
    });
  }

  // Save all changes
  function handleSaveAll() {
    startTransition(async () => {
      const res = await saveNavbarFooterContentAction(content);
      if (res.success) {
        toast.success('Navbar and footer contents saved successfully! Live customer layout updated.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to save changes');
      }
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* ── Top Bar with Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-white p-5 border border-ink-150 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-ink-900">
              Navbar & Footer Visuals & Content Editor
            </h2>
            <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
              Customer Layout
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Customize both logos (scrolled & transparent hero), edit all navigation page titles, and control the customer footer.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isPending}
            className="btn-primary inline-flex items-center gap-2 shadow-sm shrink-0 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Changes…</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save All Changes</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ── SECTION 1: NAVBAR (HEADER) SETTINGS ── */}
      <div className="rounded-2xl bg-white p-6 border border-ink-150 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
            <Layout className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink-900">Navigation Bar (Navbar) Settings</h3>
            <p className="text-xs text-ink-500">
              Configure dual logos for dynamic scroll transitions, brand text, page titles, and call-to-action buttons.
            </p>
          </div>
        </div>

        {/* 1A: Logo Configuration with Dual Logos */}
        <div className="space-y-5 rounded-xl bg-sand-50/50 p-5 border border-sand-200">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700">
              1. Brand Logos & Dual-State Scroll Appearance
            </h4>
            <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200/60">
              Dynamic Scroll Enabled
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Logo Display Style</label>
              <select
                className="input"
                value={content.navbar.logo_type}
                onChange={(e) =>
                  updateNavbar('logo_type', e.target.value as 'text' | 'image' | 'both')
                }
              >
                <option value="image">Image Only (Custom Graphic Logos - Active)</option>
                <option value="both">Both (Image Icon + Brand Name Text)</option>
                <option value="text">Text Only (Brand Title)</option>
              </select>
              <p className="mt-1 text-[11px] text-ink-400">
                Customer navbar displays the dual logo images (White logo on initial load, Green logo when scrolled).
              </p>
            </div>

            <div>
              <label className="label">Brand Name (Alt text & fallback)</label>
              <input
                type="text"
                className="input"
                value={content.navbar.logo_text}
                onChange={(e) => updateNavbar('logo_text', e.target.value)}
                placeholder="e.g. Travinco"
              />
              <p className="mt-1 text-[11px] text-ink-400">
                Brand title used for accessibility, image alt tags, and footer.
              </p>
            </div>
          </div>

          {/* Dual Logo Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
            {/* Logo 1: Scrolled / Solid Header Logo (Green logo for white background) */}
            <div className="rounded-xl border border-ink-200 bg-white p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Layout className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-ink-900">Scrolled Navbar Logo (Green Logo)</h5>
                    <p className="text-[11px] text-ink-500">For white navbar when scrolling & internal pages (/images/green_logo.png)</p>
                  </div>
                </div>
                {content.navbar.logo_image_url && (
                  <button
                    type="button"
                    onClick={() => updateNavbar('logo_image_url', '')}
                    className="p-1.5 text-coral-600 hover:bg-coral-50 rounded-lg transition"
                    title="Reset to default green logo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Upload & URL input */}
              <div className="flex items-center gap-2">
                <input
                  ref={darkLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f, 'dark');
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => darkLogoInputRef.current?.click()}
                  disabled={isUploadingDark}
                  className="btn-outline text-xs inline-flex items-center gap-1.5 bg-white cursor-pointer shrink-0"
                >
                  {isUploadingDark ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 text-brand-600" />
                  )}
                  <span>{isUploadingDark ? 'Uploading…' : 'Upload File'}</span>
                </button>
                <input
                  type="text"
                  className="input h-9 text-xs font-mono"
                  value={content.navbar.logo_image_url}
                  onChange={(e) => updateNavbar('logo_image_url', e.target.value)}
                  placeholder="Or enter image URL (e.g. /images/green_logo.png)"
                />
              </div>

              {/* Preview over white box */}
              <div className="h-16 rounded-lg border border-ink-150 bg-white flex items-center justify-center p-2 relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={content.navbar.logo_image_url || '/images/green_logo.png'}
                  alt="Scrolled Green Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>

            {/* Logo 2: Transparent Header Logo (White logo for dark hero background) */}
            <div className="rounded-xl border border-navy-800 bg-navy-950 p-4 space-y-3 shadow-2xs text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white">
                    <Layout className="h-4 w-4 text-ocean-300" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Initial Load Hero Logo (White Logo)</h5>
                    <p className="text-[11px] text-white/60">White logo shown when application loads over the dark hero banner (/images/white_logo.png)</p>
                  </div>
                </div>
                {content.navbar.logo_light_image_url && (
                  <button
                    type="button"
                    onClick={() => updateNavbar('logo_light_image_url', '')}
                    className="p-1.5 text-coral-400 hover:bg-white/10 rounded-lg transition"
                    title="Reset to default white logo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Upload & URL input */}
              <div className="flex items-center gap-2">
                <input
                  ref={lightLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f, 'light');
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => lightLogoInputRef.current?.click()}
                  disabled={isUploadingLight}
                  className="btn-outline text-xs inline-flex items-center gap-1.5 bg-white/10 text-white border-white/20 hover:bg-white/20 cursor-pointer shrink-0"
                >
                  {isUploadingLight ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 text-ocean-300" />
                  )}
                  <span>{isUploadingLight ? 'Uploading…' : 'Upload File'}</span>
                </button>
                <input
                  type="text"
                  className="input h-9 text-xs font-mono bg-white/10 text-white border-white/20 placeholder:text-white/40"
                  value={content.navbar.logo_light_image_url || ''}
                  onChange={(e) => updateNavbar('logo_light_image_url', e.target.value)}
                  placeholder="Or enter image URL (e.g. /images/white_logo.png)"
                />
              </div>

              {/* Preview over dark box */}
              <div className="h-16 rounded-lg border border-white/10 bg-navy-900 flex items-center justify-center p-2 relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={content.navbar.logo_light_image_url || '/images/white_logo.png'}
                  alt="Initial Load White Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 1B: Navbar Page Names & Links */}
        <div className="space-y-4 rounded-xl bg-sand-50/50 p-5 border border-sand-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700">
                2. Menu Page Names & Navigation Links
              </h4>
              <p className="text-[11px] text-ink-500">
                Rename the page labels shown in the customer navigation bar and toggle their visibility.
              </p>
            </div>

            <button
              type="button"
              onClick={addNavLink}
              className="btn-outline text-xs inline-flex items-center gap-1.5 bg-white cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-brand-600" />
              <span>Add Custom Menu Link</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {content.navbar.nav_links.map((link, idx) => (
              <div
                key={link.key || idx}
                className="flex flex-wrap items-center gap-2.5 rounded-xl bg-white p-3 border border-ink-150 shadow-2xs"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700 border border-brand-200 shrink-0">
                  {idx + 1}
                </div>

                {/* Display Label input */}
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide">
                    Display Label / Page Name
                  </label>
                  <input
                    type="text"
                    className="input h-8 text-xs font-semibold text-ink-900"
                    value={link.label}
                    onChange={(e) => updateNavLink(idx, { label: e.target.value })}
                    placeholder="e.g. Home, Packages"
                  />
                </div>

                {/* Link URL / Path */}
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide">
                    Target Route / URL
                  </label>
                  <input
                    type="text"
                    className="input h-8 text-xs font-mono text-ink-700"
                    value={link.href}
                    onChange={(e) => updateNavLink(idx, { href: e.target.value })}
                    placeholder="/packages"
                  />
                </div>

                {/* Visibility Toggle */}
                <div className="flex items-center gap-1.5 shrink-0 pt-4 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => updateNavLink(idx, { visible: !link.visible })}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer border ${
                      link.visible
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-sand-100 text-ink-500 border-sand-300'
                    }`}
                    title={link.visible ? 'Visible in menu' : 'Hidden from menu'}
                  >
                    {link.visible ? (
                      <>
                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5 text-ink-400" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>

                  {/* Delete button for custom links */}
                  {link.key.startsWith('custom_') && (
                    <button
                      type="button"
                      onClick={() => removeNavLink(idx)}
                      className="p-1.5 text-coral-600 hover:bg-coral-50 rounded-lg transition"
                      title="Delete link"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 1C: Header CTAs */}
        <div className="space-y-4 rounded-xl bg-sand-50/50 p-5 border border-sand-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700">
            3. Call-To-Action (CTA) Button
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Primary CTA Button Text</label>
              <input
                type="text"
                className="input"
                value={content.navbar.cta_button_text}
                onChange={(e) => updateNavbar('cta_button_text', e.target.value)}
                placeholder="Book with Us"
              />
            </div>

            <div>
              <label className="label">Primary CTA Destination URL</label>
              <input
                type="text"
                className="input font-mono text-xs"
                value={content.navbar.cta_button_url}
                onChange={(e) => updateNavbar('cta_button_url', e.target.value)}
                placeholder="/booking"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: FOOTER SETTINGS ── */}
      <div className="rounded-2xl bg-white p-6 border border-ink-150 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
            <Layout className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink-900">Footbar (Footer) Settings</h3>
            <p className="text-xs text-ink-500">
              Customize company brand description, social links, column links, and contact info in the site footer.
            </p>
          </div>
        </div>

        {/* 2A: Brand & Socials */}
        <div className="space-y-4 rounded-xl bg-sand-50/50 p-5 border border-sand-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700">
            1. Footer Brand Narrative & Social Channels
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Brand Name</label>
              <input
                type="text"
                className="input"
                value={content.footer.brand_name}
                onChange={(e) => updateFooter('brand_name', e.target.value)}
                placeholder="Travinco"
              />
            </div>

            <div>
              <label className="label">Brand Tagline / Story</label>
              <input
                type="text"
                className="input"
                value={content.footer.brand_tagline}
                onChange={(e) => updateFooter('brand_tagline', e.target.value)}
                placeholder="Handpicked holidays and end-to-end trip planning..."
              />
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-700">Social Media Links</label>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-ink-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={content.footer.show_social}
                  onChange={(e) => updateFooter('show_social', e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Display Social Icons</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-ink-500 flex items-center gap-1.5">
                  <Facebook className="h-3.5 w-3.5 text-blue-600" /> Facebook
                </label>
                <input
                  type="url"
                  className="input h-8 text-xs"
                  value={content.footer.social?.facebook || ''}
                  onChange={(e) => updateSocial('facebook', e.target.value)}
                  placeholder="https://facebook.com/..."
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-ink-500 flex items-center gap-1.5">
                  <Instagram className="h-3.5 w-3.5 text-pink-600" /> Instagram
                </label>
                <input
                  type="url"
                  className="input h-8 text-xs"
                  value={content.footer.social?.instagram || ''}
                  onChange={(e) => updateSocial('instagram', e.target.value)}
                  placeholder="https://instagram.com/..."
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-ink-500 flex items-center gap-1.5">
                  <Twitter className="h-3.5 w-3.5 text-sky-500" /> Twitter / X
                </label>
                <input
                  type="url"
                  className="input h-8 text-xs"
                  value={content.footer.social?.twitter || ''}
                  onChange={(e) => updateSocial('twitter', e.target.value)}
                  placeholder="https://twitter.com/..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2B: Navigation Columns (Explore & Company) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Explore Column */}
          <div className="space-y-3 rounded-xl bg-sand-50/50 p-5 border border-sand-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink-700">
                  Column 2 Heading
                </label>
                <input
                  type="text"
                  className="input mt-1 h-8 text-xs font-semibold"
                  value={content.footer.explore_heading}
                  onChange={(e) => updateFooter('explore_heading', e.target.value)}
                  placeholder="Explore"
                />
              </div>
              <button
                type="button"
                onClick={() => addFooterLink('explore_links')}
                className="btn-outline text-[11px] py-1 px-2.5 inline-flex items-center gap-1 bg-white cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add Link
              </button>
            </div>

            <div className="space-y-2">
              {content.footer.explore_links.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-ink-150">
                  <input
                    type="text"
                    className="input h-7 text-xs flex-1"
                    value={item.label}
                    onChange={(e) => updateFooterLink('explore_links', idx, 'label', e.target.value)}
                    placeholder="Link text"
                  />
                  <input
                    type="text"
                    className="input h-7 text-xs flex-1 font-mono"
                    value={item.href}
                    onChange={(e) => updateFooterLink('explore_links', idx, 'href', e.target.value)}
                    placeholder="/packages"
                  />
                  <button
                    type="button"
                    onClick={() => removeFooterLink('explore_links', idx)}
                    className="p-1 text-coral-600 hover:bg-coral-50 rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Company Column */}
          <div className="space-y-3 rounded-xl bg-sand-50/50 p-5 border border-sand-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink-700">
                  Column 3 Heading
                </label>
                <input
                  type="text"
                  className="input mt-1 h-8 text-xs font-semibold"
                  value={content.footer.company_heading}
                  onChange={(e) => updateFooter('company_heading', e.target.value)}
                  placeholder="Company"
                />
              </div>
              <button
                type="button"
                onClick={() => addFooterLink('company_links')}
                className="btn-outline text-[11px] py-1 px-2.5 inline-flex items-center gap-1 bg-white cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add Link
              </button>
            </div>

            <div className="space-y-2">
              {content.footer.company_links.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-ink-150">
                  <input
                    type="text"
                    className="input h-7 text-xs flex-1"
                    value={item.label}
                    onChange={(e) => updateFooterLink('company_links', idx, 'label', e.target.value)}
                    placeholder="Link text"
                  />
                  <input
                    type="text"
                    className="input h-7 text-xs flex-1 font-mono"
                    value={item.href}
                    onChange={(e) => updateFooterLink('company_links', idx, 'href', e.target.value)}
                    placeholder="/about"
                  />
                  <button
                    type="button"
                    onClick={() => removeFooterLink('company_links', idx)}
                    className="p-1 text-coral-600 hover:bg-coral-50 rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2C: Contact Info & Copyright */}
        <div className="space-y-4 rounded-xl bg-sand-50/50 p-5 border border-sand-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700">
            3. Contact Information & Copyright Note
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Contact Column Title</label>
              <input
                type="text"
                className="input"
                value={content.footer.contact_heading}
                onChange={(e) => updateFooter('contact_heading', e.target.value)}
                placeholder="Get in touch"
              />
            </div>

            <div>
              <label className="label">Phone Number</label>
              <input
                type="text"
                className="input"
                value={content.footer.phone}
                onChange={(e) => updateFooter('phone', e.target.value)}
                placeholder="e.g. +91 98765 43210"
              />
            </div>

            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                value={content.footer.email}
                onChange={(e) => updateFooter('email', e.target.value)}
                placeholder="e.g. info@travinco.com"
              />
            </div>

            <div>
              <label className="label">Physical Address</label>
              <input
                type="text"
                className="input"
                value={content.footer.address}
                onChange={(e) => updateFooter('address', e.target.value)}
                placeholder="e.g. Kochi, Kerala, India"
              />
            </div>
          </div>

          <div>
            <label className="label">Bottom Copyright Notice</label>
            <input
              type="text"
              className="input text-xs"
              value={content.footer.copyright_text}
              onChange={(e) => updateFooter('copyright_text', e.target.value)}
              placeholder="All rights reserved."
            />
            <p className="mt-1 text-[11px] text-ink-400">
              Renders as: © {new Date().getFullYear()} {content.footer.brand_name || 'Travinco'}. {content.footer.copyright_text}
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: EXACT LIVE CUSTOMER PREVIEW ── */}
      <div className="rounded-2xl bg-white p-6 border border-ink-150 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-ink-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-900">Live Customer Side Preview</h3>
              <p className="text-xs text-ink-500">
                Exact preview of how the customer sees both navbar states and footer.
              </p>
            </div>
          </div>
        </div>

        {/* ── State 1: On Application Load (Transparent Hero with White Logo) ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-navy-900"></span>
              1. Initial Application Load &bull; Top of Homepage (Dark Hero Banner):
            </span>
            <span className="text-[11px] text-ink-500">
              Showing White Logo Image (<code className="text-brand-700 font-mono">/images/white_logo.png</code>)
            </span>
          </div>

          <div className="rounded-2xl border border-navy-800 bg-gradient-to-r from-navy-950 via-brand-950 to-navy-900 p-1 overflow-hidden relative shadow-sm">
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-40" />
            <div className="flex h-20 items-center justify-between px-6 rounded-xl bg-transparent text-white relative z-10">
              {/* Brand Logo: ONLY image, no text */}
              <div className="flex items-center">
                <div className="relative h-10 max-w-[200px] flex items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={content.navbar.logo_light_image_url || '/images/white_logo.png'}
                    alt="Travinco"
                    className="max-h-10 w-auto object-contain"
                  />
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="hidden lg:flex items-center gap-6">
                {content.navbar.nav_links
                  .filter((l) => l.visible !== false)
                  .map((link) => {
                    const isDestinations = link.key === 'destinations' || link.href === '/destinations';
                    if (isDestinations) {
                      return (
                        <div
                          key={link.key}
                          className="flex items-center gap-1 text-sm font-medium text-white/90 hover:text-white transition cursor-pointer"
                        >
                          <span>{link.label}</span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </div>
                      );
                    }
                    return (
                      <span
                        key={link.key}
                        className="text-sm font-medium text-white/90 hover:text-white transition cursor-pointer"
                      >
                        {link.label}
                      </span>
                    );
                  })}
              </nav>

              {/* Right Side Header Controls */}
              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-white/90">
                  <User className="h-4 w-4" /> Login
                </span>
                {content.navbar.cta_button_text && (
                  <span className="btn-cta text-xs py-2 px-3.5 cursor-pointer shadow-xs">
                    {content.navbar.cta_button_text}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── State 2: When Scrolled & Internal Pages (Solid White with Green Logo) ── */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-600"></span>
              2. When Scrolling &bull; All Internal Pages & Scrolled State:
            </span>
            <span className="text-[11px] text-ink-500">
              Showing Green Logo Image (<code className="text-brand-700 font-mono">/images/green_logo.png</code>)
            </span>
          </div>

          <div className="rounded-2xl border border-ink-200 bg-sand-100/60 p-1 overflow-hidden relative shadow-sm">
            <div className="flex h-20 items-center justify-between px-6 rounded-xl bg-white/95 border border-ink-100 shadow-sm text-ink-900 backdrop-blur">
              {/* Brand Logo: ONLY image, no text */}
              <div className="flex items-center">
                <div className="relative h-10 max-w-[200px] flex items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={content.navbar.logo_image_url || '/images/green_logo.png'}
                    alt="Travinco"
                    className="max-h-10 w-auto object-contain"
                  />
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="hidden lg:flex items-center gap-6">
                {content.navbar.nav_links
                  .filter((l) => l.visible !== false)
                  .map((link) => {
                    const isDestinations = link.key === 'destinations' || link.href === '/destinations';
                    if (isDestinations) {
                      return (
                        <div
                          key={link.key}
                          className="flex items-center gap-1 text-sm font-medium text-ink-600 hover:text-brand-700 transition cursor-pointer"
                        >
                          <span>{link.label}</span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </div>
                      );
                    }
                    return (
                      <span
                        key={link.key}
                        className="text-sm font-medium text-ink-600 hover:text-brand-700 transition cursor-pointer"
                      >
                        {link.label}
                      </span>
                    );
                  })}
              </nav>

              {/* Right Side Header Controls */}
              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-ink-600">
                  <User className="h-4 w-4" /> Login
                </span>
                {content.navbar.cta_button_text && (
                  <span className="btn-cta text-xs py-2 px-3.5 cursor-pointer shadow-xs">
                    {content.navbar.cta_button_text}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Exact Customer Footer Preview ── */}
        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">
            Footer Preview &bull; Exactly as Rendered on Customer Pages:
          </span>

          <div className="rounded-2xl border-t-2 border-coral-500 bg-navy-900 text-white/70 overflow-hidden shadow-lg">
            <div className="grid gap-8 p-8 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              {/* Col 1 */}
              <div>
                <p className="font-display text-lg font-semibold text-white">
                  {content.footer.brand_name || 'Travinco'}
                </p>
                <p className="mt-3 text-sm text-white/60 leading-relaxed">
                  {content.footer.brand_tagline ||
                    'Handpicked holidays and end-to-end trip planning, built around how you actually like to travel.'}
                </p>
                {content.footer.show_social && (
                  <div className="mt-4 flex gap-3">
                    <span className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white cursor-pointer transition">
                      <Facebook className="h-4 w-4" />
                    </span>
                    <span className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white cursor-pointer transition">
                      <Instagram className="h-4 w-4" />
                    </span>
                    <span className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white cursor-pointer transition">
                      <Twitter className="h-4 w-4" />
                    </span>
                  </div>
                )}
              </div>

              {/* Col 2 */}
              <div>
                <p className="text-sm font-semibold text-white">
                  {content.footer.explore_heading || 'Explore'}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-white/60">
                  {content.footer.explore_links.map((item, idx) => (
                    <li key={item.id || idx} className="hover:text-ocean-300 transition cursor-pointer">
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Col 3 */}
              <div>
                <p className="text-sm font-semibold text-white">
                  {content.footer.company_heading || 'Company'}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-white/60">
                  {content.footer.company_links.map((item, idx) => (
                    <li key={item.id || idx} className="hover:text-ocean-300 transition cursor-pointer">
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Col 4 */}
              <div>
                <p className="text-sm font-semibold text-white">
                  {content.footer.contact_heading || 'Get in touch'}
                </p>
                <ul className="mt-3 space-y-2.5 text-sm text-white/60">
                  {content.footer.phone ? (
                    <li className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 text-coral-400" />
                      <span>{content.footer.phone}</span>
                    </li>
                  ) : null}
                  {content.footer.email ? (
                    <li className="flex items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0 text-coral-400" />
                      <span>{content.footer.email}</span>
                    </li>
                  ) : null}
                  {content.footer.address ? (
                    <li className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-coral-400" />
                      <span>{content.footer.address}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>

            {/* Bottom Copyright Row */}
            <div className="border-t border-white/10 bg-navy-900/60 py-4 text-center text-xs text-white/50">
              © {new Date().getFullYear()} {content.footer.brand_name || 'Travinco'}. {content.footer.copyright_text}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Save Action Bar ── */}
      {isAdmin && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isPending}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 shadow-md cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Changes…</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save All Changes</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
