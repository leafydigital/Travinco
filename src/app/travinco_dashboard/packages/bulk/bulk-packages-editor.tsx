'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Calendar,
  IndianRupee,
  MapPin,
  Tag,
  Clock,
  Sparkles,
  Info,
  ChevronRight,
  HelpCircle,
  Video,
  Image as ImageIcon,
  Check,
  Search,
  UploadCloud,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { bulkCreatePackages, type BulkPackageInput } from '../actions';
import { uploadPackageImage } from '../upload-actions';
import { packageCategories, slugify } from '@/lib/validations/package';

export type DestinationOption = { id: string; name: string };

export type BulkPackageDraft = {
  id: string;
  // Basic info
  title: string;
  slug: string;
  destination_id: string;
  category: (typeof packageCategories)[number];
  duration_days: number;
  duration_nights: number;
  short_description: string;
  full_description: string;

  // Pricing & availability
  base_price: number | '';
  discount_price: number | '';
  child_price: number | '';
  currency: string;
  available_from: string;
  available_to: string;
  total_seats: number | '';
  pickup_info: string;
  is_featured: boolean;

  // Highlights, inclusions, exclusions
  highlights: string[];
  inclusions: string[];
  exclusions: string[];

  // Itinerary
  itineraryDays: { day_number: number; title: string; description: string }[];

  // FAQs
  faqs: { question: string; answer: string }[];

  // Media & SEO
  images: string[];
  imageUrlsText: string;
  videoUrlsText: string;
  meta_title: string;
  meta_description: string;

  // Status
  status: 'draft' | 'published';
};

function createEmptyPackageDraft(index: number): BulkPackageDraft {
  return {
    id: Math.random().toString(36).substring(2, 9),
    title: '',
    slug: '',
    destination_id: '',
    category: 'family',
    duration_days: 3,
    duration_nights: 2,
    short_description: '',
    full_description: '',
    base_price: '',
    discount_price: '',
    child_price: '',
    currency: 'INR',
    available_from: '',
    available_to: '',
    total_seats: '',
    pickup_info: '',
    is_featured: false,
    highlights: [],
    inclusions: ['Breakfast at hotels', 'AC Vehicle for transfers & sightseeing', 'Toll, parking and driver bata'],
    exclusions: ['Airfare / Train fare', 'Personal expenses & entry fees', 'Optional activities'],
    itineraryDays: [
      { day_number: 1, title: 'Arrival & check-in', description: 'Meet & greet on arrival, transfer to hotel.' },
      { day_number: 2, title: 'Sightseeing & exploration', description: 'Full day local sightseeing and activities.' },
      { day_number: 3, title: 'Departure', description: 'Breakfast, check out, and drop off.' },
    ],
    faqs: [],
    images: [],
    imageUrlsText: '',
    videoUrlsText: '',
    meta_title: '',
    meta_description: '',
    status: 'draft',
  };
}

export function BulkPackagesEditor({ destinations }: { destinations: DestinationOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [packages, setPackages] = useState<BulkPackageDraft[]>([
    createEmptyPackageDraft(1),
    createEmptyPackageDraft(2),
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'itinerary' | 'inclusions' | 'media' | 'seo'>('basic');
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [singleImageUrlInput, setSingleImageUrlInput] = useState('');

  // Fallback if activeIdx goes out of bounds
  const currentPkg = packages[activeIdx] || packages[0];

  function updateCurrent<K extends keyof BulkPackageDraft>(field: K, value: BulkPackageDraft[K]) {
    setPackages((prev) =>
      prev.map((pkg, idx) => {
        if (idx !== activeIdx) return pkg;
        const updated = { ...pkg, [field]: value };

        // Auto-generate slug from title if slug not customized
        if (field === 'title' && typeof value === 'string') {
          if (!pkg.slug || pkg.slug === slugify(pkg.title)) {
            updated.slug = slugify(value);
          }
        }

        // Auto-adjust nights when days changes
        if (field === 'duration_days' && typeof value === 'number') {
          if (pkg.duration_nights === Math.max(0, pkg.duration_days - 1)) {
            updated.duration_nights = Math.max(0, value - 1);
          }
          // Adjust default itinerary days length if matching
          if (updated.itineraryDays.length === pkg.duration_days) {
            if (value > pkg.duration_days) {
              const extraDays = Array.from({ length: value - pkg.duration_days }, (_, i) => ({
                day_number: pkg.duration_days + i + 1,
                title: `Day ${pkg.duration_days + i + 1} Itinerary`,
                description: '',
              }));
              updated.itineraryDays = [...updated.itineraryDays, ...extraDays];
            }
          }
        }

        return updated;
      })
    );
  }

  function addPackage() {
    const newPkg = createEmptyPackageDraft(packages.length + 1);
    setPackages((prev) => [...prev, newPkg]);
    setActiveIdx(packages.length);
  }

  function duplicatePackage(index: number) {
    const source = packages[index];
    if (!source) return;
    const clone: BulkPackageDraft = {
      ...source,
      id: Math.random().toString(36).substring(2, 9),
      title: source.title ? `${source.title} (Copy)` : '',
      slug: source.slug ? `${source.slug}-copy` : '',
      images: [...(source.images || [])],
    };
    setPackages((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, clone);
      return copy;
    });
    setActiveIdx(index + 1);
    toast.success('Package duplicated');
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setIsUploading(true);
    const newUrls: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.set('file', file);
      const res = await uploadPackageImage(formData);
      if (res.error) {
        toast.error(`${file.name}: ${res.error}`);
      } else if (res.url) {
        newUrls.push(res.url);
      }
    }

    if (newUrls.length > 0) {
      setPackages((prev) =>
        prev.map((pkg, idx) => {
          if (idx !== activeIdx) return pkg;
          return {
            ...pkg,
            images: [...(pkg.images || []), ...newUrls],
          };
        })
      );
      toast.success(
        newUrls.length === 1
          ? 'Image uploaded successfully'
          : `${newUrls.length} images uploaded successfully`
      );
    }

    setIsUploading(false);
    e.target.value = '';
  }

  function handleAddImageUrl() {
    const url = singleImageUrlInput.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast.error('Please enter a valid image URL starting with http:// or https://');
      return;
    }
    setPackages((prev) =>
      prev.map((pkg, idx) => {
        if (idx !== activeIdx) return pkg;
        return {
          ...pkg,
          images: [...(pkg.images || []), url],
        };
      })
    );
    setSingleImageUrlInput('');
    toast.success('Image added');
  }

  function removeImage(imageIndex: number) {
    setPackages((prev) =>
      prev.map((pkg, idx) => {
        if (idx !== activeIdx) return pkg;
        return {
          ...pkg,
          images: (pkg.images || []).filter((_, i) => i !== imageIndex),
        };
      })
    );
  }

  function setCoverImage(imageIndex: number) {
    if (imageIndex === 0) return;
    setPackages((prev) =>
      prev.map((pkg, idx) => {
        if (idx !== activeIdx) return pkg;
        const currentImages = [...(pkg.images || [])];
        const [target] = currentImages.splice(imageIndex, 1);
        if (target) {
          currentImages.unshift(target);
        }
        return {
          ...pkg,
          images: currentImages,
        };
      })
    );
    toast.success('Set as package cover photo');
  }

  function moveImage(fromIndex: number, toIndex: number) {
    setPackages((prev) =>
      prev.map((pkg, idx) => {
        if (idx !== activeIdx) return pkg;
        const currentImages = [...(pkg.images || [])];
        const [moved] = currentImages.splice(fromIndex, 1);
        if (moved) {
          currentImages.splice(toIndex, 0, moved);
        }
        return {
          ...pkg,
          images: currentImages,
        };
      })
    );
  }

  function removePackage(index: number) {
    if (packages.length <= 1) {
      setPackages([createEmptyPackageDraft(1)]);
      setActiveIdx(0);
      return;
    }
    setPackages((prev) => prev.filter((_, i) => i !== index));
    if (activeIdx >= packages.length - 1) {
      setActiveIdx(Math.max(0, packages.length - 2));
    }
  }

  // Copy common details (e.g. inclusions, currency) from active package to all others
  function copyCommonToAll(type: 'inclusions' | 'exclusions' | 'pricing_rules') {
    if (!currentPkg) return;
    setPackages((prev) =>
      prev.map((pkg, idx) => {
        if (idx === activeIdx) return pkg;
        if (type === 'inclusions') {
          return { ...pkg, inclusions: [...currentPkg.inclusions] };
        }
        if (type === 'exclusions') {
          return { ...pkg, exclusions: [...currentPkg.exclusions] };
        }
        if (type === 'pricing_rules') {
          return {
            ...pkg,
            currency: currentPkg.currency,
            pickup_info: currentPkg.pickup_info,
          };
        }
        return pkg;
      })
    );
    toast.success(`Copied ${type.replace('_', ' ')} to all other packages!`);
  }

  // Parse TSV / CSV text from Excel or Google Sheets
  function handleParsePaste() {
    if (!pasteText.trim()) return;

    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const newPackages: BulkPackageDraft[] = [];

    for (const line of lines) {
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      const title = parts[0]?.trim() || '';
      if (!title) continue;

      const destText = parts[1]?.trim()?.toLowerCase() || '';
      const matchedDest = destinations.find(
        (d) => d.name.toLowerCase() === destText || destText.includes(d.name.toLowerCase())
      );

      const days = parseInt(parts[2]?.trim() || '3', 10) || 3;
      const nights = parseInt(parts[3]?.trim() || String(Math.max(0, days - 1)), 10) || Math.max(0, days - 1);
      const price = parseFloat(parts[4]?.replace(/[^0-9.]/g, '') || '0') || 0;

      const rawCat = parts[5]?.trim()?.toLowerCase() || 'family';
      const cat = (packageCategories as readonly string[]).includes(rawCat)
        ? (rawCat as (typeof packageCategories)[number])
        : 'family';

      const draft = createEmptyPackageDraft(newPackages.length + 1);
      draft.title = title;
      draft.slug = slugify(title);
      draft.destination_id = matchedDest ? matchedDest.id : '';
      draft.category = cat;
      draft.duration_days = days;
      draft.duration_nights = nights;
      draft.base_price = price > 0 ? price : '';

      newPackages.push(draft);
    }

    if (newPackages.length > 0) {
      setPackages((prev) => {
        const existing = prev.filter((p) => p.title.trim().length > 0);
        return [...existing, ...newPackages];
      });
      toast.success(`Loaded ${newPackages.length} packages from spreadsheet!`);
      setIsPasteModalOpen(false);
      setPasteText('');
    } else {
      toast.error('No valid rows found. Please check your pasted columns.');
    }
  }

  // Submit all packages in bulk
  function handleBulkSave() {
    setFormError(null);

    const validPackages = packages.filter((p) => p.title.trim().length > 0);
    if (validPackages.length === 0) {
      setFormError('Please enter at least one package with a title.');
      return;
    }

    const invalid = validPackages.find((p) => p.title.trim().length < 3);
    if (invalid) {
      setFormError(`"${invalid.title}" is too short. Package titles must be at least 3 characters.`);
      return;
    }

    const payload: BulkPackageInput[] = validPackages.map((p) => {
      const pastedImages = p.imageUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);

      const allImages = Array.from(new Set([...(p.images || []), ...pastedImages]));

      const validVideos = p.videoUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);

      return {
        title: p.title.trim(),
        slug: p.slug.trim() || slugify(p.title),
        destination_id: p.destination_id || null,
        category: p.category,
        duration_days: Math.max(1, p.duration_days),
        duration_nights: Math.max(0, p.duration_nights),
        short_description: p.short_description.trim() || null,
        full_description: p.full_description.trim() || null,
        base_price: typeof p.base_price === 'number' ? p.base_price : 0,
        discount_price: typeof p.discount_price === 'number' && p.discount_price > 0 ? p.discount_price : null,
        child_price: typeof p.child_price === 'number' && p.child_price > 0 ? p.child_price : null,
        currency: p.currency || 'INR',
        available_from: p.available_from || null,
        available_to: p.available_to || null,
        total_seats: typeof p.total_seats === 'number' && p.total_seats > 0 ? p.total_seats : null,
        pickup_info: p.pickup_info.trim() || null,
        is_featured: p.is_featured,
        highlights: p.highlights.filter(Boolean),
        inclusions: p.inclusions.filter(Boolean),
        exclusions: p.exclusions.filter(Boolean),
        itineraryDays: p.itineraryDays.filter((d) => d.title.trim()),
        faqs: p.faqs.filter((f) => f.question.trim() && f.answer.trim()),
        imageUrls: allImages,
        videoUrls: validVideos,
        cover_image_url: allImages[0] || null,
        meta_title: p.meta_title.trim() || null,
        meta_description: p.meta_description.trim() || null,
        status: p.status,
      };
    });

    startTransition(async () => {
      const res = await bulkCreatePackages(payload);
      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
      } else {
        toast.success(`Successfully bulk-saved ${res.count ?? validPackages.length} packages!`);
        router.push('/travinco_dashboard/packages');
        router.refresh();
      }
    });
  }

  const validCount = packages.filter((p) => p.title.trim().length >= 2).length;

  return (
    <div className="space-y-6">
      {/* Top Banner Toolbar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3 bg-white shadow-xs border-ink-150">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-ink-900">
              Bulk Package Builder &bull; {packages.length} in progress
            </p>
            <p className="text-[11px] text-ink-500">
              Configure each package using the tabs, or duplicate ready items to speed up entry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPasteModalOpen(true)}
            className="btn-outline h-8 text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-brand-600" />
            <span>Paste from Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={addPackage}
            className="btn-outline h-8 text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add package</span>
          </button>

          <button
            type="button"
            onClick={handleBulkSave}
            disabled={validCount === 0 || isPending}
            className="btn-primary h-8 text-xs inline-flex items-center gap-2 px-4 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving packages…</span>
              </>
            ) : (
              <>
                <Layers className="h-3.5 w-3.5" />
                <span>Bulk Save All ({validCount})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {formError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-coral-200 bg-coral-50 p-3 text-xs text-coral-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-coral-600" />
          <span className="font-medium">{formError}</span>
        </div>
      )}

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Rail: List of Packages in Current Batch */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-700 px-1">
            <span>Packages to create ({packages.length})</span>
            <span className="text-ink-400 font-normal">Click to edit</span>
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
            {packages.map((pkg, idx) => {
              const isSelected = idx === activeIdx;
              const destName = destinations.find((d) => d.id === pkg.destination_id)?.name;
              const hasTitle = Boolean(pkg.title.trim());

              return (
                <div
                  key={pkg.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`group relative rounded-xl border p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/40 shadow-xs ring-1 ring-brand-400'
                      : 'border-ink-150 bg-white hover:border-ink-300 hover:bg-ink-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-ink-200 bg-ink-100 flex items-center justify-center">
                        {pkg.images && pkg.images.length > 0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pkg.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                              isSelected
                                ? 'bg-brand-600 text-white'
                                : 'bg-ink-200 text-ink-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-ink-400">#{idx + 1}</span>
                          <h3
                            className={`text-xs font-bold truncate ${
                              hasTitle ? 'text-ink-900' : 'text-ink-400 italic'
                            }`}
                          >
                            {pkg.title || 'Untitled Package'}
                          </h3>
                        </div>
                        <div className="text-[10px] text-ink-500 truncate mt-0.5">
                          {destName || 'No destination'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePackage(idx);
                        }}
                        title="Duplicate package"
                        className="p-1 rounded text-ink-400 hover:text-brand-600 hover:bg-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePackage(idx);
                        }}
                        title="Delete package"
                        className="p-1 rounded text-ink-400 hover:text-coral-600 hover:bg-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Summary Badges */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
                    <span className="inline-flex items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-700">
                      <Clock className="h-2.5 w-2.5" />
                      {pkg.duration_days}D/{pkg.duration_nights}N
                    </span>
                    <span className="font-semibold text-brand-700">
                      {pkg.base_price ? `₹${Number(pkg.base_price).toLocaleString('en-IN')}` : 'Price not set'}
                    </span>
                    {pkg.images && pkg.images.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                        <ImageIcon className="h-2.5 w-2.5" />
                        {pkg.images.length} {pkg.images.length === 1 ? 'photo' : 'photos'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-ink-50 border border-ink-150 px-1.5 py-0.5 text-[10px] text-ink-400">
                        No photo
                      </span>
                    )}
                    <span
                      className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        pkg.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-sand-100 text-sand-800'
                      }`}
                    >
                      {pkg.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addPackage}
            className="w-full border-2 border-dashed border-ink-200 rounded-xl p-3 text-xs font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add another package</span>
          </button>
        </div>

        {/* Right Panel: Detailed Form with All Fields */}
        <div className="lg:col-span-8 card p-5 sm:p-6 space-y-6 bg-white border-ink-150 shadow-xs">
          {/* Active Package Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">
                {activeIdx + 1}
              </span>
              <h2 className="text-base font-bold text-ink-900">
                {currentPkg?.title || `Package #${activeIdx + 1} Details`}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {/* Status Picker */}
              <select
                value={currentPkg?.status}
                onChange={(e) => updateCurrent('status', e.target.value as 'draft' | 'published')}
                className="input h-8 text-xs font-semibold cursor-pointer"
              >
                <option value="draft">Save as Draft</option>
                <option value="published">Publish Directly</option>
              </select>

              {/* Quick Copy dropdown */}
              <div className="flex items-center gap-1 text-[11px] text-ink-500">
                <span className="text-ink-300">|</span>
                <button
                  type="button"
                  onClick={() => copyCommonToAll('inclusions')}
                  className="hover:text-brand-700 hover:underline cursor-pointer px-1"
                  title="Copy this package's inclusions to all other packages"
                >
                  Copy inclusions to all
                </button>
                <span className="text-ink-300">&bull;</span>
                <button
                  type="button"
                  onClick={() => copyCommonToAll('exclusions')}
                  className="hover:text-brand-700 hover:underline cursor-pointer px-1"
                  title="Copy this package's exclusions to all other packages"
                >
                  Copy exclusions to all
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Tabs for this Package */}
          <div className="flex flex-wrap gap-1 border-b border-ink-100 pb-2 text-xs font-medium text-ink-600">
            {[
              { id: 'basic', label: '1. Basic Info' },
              { id: 'pricing', label: '2. Pricing & Dates' },
              { id: 'itinerary', label: '3. Itinerary' },
              { id: 'inclusions', label: '4. Inclusions & FAQs' },
              {
                id: 'media',
                label: `5. Photos & Video${currentPkg?.images?.length ? ` (${currentPkg.images.length})` : ''}`,
              },
              { id: 'seo', label: '6. SEO' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-brand-600 text-white font-semibold shadow-2xs'
                    : 'hover:bg-ink-100 text-ink-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Basic Information */}
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">
                    Package Title <span className="text-coral-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={currentPkg?.title}
                    onChange={(e) => updateCurrent('title', e.target.value)}
                    placeholder="e.g. 5D/4N Munnar & Alleppey Special Honeymoon"
                    className="input font-medium"
                  />
                </div>

                <div>
                  <label className="label">Destination</label>
                  <select
                    value={currentPkg?.destination_id}
                    onChange={(e) => updateCurrent('destination_id', e.target.value)}
                    className="input cursor-pointer"
                  >
                    <option value="">No specific destination</option>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Category</label>
                  <select
                    value={currentPkg?.category}
                    onChange={(e) => updateCurrent('category', e.target.value as any)}
                    className="input cursor-pointer capitalize"
                  >
                    {packageCategories.map((c) => (
                      <option key={c} value={c} className="capitalize">
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={currentPkg?.duration_days}
                    onChange={(e) => updateCurrent('duration_days', parseInt(e.target.value || '1', 10))}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Duration (Nights)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={currentPkg?.duration_nights}
                    onChange={(e) => updateCurrent('duration_nights', parseInt(e.target.value || '0', 10))}
                    className="input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Slug (URL)</label>
                  <input
                    type="text"
                    value={currentPkg?.slug}
                    onChange={(e) => updateCurrent('slug', slugify(e.target.value))}
                    placeholder="e.g. munnar-alleppey-honeymoon"
                    className="input font-mono text-xs text-ink-700"
                  />
                  <p className="text-[11px] text-ink-400 mt-1">
                    Auto-generated from title. Unique suffixes will be automatically added if collision occurs.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Short Description (Card Summary)</label>
                  <textarea
                    rows={2}
                    value={currentPkg?.short_description}
                    onChange={(e) => updateCurrent('short_description', e.target.value)}
                    placeholder="Shown on package search cards (keep under 500 characters)"
                    className="input text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Full Detailed Description</label>
                  <textarea
                    rows={4}
                    value={currentPkg?.full_description}
                    onChange={(e) => updateCurrent('full_description', e.target.value)}
                    placeholder="Complete trip overview and itinerary introduction…"
                    className="input text-xs"
                  />
                </div>

                {/* Quick Cover Photo Banner */}
                <div className="sm:col-span-2 rounded-xl border border-ink-150 p-3.5 bg-ink-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-20 shrink-0 rounded-lg overflow-hidden border border-ink-200 bg-ink-100 flex items-center justify-center">
                      {currentPkg?.images && currentPkg.images.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={currentPkg.images[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="h-5 w-5 text-ink-300 mx-auto" />
                          <span className="text-[9px] text-ink-400 block font-medium">No Cover</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-ink-800">
                        Cover Photo {currentPkg?.images && currentPkg.images.length > 0 ? `(${currentPkg.images.length} photos added)` : 'Not Set'}
                      </h4>
                      <p className="text-[11px] text-ink-400 mt-0.5">
                        {currentPkg?.images && currentPkg.images.length > 0
                          ? 'First photo is used as cover image on public listings.'
                          : 'Upload at least one photo for this package (required to publish).'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="btn-outline h-7 text-xs inline-flex items-center gap-1.5 px-2.5 cursor-pointer">
                      <UploadCloud className="h-3 w-3 text-brand-600" />
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleFileSelect}
                        disabled={isUploading}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('media')}
                      className="btn-outline h-7 text-xs px-2.5 cursor-pointer text-ink-700"
                    >
                      Manage Photos →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Pricing & Availability */}
          {activeTab === 'pricing' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">
                    Starting Price (₹) <span className="text-coral-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={currentPkg?.base_price}
                    onChange={(e) => updateCurrent('base_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="18500"
                    className="input font-semibold"
                  />
                </div>

                <div>
                  <label className="label">Discount / Offer Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={currentPkg?.discount_price}
                    onChange={(e) => updateCurrent('discount_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="15999"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Children Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={currentPkg?.child_price}
                    onChange={(e) => updateCurrent('child_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="8000"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Currency</label>
                  <select
                    value={currentPkg?.currency}
                    onChange={(e) => updateCurrent('currency', e.target.value)}
                    className="input cursor-pointer"
                  >
                    <option value="INR">INR — Indian Rupee</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="AED">AED — UAE Dirham</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="SAR">SAR — Saudi Riyal</option>
                    <option value="SGD">SGD — Singapore Dollar</option>
                  </select>
                </div>

                <div>
                  <label className="label">Available From (Date)</label>
                  <input
                    type="date"
                    value={currentPkg?.available_from}
                    onChange={(e) => updateCurrent('available_from', e.target.value)}
                    className="input text-xs"
                  />
                </div>

                <div>
                  <label className="label">Available To (Date)</label>
                  <input
                    type="date"
                    value={currentPkg?.available_to}
                    onChange={(e) => updateCurrent('available_to', e.target.value)}
                    className="input text-xs"
                  />
                </div>

                <div>
                  <label className="label">Total Seats / Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={currentPkg?.total_seats}
                    onChange={(e) => updateCurrent('total_seats', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    placeholder="e.g. 20"
                    className="input text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Pickup Information</label>
                  <input
                    type="text"
                    value={currentPkg?.pickup_info}
                    onChange={(e) => updateCurrent('pickup_info', e.target.value)}
                    placeholder="e.g. Pickup from Kochi Airport / Ernakulam Railway Station"
                    className="input text-xs"
                  />
                </div>

                <div className="sm:col-span-3 pt-2">
                  <label className="flex items-center gap-2.5 text-xs font-medium text-ink-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentPkg?.is_featured}
                      onChange={(e) => updateCurrent('is_featured', e.target.checked)}
                      className="rounded border-ink-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                    />
                    <span>Feature this package on the website homepage</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Itinerary */}
          {activeTab === 'itinerary' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-ink-900">Day-by-Day Itinerary Plan</h3>
                  <p className="text-[11px] text-ink-500">
                    Add day titles and descriptions for each day of the {currentPkg?.duration_days}-day trip.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const days = currentPkg?.itineraryDays || [];
                    const nextNum = days.length + 1;
                    updateCurrent('itineraryDays', [
                      ...days,
                      { day_number: nextNum, title: `Day ${nextNum} Sightseeing`, description: '' },
                    ]);
                  }}
                  className="btn-outline h-7 text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Day</span>
                </button>
              </div>

              <div className="space-y-3">
                {currentPkg?.itineraryDays.map((day, dIdx) => (
                  <div key={dIdx} className="rounded-xl border border-ink-150 p-3.5 bg-ink-50/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                        Day {day.day_number}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = currentPkg.itineraryDays
                            .filter((_, i) => i !== dIdx)
                            .map((d, i) => ({ ...d, day_number: i + 1 }));
                          updateCurrent('itineraryDays', updated);
                        }}
                        className="text-ink-400 hover:text-coral-600 p-1"
                        title="Remove day"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={day.title}
                      onChange={(e) => {
                        const item = currentPkg?.itineraryDays[dIdx];
                        if (!item) return;
                        const updated = [...currentPkg.itineraryDays];
                        updated[dIdx] = { ...item, title: e.target.value };
                        updateCurrent('itineraryDays', updated);
                      }}
                      placeholder={`e.g. Arrival in destination & leisure`}
                      className="input text-xs font-medium"
                    />

                    <textarea
                      rows={2}
                      value={day.description}
                      onChange={(e) => {
                        const item = currentPkg?.itineraryDays[dIdx];
                        if (!item) return;
                        const updated = [...currentPkg.itineraryDays];
                        updated[dIdx] = { ...item, description: e.target.value };
                        updateCurrent('itineraryDays', updated);
                      }}
                      placeholder="Activities and travel plan for this day (optional)"
                      className="input text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Inclusions & FAQs */}
          {activeTab === 'inclusions' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              {/* Highlights */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Package Highlights (one per line)</label>
                </div>
                <textarea
                  rows={3}
                  value={currentPkg?.highlights.join('\n')}
                  onChange={(e) =>
                    updateCurrent(
                      'highlights',
                      e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  placeholder={`Private houseboat cruise in Alleppey\nJeep safari in Wayanad\nComplimentary candle-light dinner`}
                  className="input text-xs leading-relaxed"
                />
              </div>

              {/* Inclusions & Exclusions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Inclusions (one per line)</label>
                  <textarea
                    rows={5}
                    value={currentPkg?.inclusions.join('\n')}
                    onChange={(e) =>
                      updateCurrent(
                        'inclusions',
                        e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder={`All accommodation in 3/4-star hotels\nDaily buffet breakfast\nPrivate AC sedan for transfers\nToll, parking and driver charges`}
                    className="input text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="label">Exclusions (one per line)</label>
                  <textarea
                    rows={5}
                    value={currentPkg?.exclusions.join('\n')}
                    onChange={(e) =>
                      updateCurrent(
                        'exclusions',
                        e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder={`Airfare or train tickets\nEntry tickets to monuments\nPersonal expenses & laundry\nAny items not specified in inclusions`}
                    className="input text-xs leading-relaxed"
                  />
                </div>
              </div>

              {/* FAQs */}
              <div className="border-t border-ink-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="label mb-0">Frequently Asked Questions (FAQs)</label>
                  <button
                    type="button"
                    onClick={() => {
                      updateCurrent('faqs', [
                        ...(currentPkg?.faqs || []),
                        { question: '', answer: '' },
                      ]);
                    }}
                    className="btn-outline h-7 text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Question</span>
                  </button>
                </div>

                {currentPkg?.faqs.map((faq, fIdx) => (
                  <div key={fIdx} className="rounded-lg border border-ink-150 p-3 bg-ink-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-ink-600">Question {fIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          updateCurrent(
                            'faqs',
                            currentPkg.faqs.filter((_, i) => i !== fIdx)
                          );
                        }}
                        className="text-ink-400 hover:text-coral-600 p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={faq.question}
                      onChange={(e) => {
                        const item = currentPkg?.faqs[fIdx];
                        if (!item) return;
                        const updated = [...currentPkg.faqs];
                        updated[fIdx] = { ...item, question: e.target.value };
                        updateCurrent('faqs', updated);
                      }}
                      placeholder="e.g. Is airport transfer included?"
                      className="input text-xs"
                    />
                    <textarea
                      rows={2}
                      value={faq.answer}
                      onChange={(e) => {
                        const item = currentPkg?.faqs[fIdx];
                        if (!item) return;
                        const updated = [...currentPkg.faqs];
                        updated[fIdx] = { ...item, answer: e.target.value };
                        updateCurrent('faqs', updated);
                      }}
                      placeholder="Answer..."
                      className="input text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: Photos & Video */}
          {activeTab === 'media' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              {/* Photo Upload Card */}
              <div className="rounded-xl border border-ink-150 p-5 bg-white space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-brand-600" />
                      <span>Package Photos ({currentPkg?.images?.length || 0})</span>
                    </h3>
                    <p className="text-[11px] text-ink-400 mt-0.5">
                      Upload JPG, PNG or WEBP photos directly. The first photo automatically becomes the package cover.
                    </p>
                  </div>
                  <label className="btn-primary h-8 text-xs inline-flex items-center gap-1.5 px-3 cursor-pointer shrink-0">
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Upload Photos</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleFileSelect}
                      disabled={isUploading}
                      className="sr-only"
                    />
                  </label>
                </div>

                {/* Upload drag & drop zone */}
                <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-ink-200 hover:border-brand-500 rounded-xl bg-ink-50/50 hover:bg-brand-50/20 transition cursor-pointer group text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 mb-2 group-hover:scale-105 transition">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-ink-800 group-hover:text-brand-700">
                    Click to browse files or drag and drop photos here
                  </span>
                  <span className="text-[11px] text-ink-400 mt-1">
                    Supports JPG, PNG, WEBP (up to 8 MB per file). You can select multiple images at once.
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleFileSelect}
                    disabled={isUploading}
                    className="sr-only"
                  />
                </label>

                {isUploading && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 text-xs font-medium">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-600 shrink-0" />
                    <span>Uploading photos to cloud storage... Please wait.</span>
                  </div>
                )}

                {/* Add Image via URL */}
                <div className="pt-2 border-t border-ink-100">
                  <span className="text-[11px] font-semibold text-ink-600 block mb-1.5">
                    Or Add Image via Web URL
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={singleImageUrlInput}
                      onChange={(e) => setSingleImageUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddImageUrl();
                        }
                      }}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="input h-8 text-xs flex-1 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="btn-outline h-8 text-xs px-3 font-semibold shrink-0 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add URL
                    </button>
                  </div>
                </div>

                {/* Photo Gallery Grid */}
                {currentPkg?.images && currentPkg.images.length > 0 ? (
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-ink-700 uppercase tracking-wide">
                        Attached Photos ({currentPkg.images.length})
                      </span>
                      <span className="text-[11px] text-ink-400">
                        Hover an image to set as cover or reorder
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {currentPkg.images.map((url, i) => (
                        <div
                          key={`${url}-${i}`}
                          className="group relative aspect-video rounded-xl overflow-hidden border border-ink-200 bg-ink-100 shadow-2xs"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Photo ${i + 1}`}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />

                          {/* Cover badge or Set Cover button */}
                          {i === 0 ? (
                            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              <Star className="h-2.5 w-2.5 fill-current" /> Cover Photo
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCoverImage(i)}
                              className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition rounded-md bg-white/95 hover:bg-white px-2 py-0.5 text-[10px] font-semibold text-ink-800 shadow-xs flex items-center gap-1 cursor-pointer"
                              title="Set as package cover photo"
                            >
                              <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                              <span>Set Cover</span>
                            </button>
                          )}

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition rounded-md bg-coral-600/90 hover:bg-coral-600 p-1 text-white shadow-xs cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>

                          {/* Reorder controls */}
                          <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            {i > 0 && (
                              <button
                                type="button"
                                onClick={() => moveImage(i, i - 1)}
                                className="rounded bg-white/90 hover:bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink-700 shadow-xs cursor-pointer"
                                title="Move left"
                              >
                                ←
                              </button>
                            )}
                            {i < currentPkg.images.length - 1 && (
                              <button
                                type="button"
                                onClick={() => moveImage(i, i + 1)}
                                className="rounded bg-white/90 hover:bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink-700 shadow-xs cursor-pointer"
                                title="Move right"
                              >
                                →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-ink-200 rounded-xl bg-ink-50/30">
                    <ImageIcon className="h-8 w-8 text-ink-300 mx-auto mb-1.5" />
                    <p className="text-xs text-ink-500 font-medium">No photos added to this package yet.</p>
                    <p className="text-[11px] text-ink-400">Upload photos above or paste URLs below.</p>
                  </div>
                )}
              </div>

              {/* Batch Paste Image URLs (Collapsible or secondary) */}
              <div className="rounded-xl border border-ink-150 p-4 bg-white space-y-2 shadow-2xs">
                <label className="label mb-0">Paste Multiple Photo URLs (Optional)</label>
                <p className="text-[11px] text-ink-400">
                  If you have external CDN or hosted URLs, paste them here (one per line). They will be merged with uploaded photos.
                </p>
                <textarea
                  rows={3}
                  value={currentPkg?.imageUrlsText}
                  onChange={(e) => updateCurrent('imageUrlsText', e.target.value)}
                  placeholder={`https://images.unsplash.com/photo-1593693397690-362cb9666fc2\nhttps://images.unsplash.com/photo-1602216056096-3b40cc0c9944`}
                  className="input font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Videos */}
              <div className="rounded-xl border border-ink-150 p-4 bg-white space-y-2 shadow-2xs">
                <label className="label mb-0">YouTube or Vimeo Video URLs (one per line)</label>
                <p className="text-[11px] text-ink-400">
                  Paste video links to embed them directly on the package page.
                </p>
                <textarea
                  rows={2}
                  value={currentPkg?.videoUrlsText}
                  onChange={(e) => updateCurrent('videoUrlsText', e.target.value)}
                  placeholder={`https://www.youtube.com/watch?v=…`}
                  className="input font-mono text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 6: SEO */}
          {activeTab === 'seo' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div>
                <label className="label">Meta Title (SEO)</label>
                <input
                  type="text"
                  value={currentPkg?.meta_title}
                  onChange={(e) => updateCurrent('meta_title', e.target.value)}
                  placeholder="Auto-generated from package title if left blank"
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label">Meta Description (SEO)</label>
                <textarea
                  rows={3}
                  value={currentPkg?.meta_description}
                  onChange={(e) => updateCurrent('meta_description', e.target.value)}
                  placeholder="Auto-generated from short description if left blank"
                  className="input text-xs"
                />
              </div>
            </div>
          )}

          {/* Step Navigation footer inside panel */}
          <div className="flex items-center justify-between border-t border-ink-100 pt-4 text-xs">
            <button
              type="button"
              disabled={activeIdx === 0}
              onClick={() => setActiveIdx((prev) => Math.max(0, prev - 1))}
              className="btn-outline h-8 px-3 text-xs disabled:opacity-30 cursor-pointer"
            >
              &larr; Previous Package
            </button>

            <span className="text-ink-400 font-medium">
              Editing Package {activeIdx + 1} of {packages.length}
            </span>

            <button
              type="button"
              disabled={activeIdx >= packages.length - 1}
              onClick={() => setActiveIdx((prev) => Math.min(packages.length - 1, prev + 1))}
              className="btn-outline h-8 px-3 text-xs disabled:opacity-30 cursor-pointer"
            >
              Next Package &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Spreadsheet Import Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl border border-ink-150 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-brand-600" />
                <h3 className="text-sm font-bold text-ink-900">Paste Spreadsheet / CSV Rows</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="text-ink-400 hover:text-ink-700"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-ink-500 leading-relaxed">
              Paste rows copied from Excel or Google Sheets. Columns expected in order:
              <br />
              <code className="bg-ink-100 text-brand-700 px-1 py-0.5 rounded text-[11px] font-mono mt-1 inline-block">
                Title [Tab] Destination [Tab] Days [Tab] Nights [Tab] Price [Tab] Category
              </code>
            </p>

            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Munnar Honeymoon Special\tKerala\t4\t3\t18500\thoneymoon\nAlleppey Houseboat Cruise\tKerala\t2\t1\t9500\tfamily`}
              className="input font-mono text-xs w-full p-3 leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="btn-outline h-8 text-xs px-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParsePaste}
                disabled={!pasteText.trim()}
                className="btn-primary h-8 text-xs px-4"
              >
                Parse &amp; Append Packages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
