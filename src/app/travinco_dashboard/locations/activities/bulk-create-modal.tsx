'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  X,
  Loader2,
  AlertCircle,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { bulkCreateActivities, type CreatedActivityItem } from './actions';
import { ModalPortal } from '@/components/ui/modal-portal';

export interface LocationOption {
  id: number | string;
  name: string;
  display_name?: string | null;
}

export type BulkActivityCard = {
  id: string;
  location_id: string;
  name: string;
  category: string;
  preferred_types: string;
  description: string;
  is_active: boolean;
  isCollapsed: boolean;
};

const CATEGORY_OPTIONS = [
  { value: 'Sightseeing', label: 'Sightseeing' },
  { value: 'Activity', label: 'Activity' },
  { value: 'Experience', label: 'Experience' },
  { value: 'Adventure', label: 'Adventure' },
  { value: 'Temple', label: 'Temple / Pilgrimage' },
  { value: 'Shopping', label: 'Shopping' },
];

const PREFERRED_TYPE_OPTIONS = [
  'All',
  'Adult',
  'Children',
  'Family',
  'Adult & Children',
  'Couples',
];

function createEmptyActivityCard(defaultLocationId = ''): BulkActivityCard {
  return {
    id: Math.random().toString(36).substring(2, 9),
    location_id: defaultLocationId,
    name: '',
    category: 'Sightseeing',
    preferred_types: 'All',
    description: '',
    is_active: true,
    isCollapsed: false,
  };
}

interface BulkCreateActivitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: LocationOption[];
  onSuccess?: (created: CreatedActivityItem[]) => void;
}

export function BulkCreateActivitiesModal({
  isOpen,
  onClose,
  locations,
  onSuccess,
}: BulkCreateActivitiesModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultLocId = locations[0] ? String(locations[0].id) : '';

  const [cards, setCards] = useState<BulkActivityCard[]>([
    createEmptyActivityCard(defaultLocId),
    createEmptyActivityCard(defaultLocId),
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  function updateCard<K extends keyof BulkActivityCard>(
    index: number,
    field: K,
    value: BulkActivityCard[K]
  ) {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function addCard() {
    // Inherit the location of the previous card for ease of use
    const lastLocId = cards[cards.length - 1]?.location_id || defaultLocId;
    setCards((prev) => [...prev, createEmptyActivityCard(lastLocId)]);
  }

  function addMultipleCards(count: number) {
    const lastLocId = cards[cards.length - 1]?.location_id || defaultLocId;
    setCards((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => createEmptyActivityCard(lastLocId)),
    ]);
  }

  function duplicateCard(index: number) {
    setCards((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const clone: BulkActivityCard = {
        ...source,
        id: Math.random().toString(36).substring(2, 9),
        name: source.name.trim() ? `${source.name.trim()} (Copy)` : '',
      };
      const copy = [...prev];
      copy.splice(index + 1, 0, clone);
      return copy;
    });
  }

  function removeCard(index: number) {
    if (cards.length <= 1) {
      setCards([createEmptyActivityCard(defaultLocId)]);
      return;
    }
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  function clearEmptyCards() {
    const valid = cards.filter((c) => c.name.trim().length > 0);
    setCards(valid.length > 0 ? valid : [createEmptyActivityCard(defaultLocId)]);
  }

  function handleBulkSave() {
    setFormError(null);

    // Cards with any details are saved; completely blank cards are ignored.
    const activeCards = cards.filter((c) => Boolean(c.location_id) || [c.name, c.description].some((v) => v.trim()));

    if (activeCards.length === 0) {
      setFormError('Please enter at least one place activity name to save.');
      return;
    }
    const unnamed = activeCards.find((c) => !c.name.trim());
    if (unnamed) {
      const message = `Activity card ${activeCards.indexOf(unnamed) + 1}: activity name is required.`;
      setFormError(message);
      toast.error(message);
      setCards((prev) => prev.map((card) => (card.id === unnamed.id ? { ...card, isCollapsed: false } : card)));
      return;
    }

    // Check if any active card is missing a location
    const missingLoc = activeCards.find((c) => !c.location_id);
    if (missingLoc) {
      setFormError(
        `Please select a location for "${missingLoc.name.trim() || 'Activity'}".`
      );
      return;
    }

    startTransition(async () => {
      const payload = activeCards.map((c) => ({
        location_id: Number(c.location_id),
        name: c.name.trim(),
        category: c.category.trim() || 'Sightseeing',
        preferred_types: c.preferred_types.trim() || 'All',
        description: c.description.trim() || null,
        is_active: c.is_active,
      }));

      const res = await bulkCreateActivities(payload);

      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
        return;
      }

      toast.success(
        `Successfully created ${res.count ?? payload.length} sightseeing ${
          (res.count ?? payload.length) === 1 ? 'activity' : 'activities'
        }`
      );

      if (onSuccess && res.created) {
        onSuccess(res.created);
      }

      router.refresh();
      onClose();
    });
  }

  const validCount = cards.filter(
    (c) => c.name.trim().length > 0 && Boolean(c.location_id)
  ).length;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="card flex flex-col w-full max-w-4xl max-h-[92vh] bg-sand-50 shadow-lg shadow-ink-900/5 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-ink-100 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100 shadow-2xs">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-ink-900">
                    Bulk Create Sightseeing Activities
                  </h2>
                  <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                    Batch Mode
                  </span>
                </div>
                <p className="text-xs text-ink-500">
                  Quickly add multiple sightseeing activities with location, categories, and preferred types at once.
                </p>
              </div>
            </div>
  
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 border border-brand-200">
                {cards.length} {cards.length === 1 ? 'card' : 'cards'} in queue
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {formError && (
              <div className="flex items-center gap-2.5 rounded-xl border border-coral-200 bg-coral-50 p-3 text-xs text-coral-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-coral-600" />
                <span className="font-medium">{formError}</span>
              </div>
            )}
  
            {/* Cards List */}
            <div className="space-y-4">
              {cards.map((card, index) => {
                const selectedLocation = locations.find(
                  (l) => String(l.id) === String(card.location_id)
                );
  
                return (
                  <div
                    key={card.id}
                    className="card space-y-4 p-5 bg-white border border-ink-150 rounded-xl shadow-2xs relative transition-all"
                  >
                    {/* Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 border border-brand-200">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-ink-900">
                            {card.name.trim() ? card.name : `Activity #${index + 1}`}
                          </h3>
                          {selectedLocation && (
                            <div className="flex items-center gap-1 text-[11px] text-ink-500">
                              <MapPin className="h-3 w-3 text-brand-500" />
                              <span>
                                {selectedLocation.display_name || selectedLocation.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
  
                      <div className="flex items-center gap-2">
                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={() => duplicateCard(index)}
                          title="Duplicate this activity card"
                          className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 hover:bg-brand-50 hover:text-brand-700 transition cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                          <span className="hidden sm:inline">Duplicate</span>
                        </button>
  
                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeCard(index)}
                          title="Remove activity card"
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
  
                    {/* Card Form Fields - Exact fields from ActivityFormModal */}
                    {!card.isCollapsed && (
                      <div className="space-y-3.5">
                        {/* Location & Place Activities */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label">Location *</label>
                            <select
                              className="input"
                              value={card.location_id}
                              onChange={(e) =>
                                updateCard(index, 'location_id', e.target.value)
                              }
                              required
                            >
                              <option value="">Select location</option>
                              {locations.map((l) => (
                                <option key={l.id} value={String(l.id)}>
                                  {l.display_name || l.name}
                                </option>
                              ))}
                            </select>
                          </div>
  
                          <div>
                            <label className="label">Place Activities *</label>
                            <input
                              type="text"
                              className="input"
                              value={card.name}
                              onChange={(e) => updateCard(index, 'name', e.target.value)}
                              placeholder="e.g. Tea Museum, Mattupetty Dam, Speed Boating"
                              required
                            />
                          </div>
                        </div>
  
                        {/* Categories & Preferred Types */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label">Categories *</label>
                            <select
                              className="input"
                              value={card.category}
                              onChange={(e) =>
                                updateCard(index, 'category', e.target.value)
                              }
                              required
                            >
                              {CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
  
                          <div>
                            <label className="label">Preferred Types</label>
                            <input
                              type="text"
                              className="input"
                              value={card.preferred_types}
                              onChange={(e) =>
                                updateCard(index, 'preferred_types', e.target.value)
                              }
                              placeholder="e.g. Adult, Children, Family, All"
                            />
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {PREFERRED_TYPE_OPTIONS.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() =>
                                    updateCard(index, 'preferred_types', opt)
                                  }
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                                    card.preferred_types === opt
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-sand-100 text-ink-600 hover:bg-sand-200'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
  
                        {/* Description */}
                        <div>
                          <label className="label">Description (Optional)</label>
                          <textarea
                            className="input"
                            rows={2}
                            value={card.description}
                            onChange={(e) =>
                              updateCard(index, 'description', e.target.value)
                            }
                            placeholder="Shown on itinerary quotations..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
  
            {/* Bottom Card Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-ink-150">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addCard}
                  className="btn-outline inline-flex items-center gap-1.5 text-xs bg-white hover:bg-sand-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-brand-600" />
                  <span>Add Another Activity</span>
                </button>
  
                <button
                  type="button"
                  onClick={() => addMultipleCards(3)}
                  className="btn-outline inline-flex items-center gap-1.5 text-xs bg-white hover:bg-sand-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-ink-500" />
                  <span>+3 Activities</span>
                </button>
              </div>
  
              <button
                type="button"
                onClick={clearEmptyCards}
                className="text-xs text-ink-500 hover:text-coral-600 inline-flex items-center gap-1 transition cursor-pointer"
                title="Remove cards with empty place activity name"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear empty cards</span>
              </button>
            </div>
          </div>
  
          {/* Modal Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-white px-5 py-3.5">
            <div className="text-xs text-ink-500">
              <span className="font-semibold text-ink-700">{validCount}</span>{' '}
              {validCount === 1 ? 'activity' : 'activities'} ready to save
            </div>
  
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="btn-outline text-xs px-3.5 py-1.5"
              >
                Cancel
              </button>
  
              <button
                type="button"
                onClick={handleBulkSave}
                disabled={isPending || validCount === 0}
                className="btn-primary inline-flex items-center gap-1.5 text-xs px-4 py-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Activities…</span>
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
      </div>
    </ModalPortal>
  );
}

export function BulkCreateActivitiesButton({
  locations,
  onSuccess,
  className = '',
}: {
  locations: LocationOption[];
  onSuccess?: (created: CreatedActivityItem[]) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`btn-outline inline-flex items-center gap-1.5 text-xs bg-white shadow-2xs hover:shadow-xs transition cursor-pointer ${className}`}
        title="Quickly add multiple sightseeing activities at once"
      >
        <Layers className="h-4 w-4 text-brand-600" />
        <span>Bulk create</span>
      </button>

      <BulkCreateActivitiesModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        locations={locations}
        onSuccess={onSuccess}
      />
    </>
  );
}
