'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Upload,
  Plus,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Copy,
  Check,
  ArrowLeft,
  X,
  Search,
  SlidersHorizontal,
  Sparkles,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Compass,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw,
  Package,
  MapPin,
  BookOpen,
  Layout,
  Headphones,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  uploadThemeImageAction,
  updateThemeImageAction,
  toggleThemeImageStatusAction,
  deleteThemeImageAction,
  type ThemeImageItem,
} from './actions';

import type { HomePageContent } from '@/lib/home-page-content-types';
import { DEFAULT_HOME_PAGE_CONTENT } from '@/lib/home-page-content-types';
import { HomePageEditor } from './home-page-editor';
import { PackagesPageEditor } from './packages-page-editor';
import type { PackagesPageContent } from '@/lib/packages-page-content-types';
import { DEFAULT_PACKAGES_PAGE_CONTENT } from '@/lib/packages-page-content-types';
import { DestinationsPageEditor } from './destinations-page-editor';
import type { DestinationsPageContent } from '@/lib/destinations-page-content-types';
import { DEFAULT_DESTINATIONS_PAGE_CONTENT } from '@/lib/destinations-page-content-types';
import { BlogPageEditor } from './blog-page-editor';
import type { BlogPageContent } from '@/lib/blog-page-content-types';
import { DEFAULT_BLOG_PAGE_CONTENT } from '@/lib/blog-page-content-types';
import { AboutPageEditor } from './about-page-editor';
import type { AboutPageContent } from '@/lib/about-page-content-types';
import { DEFAULT_ABOUT_PAGE_CONTENT } from '@/lib/about-page-content-types';
import { NavbarFooterEditor } from './navbar-footer-editor';
import type { NavbarFooterContent } from '@/lib/navbar-footer-content-types';
import { DEFAULT_NAVBAR_FOOTER_CONTENT } from '@/lib/navbar-footer-content-types';
import { PageTitlesEditor } from './page-titles-editor';
import type { PageTitlesContent } from '@/lib/page-titles-content-types';
import { DEFAULT_PAGE_TITLES_CONTENT } from '@/lib/page-titles-content-types';
import { ContactPageEditor } from './contact-page-editor';
import type { ContactPageContent } from '@/lib/contact-page-content-types';
import { DEFAULT_CONTACT_PAGE_CONTENT } from '@/lib/contact-page-content-types';
import { Globe } from 'lucide-react';

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

interface ThemeClientProps {
  initialImages: ThemeImageItem[];
  initialHomeContent?: HomePageContent;
  initialPackagesContent?: PackagesPageContent;
  initialDestinationsContent?: DestinationsPageContent;
  initialBlogContent?: BlogPageContent;
  initialAboutContent?: AboutPageContent;
  initialContactContent?: ContactPageContent;
  initialNavbarFooterContent?: NavbarFooterContent;
  initialPageTitlesContent?: PageTitlesContent;
  destinations?: DestinationItem[];
  recentPosts?: BlogPostItem[];
  isAdmin?: boolean;
}

type TabKey = 'home' | 'packages' | 'destinations' | 'blog' | 'about' | 'contact' | 'navbar-footer' | 'titles';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: any;
  description: string;
  placements: { value: string; label: string; hint: string }[];
}

const TABS: TabConfig[] = [
  {
    key: 'home',
    label: 'Home',
    icon: Compass,
    description: 'Manage live sections, text, and images for the Home Page.',
    placements: [
      {
        value: 'hero',
        label: 'Hero Slider Slide',
        hint: 'Displays one-by-one in the top hero slider with automatic transitions behind "Discover Asia with us"',
      },
      {
        value: 'captured_road',
        label: 'Captured On The Road',
        hint: 'Displays in the "Captured On The Road" moments carousel section on the customer home page',
      },
      {
        value: 'ayurveda',
        label: 'Ayurveda & Wellness Section',
        hint: 'Full-width background image for the Kerala Ayurveda & Wellness Packages parallax section',
      },
    ],
  },
  {
    key: 'packages',
    label: 'Packages',
    icon: Package,
    description: 'Customize the Customer Packages page hero visuals, background photo, centered typography, search placeholder, and custom holiday CTA banner.',
    placements: [
      {
        value: 'hero',
        label: 'Hero Background Image',
        hint: 'Full-width background image behind the centered PACKAGES heading with dark luxury atmospheric overlay',
      },
    ],
  },
  {
    key: 'destinations',
    label: 'Destinations',
    icon: MapPin,
    description: 'Customize the Customer Destinations page hero visuals, background photo, centered typography, search placeholder, and custom holiday CTA banner.',
    placements: [
      {
        value: 'hero',
        label: 'Hero Background Image',
        hint: 'Full-width background image behind the centered DESTINATIONS heading with dark luxury atmospheric overlay',
      },
    ],
  },
  {
    key: 'blog',
    label: 'Blog',
    icon: BookOpen,
    description: 'Customize the Customer Blog & Stories page hero visuals, background photo, centered typography, search placeholder, and bottom reading CTA banner.',
    placements: [
      {
        value: 'hero',
        label: 'Hero Background Image',
        hint: 'Full-width background image behind the centered BLOG & STORIES heading with dark luxury atmospheric overlay',
      },
    ],
  },
  {
    key: 'about',
    label: 'About Us',
    icon: Layers,
    description: 'Customize the Customer About Us page hero visuals, background photo, centered typography, story narrative, milestone stats, and core value commitments.',
    placements: [
      { value: 'hero', label: 'About Hero Banner', hint: 'Top banner image on the /about page' },
      { value: 'story', label: 'Our Story & Heritage', hint: 'Featured picture alongside company founding narrative' },
    ],
  },
  {
    key: 'contact',
    label: 'Contact',
    icon: Headphones,
    description: 'Customize the Contact page Hero background image, atmospheric text, trust pillars, and section headings.',
    placements: [
      {
        value: 'hero',
        label: 'Hero Background Image',
        hint: 'Full-width background image behind the centered CONTACT US heading with dark luxury atmospheric overlay',
      },
    ],
  },
  {
    key: 'navbar-footer',
    label: 'Navbar & Footer',
    icon: Layout,
    description: 'Customize customer-facing Navbar logos (scrolled & transparent hero), page navigation links, CTA buttons, and Footer sections, socials, and contact info.',
    placements: [],
  },
  {
    key: 'titles',
    label: 'Title change',
    icon: Globe,
    description: 'Change the browser tab title for every customer-facing page and customize the site favicon image.',
    placements: [],
  },
];

export function ThemeClient({
  initialImages,
  initialHomeContent = DEFAULT_HOME_PAGE_CONTENT,
  initialPackagesContent = DEFAULT_PACKAGES_PAGE_CONTENT,
  initialDestinationsContent = DEFAULT_DESTINATIONS_PAGE_CONTENT,
  initialBlogContent = DEFAULT_BLOG_PAGE_CONTENT,
  initialAboutContent = DEFAULT_ABOUT_PAGE_CONTENT,
  initialContactContent = DEFAULT_CONTACT_PAGE_CONTENT,
  initialNavbarFooterContent = DEFAULT_NAVBAR_FOOTER_CONTENT,
  initialPageTitlesContent = DEFAULT_PAGE_TITLES_CONTENT,
  destinations = [],
  recentPosts = [],
  isAdmin = true,
}: ThemeClientProps) {
  const router = useRouter();
  const [images, setImages] = useState<ThemeImageItem[]>(initialImages);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [homeViewMode, setHomeViewMode] = useState<'editor' | 'library'>('editor');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Search & placement filter
  const [searchQuery, setSearchQuery] = useState('');
  const [placementFilter, setPlacementFilter] = useState('');

  // Upload Form state (clean: only image and placement section)
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadPlacement, setUploadPlacement] = useState<string>('hero');
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadedImage, setLastUploadedImage] = useState<ThemeImageItem | null>(null);

  // Edit Modal state (only placement section)
  const [itemToEdit, setItemToEdit] = useState<ThemeImageItem | null>(null);
  const [editForm, setEditForm] = useState({
    placement: 'hero',
    sort_order: 0,
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Sync default placement whenever tab changes
  useEffect(() => {
    const tab = TABS.find((t) => t.key === activeTab);
    if (tab && tab.placements.length > 0) {
      setUploadPlacement(tab.placements[0]!.value);
      setPlacementFilter('');
    }
  }, [activeTab]);

  // Delete Confirmation Modal state
  const [itemToDelete, setItemToDelete] = useState<ThemeImageItem | null>(null);

  // Copied URL notification
  const [copiedId, setCopiedId] = useState<string | null>(null);


  const currentTabConfig = useMemo(() => {
    return TABS.find((t) => t.key === activeTab) || TABS[0]!;
  }, [activeTab]);

  // Filtered images for current tab
  const tabImages = useMemo(() => {
    return images.filter((img) => {
      if (img.page !== activeTab) return false;
      if (placementFilter && img.placement !== placementFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = img.title?.toLowerCase().includes(q);
        const matchesSubtitle = img.subtitle?.toLowerCase().includes(q);
        const matchesPlacement = img.placement?.toLowerCase().includes(q);
        const matchesBadge = img.badge?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSubtitle && !matchesPlacement && !matchesBadge) {
          return false;
        }
      }
      return true;
    });
  }, [images, activeTab, placementFilter, searchQuery]);

  // Handle File Selection with instant preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setUploadFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadPreview(url);
    } else {
      setUploadPreview(null);
    }
  };

  // Submit New Theme Image Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select an image file first.');
      return;
    }

    setIsUploading(true);
    const fd = new FormData();
    fd.append('image', uploadFile);
    fd.append('page', activeTab);
    fd.append('placement', uploadPlacement);

    try {
      const res = await uploadThemeImageAction(fd);
      if (res.success && res.data) {
        toast.success('Image uploaded and added to theme successfully!');
        setImages((prev) => [res.data!, ...prev]);
        setLastUploadedImage(res.data);
        router.refresh();
        // Reset form
        setUploadFile(null);
        setUploadPreview(null);
        setIsUploadOpen(false);
      } else {
        toast.error(res.error || 'Upload failed. Please try again.');
      }
    } catch {
      toast.error('An unexpected error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (item: ThemeImageItem) => {
    const newStatus = !item.is_active;
    // Optimistic update
    setImages((prev) =>
      prev.map((img) => (img.id === item.id ? { ...img, is_active: newStatus } : img))
    );

    const res = await toggleThemeImageStatusAction(item.id, newStatus);
    if (res.success) {
      toast.success(newStatus ? 'Image activated for customer side' : 'Image hidden from customer side');
      router.refresh();
    } else {
      // Revert
      setImages((prev) =>
        prev.map((img) => (img.id === item.id ? { ...img, is_active: !newStatus } : img))
      );
      toast.error(res.error || 'Failed to update status.');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item: ThemeImageItem) => {
    setItemToEdit(item);
    setEditForm({
      placement: item.placement || 'hero',
      sort_order: item.sort_order ?? 0,
    });
  };

  // Save Edit Changes
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit) return;
    setIsSavingEdit(true);

    try {
      const res = await updateThemeImageAction(itemToEdit.id, {
        placement: editForm.placement.trim() || 'hero',
        sort_order: Number(editForm.sort_order) || 0,
      });

      if (res.success) {
        toast.success('Theme image updated successfully');
        router.refresh();
        setImages((prev) =>
          prev.map((img) =>
            img.id === itemToEdit.id
              ? {
                  ...img,
                  placement: editForm.placement.trim() || 'hero',
                  sort_order: Number(editForm.sort_order) || 0,
                }
              : img
          )
        );
        setItemToEdit(null);
      } else {
        toast.error(res.error || 'Failed to update image.');
      }
    } catch {
      toast.error('An error occurred while saving.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Confirm Delete Action
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id;
    setItemToDelete(null);

    // Optimistic removal
    setImages((prev) => prev.filter((img) => img.id !== targetId));

    const res = await deleteThemeImageAction(targetId);
    if (res.success) {
      toast.success('Theme image deleted.');
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to delete image.');
      // Refresh state
      window.location.reload();
    }
  };

  // Copy Image Public URL
  const handleCopyUrl = (item: ThemeImageItem) => {
    navigator.clipboard.writeText(item.image_url);
    setCopiedId(item.id);
    toast.success('Image URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-5">
        <div>
          <Link
            href="/travinco_dashboard"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-700 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              Theme & Customer Page Visuals
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-800">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              Customer Front-End
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Upload and configure images displayed on customer pages (Home Page hero slider, About Us, Gallery, and Common banners).
          </p>
        </div>
      </div>


      {/* ── Tabs Navigation: Strictly Single-Row Horizontal ── */}
      <div className="border-b border-ink-200 overflow-x-auto no-scrollbar">
        <nav className="flex items-center gap-1.5 sm:gap-2 -mb-px flex-nowrap min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = images.filter((img) => img.page === tab.key).length;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setPlacementFilter('');
                  setSearchQuery('');
                  setUploadPlacement(tab.placements[0]?.value || 'hero');
                }}
                className={`inline-flex items-center gap-1.5 sm:gap-2 border-b-2 py-2.5 px-2.5 sm:px-3 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'border-brand-600 text-brand-700 font-bold bg-brand-50/40 rounded-t-lg'
                    : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800 hover:bg-ink-50/60 rounded-t-lg'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isActive ? 'text-brand-600' : 'text-ink-400'}`} />
                <span>{tab.label}</span>
                {tab.key === 'navbar-footer' ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      isActive ? 'bg-brand-100 text-brand-800' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    }`}
                  >
                    Live
                  </span>
                ) : (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      isActive ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab Description & Info Bar ── */}
      {activeTab !== 'navbar-footer' && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-ink-50/70 p-4 border border-ink-200/70">
          <div>
            <p className="text-xs font-medium text-ink-700">{currentTabConfig.description}</p>
            <p className="mt-0.5 text-[11px] text-ink-400">
              Active images under this tab appear on the customer-facing {currentTabConfig.label} section.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-600 shrink-0">
            <span>Supported Formats:</span>
            <span className="rounded bg-white border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-700">JPG</span>
            <span className="rounded bg-white border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-700">PNG</span>
            <span className="rounded bg-white border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-700">WEBP</span>
            <span className="text-ink-400 text-[10px]">(&lt; 8MB)</span>
          </div>
        </div>
      )}

      {/* ── Home Page Sub-Navigation Switcher (Live Page Content Editor vs Media Asset Grid) ── */}
      {activeTab === 'home' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-brand-50/60 via-white to-brand-50/30 p-3 sm:p-4 border border-brand-200/80 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink-700 uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-brand-600" />
              Home Page Manager:
            </span>
          </div>

          <div className="flex items-center gap-2 bg-white/90 p-1 rounded-xl border border-ink-200 shadow-xs">
            <button
              type="button"
              onClick={() => setHomeViewMode('editor')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                homeViewMode === 'editor'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Live Page Content Editor & Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setHomeViewMode('library')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                homeViewMode === 'library'
                  ? 'bg-ink-900 text-white shadow-xs'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Media Assets & Raw Files ({images.filter((img) => img.page === 'home').length})</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Home Tab: Live Page Content Editor & Preview Mode ── */}
      {activeTab === 'home' && homeViewMode === 'editor' && (
        <HomePageEditor
          initialContent={initialHomeContent}
          themeImages={images}
          destinations={destinations}
          recentPosts={recentPosts}
          isAdmin={isAdmin}
          lastUploadedImage={lastUploadedImage}
          onOpenUpload={(placement) => {
            setUploadPlacement(placement);
            setIsUploadOpen(true);
          }}
          onDeleteImage={(item) => {
            setImages((prev) => prev.filter((img) => img.id !== item.id));
          }}
        />
      )}

      {/* ── Package Page Tab: Dedicated Visuals & Content Editor ── */}
      {activeTab === 'packages' && (
        <PackagesPageEditor
          initialContent={initialPackagesContent}
          isAdmin={isAdmin}
        />
      )}

      {/* ── Destination Page Tab: Dedicated Visuals & Content Editor ── */}
      {activeTab === 'destinations' && (
        <DestinationsPageEditor
          initialContent={initialDestinationsContent}
          isAdmin={isAdmin}
        />
      )}

      {/* ── Blog Page Tab: Dedicated Visuals & Content Editor ── */}
      {activeTab === 'blog' && (
        <BlogPageEditor
          initialContent={initialBlogContent}
          isAdmin={isAdmin}
        />
      )}

      {/* ── About Page Tab: Dedicated Visuals & Content Editor ── */}
      {activeTab === 'about' && (
        <AboutPageEditor
          initialContent={initialAboutContent}
          isAdmin={isAdmin}
        />
      )}

      {/* ── Navbar & Footbar Tab: Dedicated Header & Footer Content Editor ── */}
      {activeTab === 'navbar-footer' && (
        <NavbarFooterEditor
          initialContent={initialNavbarFooterContent}
          isAdmin={isAdmin}
        />
      )}

      {/* ── Contact Tab: Dedicated Visuals & Content Editor ── */}
      {activeTab === 'contact' && (
        <ContactPageEditor
          initialContent={initialContactContent}
          isAdmin={isAdmin}
        />
      )}

      {/* ── Title change Tab: Dedicated Page Titles & Favicon Editor ── */}
      {activeTab === 'titles' && (
        <PageTitlesEditor
          initialContent={initialPageTitlesContent}
          isAdmin={isAdmin}
        />
      )}

      {/* ── Home Sections Chips (only in Media Assets Library mode) ── */}
      {activeTab === 'home' && homeViewMode === 'library' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 border border-ink-200/80 shadow-xs">
          <span className="text-xs font-semibold text-ink-500 mr-1 flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-ink-400" />
            Home Sections:
          </span>
          <button
            type="button"
            onClick={() => {
              setPlacementFilter('');
              setUploadPlacement('hero');
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              placementFilter === ''
                ? 'bg-ink-900 text-white shadow-xs'
                : 'bg-ink-50 text-ink-700 hover:bg-ink-100'
            }`}
          >
            All Home Images ({images.filter((img) => img.page === 'home').length})
          </button>
          <button
            type="button"
            onClick={() => {
              setPlacementFilter('hero');
              setUploadPlacement('hero');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              placementFilter === 'hero'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-brand-50 text-brand-800 hover:bg-brand-100 border border-brand-200/60'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Hero Slider Images ({images.filter((img) => img.page === 'home' && img.placement === 'hero').length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPlacementFilter('captured_road');
              setUploadPlacement('captured_road');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              placementFilter === 'captured_road'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Captured On The Road ({images.filter((img) => img.page === 'home' && img.placement === 'captured_road').length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPlacementFilter('ayurveda');
              setUploadPlacement('ayurveda');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              placementFilter === 'ayurveda'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/60'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ayurveda & Wellness ({images.filter((img) => img.page === 'home' && (img.placement === 'ayurveda' || img.placement === 'wellness')).length})</span>
          </button>
        </div>
      )}

      {/* ── Centered Upload Modal Dialog (No Scrolling Upward) ── */}
      {isUploadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-xs select-none animate-in fade-in duration-150"
          onClick={() => setIsUploadOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card p-6 sm:p-7 border-brand-200 bg-white shadow-2xl space-y-5 rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-900">
                    Upload Image &bull; {currentTabConfig.label}
                  </h3>
                  <p className="text-xs text-ink-500">
                    Select an image file to immediately add to this section on the customer website.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-600 hover:bg-ink-200 hover:text-ink-900 transition cursor-pointer"
                aria-label="Close upload modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Column: File Dropzone & Preview */}
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                    Select Image File <span className="text-coral-600">*</span>
                  </label>
                  <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-300 bg-ink-50/40 p-6 hover:border-brand-500 transition-colors cursor-pointer text-center min-h-[190px]">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      required
                      className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                      disabled={isUploading}
                    />

                    {uploadPreview ? (
                      <div className="space-y-2 text-center">
                        <div className="relative mx-auto h-28 w-44 overflow-hidden rounded-xl border border-ink-200 shadow-sm">
                          <Image
                            src={uploadPreview}
                            alt="Upload preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <p className="text-xs text-ink-600 font-medium truncate max-w-[220px]">
                          {uploadFile?.name}
                        </p>
                        <span className="text-[10px] text-brand-600 underline">Click to change</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-500 shadow-xs border border-ink-200">
                          <ImageIcon className="h-5 w-5 text-brand-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-ink-800">
                            Click to select or drag & drop image
                          </p>
                          <p className="text-[11px] text-ink-400">JPG, PNG, or WEBP up to 8MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Section Placement */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                      Target Section Placement <span className="text-coral-600">*</span>
                    </label>
                    <div className="space-y-2">
                      {currentTabConfig.placements.map((p) => (
                        <label
                          key={p.value}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                            uploadPlacement === p.value
                              ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/20'
                              : 'border-ink-200 bg-white hover:border-ink-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="uploadPlacement"
                            value={p.value}
                            checked={uploadPlacement === p.value}
                            onChange={(e) => setUploadPlacement(e.target.value)}
                            className="mt-0.5 text-brand-600 focus:ring-brand-500"
                          />
                          <div className="text-xs">
                            <p className="font-semibold text-ink-900">{p.label}</p>
                            <p className="text-ink-500 text-[11px] mt-0.5">{p.hint}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-sand-50 p-3 text-[11px] text-ink-600 border border-sand-200">
                    <span className="font-semibold text-ink-900">Live website sync:</span> Uploaded visual will instantly appear on the customer side under the selected section.
                  </div>
                </div>
              </div>

              {/* Submit Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                  className="btn-ghost text-xs px-4 py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="btn-primary inline-flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-xl shadow-xs cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Uploading to Theme…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload & Add Image</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Media Assets Library View (Filters, Search & Image Cards) ── */}
      {activeTab === 'home' && homeViewMode === 'library' && (
        <>
          {/* ── Filters & Search Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder={`Search ${currentTabConfig.label} images by placement or keyword...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 h-9 text-xs rounded-xl"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Placement Filter */}
        <div className="flex items-center gap-2">
          <select
            value={placementFilter}
            onChange={(e) => setPlacementFilter(e.target.value)}
            className="input h-9 text-xs rounded-lg py-1 text-ink-700 max-w-[200px]"
          >
            <option value="">All Placements</option>
            {currentTabConfig.placements.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {(searchQuery || placementFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPlacementFilter('');
              }}
              className="btn-outline text-xs px-2.5 py-1.5 rounded-lg text-ink-600"
            >
              Reset
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setUploadPlacement(placementFilter || currentTabConfig.placements[0]?.value || 'hero');
                setIsUploadOpen(true);
              }}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Upload {currentTabConfig.label} Photo</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Images Grid ── */}
      {tabImages.length === 0 ? (
        <div className="card p-12 text-center rounded-2xl border-dashed border-2 border-ink-200 space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
            <ImageIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">
              {activeTab === 'home' && placementFilter === 'hero'
                ? 'No Hero Slider images uploaded yet'
                : activeTab === 'home' && placementFilter === 'captured_road'
                ? 'No Captured On The Road images uploaded yet'
                : `No images uploaded in ${currentTabConfig.label} yet`}
            </h3>
            <p className="mt-1 text-xs text-ink-500 max-w-sm mx-auto">
              {activeTab === 'home' && placementFilter === 'hero'
                ? 'Upload images here to automatically transition in the home page hero behind "Discover Asia with us".'
                : activeTab === 'home' && placementFilter === 'captured_road'
                ? 'Upload photos here to display in the "Captured On The Road" customer moments carousel.'
                : 'Upload hero banners, promotional visuals, or background graphics to customize the customer experience.'}
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="btn-primary inline-flex items-center gap-2 rounded-xl text-xs px-4 py-2 mt-2 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Upload Image Now</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tabImages.map((item) => (
            <div
              key={item.id}
              className={`card overflow-hidden rounded-2xl border transition-all duration-200 group flex flex-col justify-between ${
                item.is_active
                  ? 'border-ink-200/80 bg-white shadow-xs hover:shadow-md'
                  : 'border-ink-200/50 bg-ink-50/50 opacity-70'
              }`}
            >
              {/* Image Preview Container */}
              <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
                <Image
                  src={item.image_url}
                  alt={item.title || 'Theme visual'}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                />

                {/* Placement Tag Badge */}
                <span
                  className={`absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs backdrop-blur-xs ${
                    item.placement === 'hero'
                      ? 'bg-brand-950/85'
                      : item.placement === 'captured_road'
                      ? 'bg-emerald-950/85'
                      : 'bg-navy-950/80'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      item.placement === 'hero'
                        ? 'bg-sand-400'
                        : item.placement === 'captured_road'
                        ? 'bg-emerald-400'
                        : 'bg-brand-400'
                    }`}
                  />
                  <span>
                    {item.placement === 'hero'
                      ? 'Hero Slider'
                      : item.placement === 'captured_road'
                      ? 'Captured On The Road'
                      : item.placement.replace('_', ' ')}
                  </span>
                </span>

                {/* Active / Inactive Pill */}
                <div className="absolute top-3 right-3">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    title={item.is_active ? 'Click to deactivate' : 'Click to activate'}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-xs cursor-pointer transition ${
                      item.is_active
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-ink-700 text-ink-100 hover:bg-ink-800'
                    }`}
                  >
                    {item.is_active ? (
                      <>
                        <Eye className="h-3 w-3" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Optional Badge Overlay */}
                {item.badge && (
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-sand-400/90 text-navy-950 px-2 py-0.5 text-[10px] font-bold shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-ink-900">
                      {item.placement === 'hero'
                        ? 'Hero Slider Slide'
                        : item.placement === 'captured_road'
                        ? 'Captured On The Road'
                        : item.placement.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-ink-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {item.title && (
                    <p className="mt-1 text-xs text-ink-500 line-clamp-1">
                      {item.title}
                    </p>
                  )}
                </div>

                {/* Card Actions Bar */}
                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
                  {/* Copy URL */}
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(item)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-500 hover:text-ink-800 transition"
                    title="Copy Image URL"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>

                  {/* Edit & Delete Controls */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900 transition"
                        title="Change section placement"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="Delete image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* ── Edit Modal (Change Placement) ── */}
      {itemToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="card w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-ink-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-brand-600" />
                <h3 className="text-base font-bold text-ink-900">Change Section Placement</h3>
              </div>
              <button
                type="button"
                onClick={() => setItemToEdit(null)}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Preview Thumbnail */}
              <div className="relative h-40 w-full overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
                <Image
                  src={itemToEdit.image_url}
                  alt={itemToEdit.placement || 'Edit preview'}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Placement selector */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                  Target Section Placement
                </label>
                <select
                  value={editForm.placement}
                  onChange={(e) => setEditForm((p) => ({ ...p, placement: e.target.value }))}
                  className="input text-xs h-10 rounded-lg"
                >
                  {currentTabConfig.placements.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} — ({p.hint})
                    </option>
                  ))}
                </select>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setItemToEdit(null)}
                  disabled={isSavingEdit}
                  className="btn-ghost text-xs px-4 py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn-primary inline-flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-xl shadow-xs"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="card w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-ink-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-ink-950">Delete Theme Image?</h3>
                <p className="text-xs text-ink-600 leading-relaxed">
                  Are you sure you want to delete{' '}
                  <strong className="text-ink-900 font-semibold">
                    {itemToDelete.title || 'this visual asset'}
                  </strong>
                  ? It will be removed from customer-facing pages.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="btn-ghost text-xs px-3.5 py-2 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition shadow-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
