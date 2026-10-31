'use client';

import { useState, useTransition, useRef } from 'react';
import { reportThemeErrors } from '@/lib/theme-form-errors';
import { validatePageTitlesContent } from '@/lib/validations/theme';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Save,
  RotateCcw,
  Upload,
  Globe,
  ExternalLink,
  Check,
  X,
  FileCode,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import {
  type PageTitlesContent,
  PAGE_DEFINITIONS,
  DEFAULT_PAGE_TITLES_CONTENT,
} from '@/lib/page-titles-content-types';
import { savePageTitlesContentAction, uploadFaviconAction } from './actions';

interface PageTitlesEditorProps {
  initialContent?: PageTitlesContent;
  isAdmin?: boolean;
}

export function PageTitlesEditor({
  initialContent = DEFAULT_PAGE_TITLES_CONTENT,
  isAdmin = true,
}: PageTitlesEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<PageTitlesContent>(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update a single page title
  const handleTitleChange = (key: string, value: string) => {
    setContent((prev) => ({
      ...prev,
      titles: {
        ...prev.titles,
        [key]: value,
      },
    }));
  };

  // Reset a single page title to factory default
  const handleResetSingle = (key: string, defaultTitle: string) => {
    setContent((prev) => ({
      ...prev,
      titles: {
        ...prev.titles,
        [key]: defaultTitle,
      },
    }));
    toast.info(`Reset to default title`);
  };

  // Reset all titles & favicon to factory defaults
  const handleResetAll = () => {
    if (confirm('Are you sure you want to reset all page titles and favicon to factory defaults?')) {
      setContent(DEFAULT_PAGE_TITLES_CONTENT);
      toast.info('All page titles and favicon reset to factory defaults.');
    }
  };

  // Handle favicon file upload
  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFavicon(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await uploadFaviconAction(formData);

      if (res.success && res.url) {
        setContent((prev) => ({
          ...prev,
          favicon_url: res.url!,
        }));
        toast.success('Favicon uploaded successfully!');
      } else {
        toast.error(res.error || 'Failed to upload favicon.');
      }
    } catch {
      toast.error('An error occurred during favicon upload.');
    } finally {
      setIsUploadingFavicon(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save all changes to database & json
  const handleSave = async () => {
    if (reportThemeErrors(validatePageTitlesContent(content))) return;
    setIsSaving(true);
    try {
      const res = await savePageTitlesContentAction(content);
      if (res.success) {
        toast.success('Page titles and favicon updated successfully!');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to save changes.');
      }
    } catch {
      toast.error('An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* ── Top Bar with Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-white p-5 border border-ink-150 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-ink-950 sm:text-xl">
              Customer Page Titles & Favicon
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <Globe className="h-3.5 w-3.5 text-emerald-600" />
              Browser & SEO
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-ink-500">
            Set the browser tab title for every customer page and customize the site favicon icon. Changes immediately update across all customer screens.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleResetAll}
            disabled={isSaving || !isAdmin}
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isAdmin}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 text-xs sm:text-sm font-semibold shadow-xs hover:shadow-emerald-600/25 transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* ── 1. FAVICON CONFIGURATION CARD ── */}
      <div className="rounded-2xl border border-ink-150 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-ink-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-emerald-600" />
              Site Favicon (Browser Tab Icon)
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              This icon appears next to the page title in the browser tabs, bookmarks, and shortcuts.
            </p>
          </div>
          {content.favicon_url && (
            <button
              type="button"
              onClick={() => setContent((prev) => ({ ...prev, favicon_url: DEFAULT_PAGE_TITLES_CONTENT.favicon_url }))}
              className="text-xs text-ink-500 hover:text-ink-800 underline self-start sm:self-auto cursor-pointer"
            >
              Reset to Default Favicon
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Favicon Previews */}
          <div className="md:col-span-5 flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-sand-50/60 border border-sand-200/80">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Preview (32px)</span>
              <div className="h-14 w-14 rounded-xl bg-white border border-ink-200/80 shadow-xs flex items-center justify-center p-2 relative overflow-hidden">
                {content.favicon_url ? (
                  <Image
                    src={content.favicon_url}
                    alt="Favicon preview"
                    width={32}
                    height={32}
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-ink-300" />
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Tab Icon (16px)</span>
              <div className="h-10 w-10 rounded-lg bg-white border border-ink-200/80 shadow-2xs flex items-center justify-center p-1 relative overflow-hidden">
                {content.favicon_url ? (
                  <Image
                    src={content.favicon_url}
                    alt="Favicon 16px"
                    width={16}
                    height={16}
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <ImageIcon className="h-4 w-4 text-ink-300" />
                )}
              </div>
            </div>

            {/* Simulated mini tab */}
            <div className="flex-1 w-full sm:w-auto">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider block mb-1.5">
                Simulated Tab
              </span>
              <div className="inline-flex items-center gap-2 bg-ink-100/80 border border-ink-200 px-3 py-1.5 rounded-t-lg text-xs text-ink-800 max-w-[220px]">
                {content.favicon_url && (
                  <Image
                    src={content.favicon_url}
                    alt="Favicon"
                    width={14}
                    height={14}
                    className="shrink-0 object-contain"
                    unoptimized
                  />
                )}
                <span className="truncate text-[11px] font-medium">
                  {content.titles.home || 'Travinco'}
                </span>
                <X className="h-3 w-3 text-ink-400 shrink-0" />
              </div>
            </div>
          </div>

          {/* Favicon Controls */}
          <div className="md:col-span-7 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                Favicon Image URL
              </label>
              <div className="flex gap-2">
                <input data-field="favicon_url"
                  type="text"
                  value={content.favicon_url || ''}
                  onChange={(e) => setContent((prev) => ({ ...prev, favicon_url: e.target.value }))}
                  placeholder="/images/green_logo.png or https://..."
                  className="flex-1 rounded-xl border border-ink-200 px-3.5 py-2 text-xs sm:text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFaviconUpload}
                  accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/jpeg,image/webp"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFavicon || !isAdmin}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-sand-50 hover:bg-sand-100 px-3.5 py-2 text-xs font-semibold text-ink-800 transition disabled:opacity-50 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-brand-600" />
                  <span>{isUploadingFavicon ? 'Uploading...' : 'Upload Icon'}</span>
                </button>
              </div>
              <p className="mt-1 text-[11px] text-ink-400">
                Supports PNG, ICO, SVG, WEBP, or JPG. Square dimensions (32×32, 64×64, or 128×128) look sharpest.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. PAGE TITLES TABLE & EDITORS ── */}
      <div className="rounded-2xl border border-ink-150 bg-white p-6 shadow-xs space-y-6">
        <div className="border-b border-ink-100 pb-4">
          <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
            <Globe className="h-4 w-4 text-emerald-600" />
            Customer Pages Titles
          </h3>
          <p className="mt-1 text-xs text-ink-500">
            Edit the exact title that appears in browser tabs when customers visit each page on your website.
          </p>
        </div>

        <div className="space-y-5">
          {PAGE_DEFINITIONS.map((page) => {
            const currentTitle = content.titles[page.key] ?? page.defaultTitle;
            const isModified = currentTitle !== page.defaultTitle;

            return (
              <div
                key={page.key}
                className="rounded-2xl border border-ink-150 p-4 sm:p-5 bg-white hover:border-brand-300 transition-all shadow-2xs space-y-3"
              >
                {/* Header Row: Page Name + Path Badge + Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm text-ink-900">{page.name}</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-md bg-ink-50 text-ink-600 border border-ink-200">
                      {page.path}
                    </span>
                    {isModified && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Customized
                      </span>
                    )}
                  </div>

                  {isModified && (
                    <button
                      type="button"
                      onClick={() => handleResetSingle(page.key, page.defaultTitle)}
                      className="text-xs text-ink-500 hover:text-ink-800 underline self-start sm:self-auto cursor-pointer"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>

                {/* Input Field */}
                <div>
                  <div className="relative">
                    <input data-field={`titles.${page.key}`}
                      type="text"
                      value={currentTitle}
                      onChange={(e) => handleTitleChange(page.key, e.target.value)}
                      placeholder={page.defaultTitle}
                      className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-xs sm:text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-400 font-mono">
                      {currentTitle.length} chars
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-400">
                    Default fallback: <span className="text-ink-600 font-medium">{page.defaultTitle}</span>
                  </p>
                </div>

                {/* Live Simulated Browser Tab */}
                <div className="pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
                      Browser Tab Preview:
                    </span>
                    <div className="inline-flex items-center gap-2 rounded-t-lg bg-sand-100 border border-sand-300/80 px-3 py-1 shadow-2xs max-w-full sm:max-w-md">
                      {content.favicon_url && (
                        <Image
                          src={content.favicon_url}
                          alt="Favicon"
                          width={14}
                          height={14}
                          className="shrink-0 object-contain"
                          unoptimized
                        />
                      )}
                      <span className="truncate text-xs font-medium text-ink-800">
                        {currentTitle || page.defaultTitle}
                      </span>
                      <X className="h-3 w-3 text-ink-400 shrink-0 ml-auto" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
