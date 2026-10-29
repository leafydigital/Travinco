'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { HField, CountryInput } from '@/components/admin/horizontal-field';
import { bulkCreateDestinations, getFeaturedDestinations, type BulkDestinationInput } from './actions';
import {
  FeaturedLimitDialog,
  MAX_FEATURED_DESTINATIONS,
  type FeaturedDestination,
} from './featured-limit-dialog';
import { uploadDestinationImage } from './upload-actions';
import { slugify } from '@/lib/validations/package';
import type { ContentStatus } from '@/types/database';
import { ModalPortal } from '@/components/ui/modal-portal';

export type BulkDestinationCard = {
  id: string;
  name: string;
  country: string;
  slug: string;
  slugTouched: boolean;
  showSlugField: boolean;
  cover_image_url: string;
  description: string;
  is_featured: boolean;
  status: ContentStatus;
  meta_title: string;
  meta_description: string;
  isCollapsed: boolean;
};

function createEmptyDestinationCard(): BulkDestinationCard {
  return {
    id: Math.random().toString(36).substring(2, 9),
    name: '',
    country: '',
    slug: '',
    slugTouched: false,
    showSlugField: false,
    cover_image_url: '',
    description: '',
    is_featured: false,
    status: 'draft',
    meta_title: '',
    meta_description: '',
    isCollapsed: false,
  };
}

interface BulkCreateDestinationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BulkCreateDestinationsModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkCreateDestinationsModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cards, setCards] = useState<BulkDestinationCard[]>([
    createEmptyDestinationCard(),
    createEmptyDestinationCard(),
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);
  const [featured, setFeatured] = useState<FeaturedDestination[]>([]);
  const [featuredLimitOpen, setFeaturedLimitOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    getFeaturedDestinations()
      .then(setFeatured)
      .catch(() => setFeatured([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const pendingFeatured: FeaturedDestination[] = cards
    .filter((c) => c.is_featured)
    .map((c) => ({ id: c.id, name: c.name.trim() }));

  function handleFeaturedChange(index: number, checked: boolean) {
    if (checked && featured.length + pendingFeatured.length >= MAX_FEATURED_DESTINATIONS) {
      setFeaturedLimitOpen(true);
      return;
    }
    updateCard(index, 'is_featured', checked);
  }

  async function handleCardImageUpload(index: number, file: File) {
    const card = cards[index];
    if (!card) return;
    setUploadingCardId(card.id);
    const formData = new FormData();
    formData.set('file', file);
    const res = await uploadDestinationImage(formData);
    if (res.error) {
      toast.error(res.error);
    } else if (res.url) {
      updateCard(index, 'cover_image_url', res.url);
      toast.success('Cover image uploaded');
    }
    setUploadingCardId(null);
  }

  function updateCard<K extends keyof BulkDestinationCard>(
    index: number,
    field: K,
    value: BulkDestinationCard[K]
  ) {
    setCards((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const updated = { ...c, [field]: value };
        if (field === 'name' && typeof value === 'string' && !c.slugTouched) {
          updated.slug = slugify(value);
        }
        return updated;
      })
    );
  }

  function addCard() {
    setCards((prev) => [...prev, createEmptyDestinationCard()]);
  }

  function addMultipleCards(count: number) {
    setCards((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => createEmptyDestinationCard()),
    ]);
  }

  function duplicateCard(index: number) {
    setCards((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const clone: BulkDestinationCard = {
        ...source,
        id: Math.random().toString(36).substring(2, 9),
        name: source.name ? `${source.name} (Copy)` : '',
        slug: source.slug ? `${source.slug}-copy` : '',
        slugTouched: true,
        showSlugField: true,
        is_featured: false,
      };
      const copy = [...prev];
      copy.splice(index + 1, 0, clone);
      return copy;
    });
  }

  function removeCard(index: number) {
    if (cards.length <= 1) {
      setCards([createEmptyDestinationCard()]);
      return;
    }
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  function clearEmptyCards() {
    const valid = cards.filter((c) => c.name.trim().length > 0);
    setCards(valid.length > 0 ? valid : [createEmptyDestinationCard()]);
  }

  function handleBulkSave() {
    setFormError(null);

    const validCards = cards.filter((c) => c.name.trim().length > 0);
    if (validCards.length === 0) {
      setFormError('Please enter at least one destination name.');
      return;
    }

    const invalidName = validCards.find((c) => c.name.trim().length < 2);
    if (invalidName) {
      setFormError(`"${invalidName.name}" is too short. Names must be at least 2 characters.`);
      return;
    }

    const payload: BulkDestinationInput[] = validCards.map((c) => ({
      name: c.name.trim(),
      slug: c.slug.trim() || slugify(c.name.trim()),
      country: c.country.trim() || null,
      description: c.description.trim() || null,
      cover_image_url: c.cover_image_url.trim() || null,
      is_featured: c.is_featured,
      status: c.status,
      meta_title: c.meta_title.trim() || null,
      meta_description: c.meta_description.trim() || null,
    }));

    startTransition(async () => {
      const res = await bulkCreateDestinations(payload);
      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
      } else {
        toast.success(`Successfully saved ${res.count ?? validCards.length} destinations!`);
        router.refresh();
        if (onSuccess) onSuccess();
        onClose();
      }
    });
  }

  const validCount = cards.filter((c) => c.name.trim().length > 0).length;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
        <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-lg shadow-ink-900/5 border border-ink-100 overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-ink-100 px-5 sm:px-6 py-4 bg-ink-50/70">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-2xs">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-ink-900">Bulk Create Destinations</h2>
                  <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                    Batch Mode
                  </span>
                </div>
                <p className="text-xs text-ink-500">
                  Add multiple destinations with the exact same fields as the new destination page.
                </p>
              </div>
            </div>
  
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 border border-brand-200">
                {cards.length} destination{cards.length !== 1 ? 's' : ''}
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
              {/* List of Destination Form Cards */}
              <div className="space-y-4">
                {cards.map((card, index) => (
                  <div
                    key={card.id}
                    className="card space-y-4 p-5 bg-white border border-ink-150 rounded-xl shadow-2xs relative transition-all"
                  >
                    {/* Card Top Bar with Title, Status & Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 border border-brand-200">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-ink-900">
                            {card.name.trim() ? card.name : `Destination #${index + 1}`}
                          </h3>
                          {card.country && (
                            <span className="text-[11px] text-ink-400 font-medium">
                              {card.country}
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
                          title="Duplicate destination"
                          className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 hover:bg-brand-50 hover:text-brand-700 transition cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                          <span className="hidden sm:inline">Duplicate</span>
                        </button>
  
                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeCard(index)}
                          title="Remove destination"
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
  
                    {/* Same fields as DestinationForm */}
                    {!card.isCollapsed && (
                      <div className="space-y-3 pt-1">
                        <HField label="Name" required htmlFor={`bulk-name-${card.id}`} fieldClassName="sm:max-w-md">
                          <input
                            id={`bulk-name-${card.id}`}
                            className="input"
                            placeholder="e.g. Munnar, Kashmir, Dubai"
                            value={card.name}
                            onChange={(e) => updateCard(index, 'name', e.target.value)}
                          />
                        </HField>
  
                        <HField label="Country" htmlFor={`bulk-country-${card.id}`} fieldClassName="sm:max-w-xs">
                          <CountryInput
                            id={`bulk-country-${card.id}`}
                            value={card.country}
                            onChange={(v) => updateCard(index, 'country', v)}
                          />
                        </HField>
  
                        <HField label="Cover image">
                          <div className="flex flex-wrap items-center gap-3">
                            {card.cover_image_url && (
                              <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-ink-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={card.cover_image_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateCard(index, 'cover_image_url', '')}
                                  className="absolute top-1 right-1 rounded-full bg-ink-900/70 p-0.5 text-white hover:bg-coral-600 transition"
                                  title="Remove image"
                                >
                                  <X className="h-3 w-3" />
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
                              className="block text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                            />
                            {uploadingCardId === card.id && (
                              <p className="text-xs text-brand-600 flex items-center gap-1.5">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Uploading…</span>
                              </p>
                            )}
                          </div>
                        </HField>
  
                        {!card.showSlugField ? (
                          <div className="sm:pl-[8.75rem]">
                            <button
                              type="button"
                              onClick={() => updateCard(index, 'showSlugField', true)}
                              className="text-xs text-brand-600 hover:underline"
                            >
                              Customize page URL
                            </button>
                          </div>
                        ) : (
                          <HField
                            label="Slug (URL)"
                            required
                            htmlFor={`bulk-slug-${card.id}`}
                            fieldClassName="sm:max-w-md"
                            hint="Used in the public URL, e.g. /destinations/munnar. Filled in automatically from the name."
                          >
                            <input
                              id={`bulk-slug-${card.id}`}
                              className="input"
                              value={card.slug}
                              onChange={(e) => {
                                updateCard(index, 'slugTouched', true);
                                updateCard(index, 'slug', slugify(e.target.value));
                              }}
                            />
                          </HField>
                        )}
  
                        <HField label="Description" htmlFor={`bulk-desc-${card.id}`}>
                          <textarea
                            id={`bulk-desc-${card.id}`}
                            rows={2}
                            className="input"
                            placeholder="Provide a regional summary, key attractions, and overview…"
                            value={card.description}
                            onChange={(e) => updateCard(index, 'description', e.target.value)}
                          />
                        </HField>
  
                        <HField label="Featured">
                          <label className="flex items-center gap-2 pt-2 text-sm text-ink-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={card.is_featured}
                              onChange={(e) => handleFeaturedChange(index, e.target.checked)}
                              className="rounded border-ink-300 text-brand-700 focus:ring-brand-500 h-4 w-4"
                            />
                            <span>Show in homepage &quot;Popular destinations&quot;</span>
                            <span className="text-xs text-ink-400">(max {MAX_FEATURED_DESTINATIONS})</span>
                          </label>
                        </HField>
  
                        <HField label="Meta title" htmlFor={`bulk-mt-${card.id}`} fieldClassName="sm:max-w-xl">
                          <input
                            id={`bulk-mt-${card.id}`}
                            className="input"
                            placeholder="e.g. Munnar Tourism, Packages & Sightseeing"
                            value={card.meta_title}
                            onChange={(e) => updateCard(index, 'meta_title', e.target.value)}
                          />
                        </HField>
  
                        <HField label="Meta description" htmlFor={`bulk-md-${card.id}`}>
                          <input
                            id={`bulk-md-${card.id}`}
                            className="input"
                            placeholder="e.g. Plan your trip to Munnar. Explore top tour packages and stays."
                            value={card.meta_description}
                            onChange={(e) => updateCard(index, 'meta_description', e.target.value)}
                          />
                        </HField>
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
                    <span>Add Another Destination</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addMultipleCards(3)}
                    disabled={isPending}
                    className="btn-outline inline-flex items-center gap-1.5 h-9 text-xs cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add 3 Destinations</span>
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
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" />
                  <span>Unique URL slugs &amp; SEO tags are automatically created.</span>
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
                {validCount} destination{validCount !== 1 ? 's' : ''}
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
                    <span>Saving {validCount} destinations…</span>
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
  
        <FeaturedLimitDialog
          open={featuredLimitOpen}
          featured={featured}
          pending={pendingFeatured}
          onUnfeatured={(id) => {
            setFeatured((list) => list.filter((d) => d.id !== id));
            setFeaturedLimitOpen(false);
          }}
          onUnfeaturePending={(cardId) => {
            setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, is_featured: false } : c)));
            setFeaturedLimitOpen(false);
          }}
          onClose={() => setFeaturedLimitOpen(false)}
        />
      </div>
    </ModalPortal>
  );
}

export function BulkCreateDestinationsButton({
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
        title="Quickly add multiple destinations at once"
      >
        <Layers className="h-4 w-4 text-brand-600" />
        <span>Bulk create</span>
      </button>

      <BulkCreateDestinationsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
