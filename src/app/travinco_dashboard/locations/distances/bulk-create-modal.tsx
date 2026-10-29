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
  Route,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { bulkCreateDistances, type CreatedDistanceItem } from './actions';
import { ModalPortal } from '@/components/ui/modal-portal';

export interface LocationOption {
  id: number | string;
  name: string;
  display_name?: string | null;
}

export type BulkDistanceCard = {
  id: string;
  from_location_id: string;
  to_location_id: string;
  distance_km: string;
  duration_text: string;
  notes: string;
  isCollapsed: boolean;
};

function createEmptyDistanceCard(fromId = '', toId = ''): BulkDistanceCard {
  return {
    id: Math.random().toString(36).substring(2, 9),
    from_location_id: fromId,
    to_location_id: toId,
    distance_km: '',
    duration_text: '',
    notes: '',
    isCollapsed: false,
  };
}

interface BulkCreateDistancesModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: LocationOption[];
  onSuccess?: (created: CreatedDistanceItem[]) => void;
}

export function BulkCreateDistancesModal({
  isOpen,
  onClose,
  locations,
  onSuccess,
}: BulkCreateDistancesModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [cards, setCards] = useState<BulkDistanceCard[]>([
    createEmptyDistanceCard(
      locations[0] ? String(locations[0].id) : '',
      locations[1] ? String(locations[1].id) : ''
    ),
    createEmptyDistanceCard(
      locations[1] ? String(locations[1].id) : '',
      locations[2] ? String(locations[2].id) : ''
    ),
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  function updateCard<K extends keyof BulkDistanceCard>(
    index: number,
    field: K,
    value: BulkDistanceCard[K]
  ) {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function addCard() {
    // Daisy chain: next card 'from' defaults to last card's 'to'
    const lastCard = cards[cards.length - 1];
    const nextFrom = lastCard?.to_location_id || '';
    setCards((prev) => [...prev, createEmptyDistanceCard(nextFrom, '')]);
  }

  function addMultipleCards(count: number) {
    const lastCard = cards[cards.length - 1];
    let nextFrom = lastCard?.to_location_id || '';
    const newCards: BulkDistanceCard[] = [];

    for (let i = 0; i < count; i++) {
      newCards.push(createEmptyDistanceCard(nextFrom, ''));
      nextFrom = '';
    }

    setCards((prev) => [...prev, ...newCards]);
  }

  function duplicateCard(index: number) {
    setCards((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const clone: BulkDistanceCard = {
        ...source,
        id: Math.random().toString(36).substring(2, 9),
      };
      const copy = [...prev];
      copy.splice(index + 1, 0, clone);
      return copy;
    });
  }

  function swapLocations(index: number) {
    setCards((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        return {
          ...c,
          from_location_id: c.to_location_id,
          to_location_id: c.from_location_id,
        };
      })
    );
  }

  function removeCard(index: number) {
    if (cards.length <= 1) {
      setCards([createEmptyDistanceCard()]);
      return;
    }
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  function clearEmptyCards() {
    const valid = cards.filter(
      (c) =>
        Boolean(c.from_location_id) &&
        Boolean(c.to_location_id) &&
        Number(c.distance_km) > 0
    );
    setCards(valid.length > 0 ? valid : [createEmptyDistanceCard()]);
  }

  function handleBulkSave() {
    setFormError(null);

    // Filter cards with filled inputs
    const activeCards = cards.filter(
      (c) => Boolean(c.from_location_id) || Boolean(c.to_location_id) || Boolean(c.distance_km)
    );

    if (activeCards.length === 0) {
      setFormError('Please fill in at least one distance route to save.');
      return;
    }

    // Validate each active card
    for (let i = 0; i < activeCards.length; i++) {
      const c = activeCards[i];
      if (!c) continue;
      if (!c.from_location_id || !c.to_location_id) {
        setFormError(`Route #${i + 1} requires both "From" and "To" locations.`);
        return;
      }
      if (c.from_location_id === c.to_location_id) {
        setFormError(
          `Route #${i + 1}: "From" and "To" cannot be the same location.`
        );
        return;
      }
      if (!c.distance_km || isNaN(Number(c.distance_km)) || Number(c.distance_km) <= 0) {
        setFormError(`Route #${i + 1} requires a valid distance in km (greater than 0).`);
        return;
      }
    }

    startTransition(async () => {
      const payload = activeCards.map((c) => ({
        from_location_id: Number(c.from_location_id),
        to_location_id: Number(c.to_location_id),
        distance_km: Number(c.distance_km),
        duration_text: c.duration_text.trim() || null,
        notes: c.notes.trim() || null,
      }));

      const res = await bulkCreateDistances(payload);

      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
        return;
      }

      toast.success(
        `Successfully saved ${res.count ?? payload.length} route ${
          (res.count ?? payload.length) === 1 ? 'distance' : 'distances'
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
    (c) =>
      Boolean(c.from_location_id) &&
      Boolean(c.to_location_id) &&
      c.from_location_id !== c.to_location_id &&
      Number(c.distance_km) > 0
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
                    Bulk Create Distances
                  </h2>
                  <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                    Batch Mode
                  </span>
                </div>
                <p className="text-xs text-ink-500">
                  Quickly save inter-destination distance kilometres and drive times in bulk.
                </p>
              </div>
            </div>
  
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 border border-brand-200">
                {cards.length} {cards.length === 1 ? 'route' : 'routes'} in queue
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
                const fromLoc = locations.find((l) => String(l.id) === card.from_location_id);
                const toLoc = locations.find((l) => String(l.id) === card.to_location_id);
                const routeTitle =
                  fromLoc && toLoc
                    ? `${fromLoc.display_name || fromLoc.name} ↔ ${toLoc.display_name || toLoc.name}`
                    : `Route #${index + 1}`;
  
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
                          <h3 className="text-sm font-bold text-ink-900 flex items-center gap-1.5">
                            <Route className="h-4 w-4 text-brand-600" />
                            <span>{routeTitle}</span>
                          </h3>
                          {card.distance_km && (
                            <span className="text-[11px] text-ink-500 font-medium">
                              {card.distance_km} km {card.duration_text ? `• ${card.duration_text}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
  
                      <div className="flex items-center gap-2">
                        {/* Swap button */}
                        <button
                          type="button"
                          onClick={() => swapLocations(index)}
                          title="Swap From and To locations"
                          className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 hover:bg-sand-100 transition cursor-pointer"
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                          <span className="hidden sm:inline">Swap</span>
                        </button>
  
                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={() => duplicateCard(index)}
                          title="Duplicate route card"
                          className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 hover:bg-brand-50 hover:text-brand-700 transition cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                          <span className="hidden sm:inline">Duplicate</span>
                        </button>
  
                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeCard(index)}
                          title="Remove route card"
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
  
                    {/* Form fields */}
                    {!card.isCollapsed && (
                      <div className="space-y-3.5">
                        {/* From & To Location */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label">From Location *</label>
                            <select
                              className="input"
                              value={card.from_location_id}
                              onChange={(e) =>
                                updateCard(index, 'from_location_id', e.target.value)
                              }
                              required
                            >
                              <option value="">Select origin</option>
                              {locations.map((l) => (
                                <option key={l.id} value={String(l.id)}>
                                  {l.display_name || l.name}
                                </option>
                              ))}
                            </select>
                          </div>
  
                          <div>
                            <label className="label">To Location *</label>
                            <select
                              className="input"
                              value={card.to_location_id}
                              onChange={(e) =>
                                updateCard(index, 'to_location_id', e.target.value)
                              }
                              required
                            >
                              <option value="">Select destination</option>
                              {locations.map((l) => (
                                <option key={l.id} value={String(l.id)}>
                                  {l.display_name || l.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
  
                        {/* Distance (km) & Drive time */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label">Distance (km) *</label>
                            <input
                              type="number"
                              className="input"
                              value={card.distance_km}
                              onChange={(e) =>
                                updateCard(index, 'distance_km', e.target.value)
                              }
                              placeholder="e.g. 130"
                              min="0.1"
                              step="0.1"
                              required
                            />
                          </div>
  
                          <div>
                            <label className="label">Drive time</label>
                            <input
                              type="text"
                              className="input"
                              value={card.duration_text}
                              onChange={(e) =>
                                updateCard(index, 'duration_text', e.target.value)
                              }
                              placeholder="e.g. 3.5–4 hrs"
                            />
                          </div>
                        </div>
  
                        {/* Notes */}
                        <div>
                          <label className="label">Notes (Optional)</label>
                          <textarea
                            className="input"
                            rows={2}
                            value={card.notes}
                            onChange={(e) =>
                              updateCard(index, 'notes', e.target.value)
                            }
                            placeholder="Route, ghat roads, bypasses…"
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
                  <span>Add Another Route</span>
                </button>
  
                <button
                  type="button"
                  onClick={() => addMultipleCards(3)}
                  className="btn-outline inline-flex items-center gap-1.5 text-xs bg-white hover:bg-sand-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-ink-500" />
                  <span>+3 Routes</span>
                </button>
              </div>
  
              <button
                type="button"
                onClick={clearEmptyCards}
                className="text-xs text-ink-500 hover:text-coral-600 inline-flex items-center gap-1 transition cursor-pointer"
                title="Remove cards with missing locations or distance"
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
              {validCount === 1 ? 'route' : 'routes'} ready to save
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
                    <span>Saving Distances…</span>
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

export function BulkCreateDistancesButton({
  locations,
  onSuccess,
  className = '',
}: {
  locations: LocationOption[];
  onSuccess?: (created: CreatedDistanceItem[]) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`btn-outline inline-flex items-center gap-1.5 text-xs bg-white shadow-2xs hover:shadow-xs transition cursor-pointer ${className}`}
        title="Quickly add multiple inter-location distances at once"
      >
        <Layers className="h-4 w-4 text-brand-600" />
        <span>Bulk create</span>
      </button>

      <BulkCreateDistancesModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        locations={locations}
        onSuccess={onSuccess}
      />
    </>
  );
}
