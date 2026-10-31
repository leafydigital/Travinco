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
import { bulkCreateLocations, type CreatedLocationItem } from './actions';
import { ModalPortal } from '@/components/ui/modal-portal';

export interface ParentLocationOption {
  id: number | string;
  name: string;
  display_name?: string | null;
}

export type BulkLocationCard = {
  id: string;
  name: string;
  display_name: string;
  state: string;
  parent_id: string;
  description: string;
  sort_order: number;
  is_houseboat: boolean;
  isCollapsed: boolean;
};

function createEmptyLocationCard(defaultState = 'Kerala', sortOrder = 100): BulkLocationCard {
  return {
    id: Math.random().toString(36).substring(2, 9),
    name: '',
    display_name: '',
    state: defaultState,
    parent_id: '',
    description: '',
    sort_order: sortOrder,
    is_houseboat: false,
    isCollapsed: false,
  };
}

interface BulkCreateLocationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentLocations: ParentLocationOption[];
  states?: string[];
  onSuccess?: (created: CreatedLocationItem[]) => void;
}

export function BulkCreateLocationsModal({
  isOpen,
  onClose,
  parentLocations,
  states = [],
  onSuccess,
}: BulkCreateLocationsModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultState = states.length > 0 ? states[0]! : 'Kerala';
  const stateOptions = states.length > 0 ? states : [defaultState];

  const [cards, setCards] = useState<BulkLocationCard[]>([
    createEmptyLocationCard(defaultState, 100),
    createEmptyLocationCard(defaultState, 110),
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  function updateCard<K extends keyof BulkLocationCard>(
    index: number,
    field: K,
    value: BulkLocationCard[K]
  ) {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function addCard() {
    const lastCard = cards[cards.length - 1];
    const lastSort = lastCard?.sort_order ?? 100;
    const cardState = lastCard?.state || defaultState;
    setCards((prev) => [...prev, createEmptyLocationCard(cardState, lastSort + 10)]);
  }

  function addMultipleCards(count: number) {
    const lastCard = cards[cards.length - 1];
    const lastSort = lastCard?.sort_order ?? 100;
    const cardState = lastCard?.state || defaultState;
    setCards((prev) => [
      ...prev,
      ...Array.from({ length: count }, (_, idx) =>
        createEmptyLocationCard(cardState, lastSort + (idx + 1) * 10)
      ),
    ]);
  }

  function duplicateCard(index: number) {
    setCards((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const clone: BulkLocationCard = {
        ...source,
        id: Math.random().toString(36).substring(2, 9),
        name: source.name.trim() ? `${source.name.trim()} (Copy)` : '',
        display_name: source.display_name.trim()
          ? `${source.display_name.trim()} (Copy)`
          : '',
        sort_order: source.sort_order + 5,
      };
      const copy = [...prev];
      copy.splice(index + 1, 0, clone);
      return copy;
    });
  }

  function removeCard(index: number) {
    if (cards.length <= 1) {
      setCards([createEmptyLocationCard(defaultState, 100)]);
      return;
    }
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  function clearEmptyCards() {
    const valid = cards.filter((c) => c.name.trim().length > 0);
    setCards(valid.length > 0 ? valid : [createEmptyLocationCard(defaultState, 100)]);
  }

  function handleBulkSave() {
    setFormError(null);

    // Cards with any details are saved; completely empty cards are ignored.
    const activeCards = cards.filter((c) => [c.name, c.display_name, c.description].some((v) => v.trim()));

    if (activeCards.length === 0) {
      setFormError('Please enter at least one location name to save.');
      return;
    }
    const unnamed = activeCards.find((c) => !c.name.trim());
    if (unnamed) {
      const message = `Location card ${activeCards.indexOf(unnamed) + 1}: name is required.`;
      setFormError(message);
      toast.error(message);
      setCards((prev) => prev.map((card) => (card.id === unnamed.id ? { ...card, isCollapsed: false } : card)));
      return;
    }

    startTransition(async () => {
      const payload = activeCards.map((c) => ({
        name: c.name.trim(),
        display_name: c.display_name.trim() || null,
        state: c.state.trim() || 'Kerala',
        parent_id: c.parent_id ? Number(c.parent_id) : null,
        description: c.description.trim() || null,
        is_houseboat: c.is_houseboat,
        sort_order: Number(c.sort_order) || 100,
      }));

      const res = await bulkCreateLocations(payload);

      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
        return;
      }

      toast.success(
        `Successfully created ${res.count ?? payload.length} ${
          (res.count ?? payload.length) === 1 ? 'location' : 'locations'
        }`
      );

      if (onSuccess && res.created) {
        onSuccess(res.created);
      }

      router.refresh();
      onClose();
    });
  }

  const validCount = cards.filter((c) => c.name.trim().length > 0).length;

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
                    Bulk Create Locations
                  </h2>
                  <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                    Batch Mode
                  </span>
                </div>
                <p className="text-xs text-ink-500">
                  Quickly add multiple destination locations, display names, and main town associations at once.
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
                const selectedParent = parentLocations.find(
                  (p) => String(p.id) === String(card.parent_id)
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
                            {card.name.trim() ? card.name : `Location #${index + 1}`}
                          </h3>
                          {card.display_name.trim() && (
                            <div className="flex items-center gap-1 text-[11px] text-ink-500">
                              <MapPin className="h-3 w-3 text-brand-500" />
                              <span>Shown as: {card.display_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
  
                      <div className="flex items-center gap-2">
                        {card.is_houseboat && (
                          <span className="rounded-full bg-ocean-50 text-ocean-700 border border-ocean-200 px-2 py-0.5 text-[11px] font-medium">
                            Houseboat
                          </span>
                        )}
  
                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={() => duplicateCard(index)}
                          title="Duplicate this location card"
                          className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 hover:bg-brand-50 hover:text-brand-700 transition cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                          <span className="hidden sm:inline">Duplicate</span>
                        </button>
  
                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeCard(index)}
                          title="Remove location card"
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
                        {/* Name & Display Name */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label">Location Name *</label>
                            <input
                              type="text"
                              className="input"
                              value={card.name}
                              onChange={(e) => updateCard(index, 'name', e.target.value)}
                              placeholder="e.g. Munnar, Thekkady, Cochin"
                              required
                            />
                            <p className="mt-1 text-[11px] text-ink-400">
                              Must match the Location column of the Rate Master sheet.
                            </p>
                          </div>
  
                          <div>
                            <label className="label">Name shown on quotations</label>
                            <input
                              type="text"
                              className="input"
                              value={card.display_name}
                              onChange={(e) =>
                                updateCard(index, 'display_name', e.target.value)
                              }
                              placeholder="Leave blank to use the name"
                            />
                            <p className="mt-1 text-[11px] text-ink-400">
                              Custom title displayed on customer quotes.
                            </p>
                          </div>
                        </div>
  
                        {/* State & Part of (Main town) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label">State</label>
                            <select
                              className="input"
                              value={card.state}
                              onChange={(e) => updateCard(index, 'state', e.target.value)}
                            >
                              {(card.state && !stateOptions.includes(card.state)
                                ? [card.state, ...stateOptions]
                                : stateOptions
                              ).map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
  
                          <div>
                            <label className="label">Part of (main town)</label>
                            <select
                              className="input"
                              value={card.parent_id}
                              onChange={(e) =>
                                updateCard(index, 'parent_id', e.target.value)
                              }
                            >
                              <option value="">None (Independent location)</option>
                              {parentLocations.map((p) => (
                                <option key={p.id} value={String(p.id)}>
                                  {p.display_name || p.name}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-[11px] text-ink-400">
                              e.g. Fort Kochi → Cochin. Hotels there are offered for Cochin stays.
                            </p>
                          </div>
                        </div>
  
                        {/* Description */}
                        <div>
                          <label className="label">Description</label>
                          <textarea
                            className="input"
                            rows={2}
                            value={card.description}
                            onChange={(e) =>
                              updateCard(index, 'description', e.target.value)
                            }
                            placeholder="Optional notes or destination overview..."
                          />
                        </div>
  
                        {/* Sort order & Houseboat */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                          <div>
                            <label className="label">Sort order</label>
                            <input
                              type="number"
                              className="input"
                              value={card.sort_order}
                              onChange={(e) =>
                                updateCard(index, 'sort_order', Number(e.target.value))
                              }
                              step="1"
                            />
                          </div>
  
                          <div className="flex items-center gap-2 pt-5">
                            <input
                              type="checkbox"
                              id={`houseboat_cb_${card.id}`}
                              className="checkbox"
                              checked={card.is_houseboat}
                              onChange={(e) =>
                                updateCard(index, 'is_houseboat', e.target.checked)
                              }
                            />
                            <label
                              htmlFor={`houseboat_cb_${card.id}`}
                              className="text-sm font-medium text-ink-700 cursor-pointer select-none"
                            >
                              Houseboat location (priced per boat, all meals)
                            </label>
                          </div>
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
                  <span>Add Another Location</span>
                </button>
  
                <button
                  type="button"
                  onClick={() => addMultipleCards(3)}
                  className="btn-outline inline-flex items-center gap-1.5 text-xs bg-white hover:bg-sand-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-ink-500" />
                  <span>+3 Locations</span>
                </button>
              </div>
  
              <button
                type="button"
                onClick={clearEmptyCards}
                className="text-xs text-ink-500 hover:text-coral-600 inline-flex items-center gap-1 transition cursor-pointer"
                title="Remove cards with empty location name"
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
              {validCount === 1 ? 'location' : 'locations'} ready to save
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
                    <span>Saving Locations…</span>
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

export function BulkCreateLocationsButton({
  parentLocations,
  states = [],
  onSuccess,
  className = '',
}: {
  parentLocations: ParentLocationOption[];
  states?: string[];
  onSuccess?: (created: CreatedLocationItem[]) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`btn-outline inline-flex items-center gap-1.5 text-xs bg-white shadow-2xs hover:shadow-xs transition cursor-pointer ${className}`}
        title="Quickly add multiple destination locations at once"
      >
        <Layers className="h-4 w-4 text-brand-600" />
        <span>Bulk create</span>
      </button>

      <BulkCreateLocationsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        parentLocations={parentLocations}
        states={states}
        onSuccess={onSuccess}
      />
    </>
  );
}
