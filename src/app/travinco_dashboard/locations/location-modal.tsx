'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { saveLocation } from '@/lib/tour/master-actions';
import { getLocationById, type FullLocation, type ParentLocationOption } from './actions';
import { ComboInput } from '@/components/ui/combo-input';
import { findLocationByLabel, locationLabel } from '@/lib/tour/location-label';
import { ModalPortal } from '@/components/ui/modal-portal';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  locationId: number | null; // null = Add, number = Edit
  parentLocations: ParentLocationOption[];
  states: string[];
}

export function LocationModal({
  isOpen,
  onClose,
  onSuccess,
  locationId,
  parentLocations,
  states,
}: LocationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [location, setLocation] = useState<Partial<FullLocation> | null>(null);
  const [parentText, setParentText] = useState('');

  // Keep fresh ref to onClose to avoid re-triggering effect on parent re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Track the location ID that has already been loaded to prevent duplicate fetches on field clicks
  const loadedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setLocation(null);
      setIsLoading(false);
      loadedIdRef.current = null;
      return;
    }

    if (locationId) {
      if (loadedIdRef.current === locationId) {
        return;
      }

      loadedIdRef.current = locationId;
      setIsLoading(true);
      let cancelled = false;

      getLocationById(locationId)
        .then((res) => {
          if (cancelled) return;
          if (res.error || !res.location) {
            toast.error(res.error || 'Failed to load location details');
            onCloseRef.current?.();
          } else {
            setLocation(res.location);
            const parent = parentLocations.find((p) => p.id === res.location?.parent_id);
            setParentText(parent ? locationLabel(parent) : '');
          }
        })
        .catch(() => {
          if (cancelled) return;
          toast.error('Failed to load location details');
          onCloseRef.current?.();
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    } else {
      if (loadedIdRef.current === -1) {
        return;
      }
      loadedIdRef.current = -1;
      setLocation({
        name: '',
        display_name: '',
        state: states[0] || 'Kerala',
        parent_id: null,
        description: '',
        sort_order: 100,
        is_houseboat: false,
        is_active: true,
      });
      setParentText('');
      setIsLoading(false);
    }
  }, [isOpen, locationId, states, parentLocations]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const parent = findLocationByLabel(selectableParents, parentText);
    if (parentText.trim() && !parent) {
      toast.error('Choose a main town from the list, or leave it blank for a standalone location.');
      return;
    }

    const data: Record<string, unknown> = {
      name: formData.get('name'),
      display_name: formData.get('display_name') || null,
      state: formData.get('state') || 'Kerala',
      parent_id: parent ? parent.id : null,
      description: formData.get('description') || null,
      sort_order: Number(formData.get('sort_order') || 100),
      is_houseboat: formData.get('is_houseboat') === 'on',
      is_active: formData.get('is_active') === 'on',
    };

    startTransition(async () => {
      const res = await saveLocation(locationId, data);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(locationId ? 'Location updated successfully' : 'Location added successfully');
      onSuccess();
      onClose();
    });
  }

  // Filter out self from parent options to avoid circular parentage
  const selectableParents = parentLocations.filter((p) => p.id !== locationId);

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
        <div
          className="w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col rounded-xl bg-white shadow-lg shadow-ink-900/5 ring-1 ring-ink-900/10 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-3 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                {locationId ? 'Edit Location' : 'Add Location'}
              </h2>
              <p className="text-xs text-ink-500">
                {locationId ? 'Update location details and parent association' : 'Create a new destination town or houseboat hub'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
  
          {/* Content */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              <p className="text-sm text-ink-500 font-medium">Fetching location details…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                {/* Row 1: Names */}
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="name">
                    Name (Rate Master) <span className="text-coral-600">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    defaultValue={location?.name ?? ''}
                    placeholder="e.g. Munnar"
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="display_name">
                    Display Name (Quotations)
                  </label>
                  <input
                    id="display_name"
                    name="display_name"
                    defaultValue={location?.display_name ?? ''}
                    placeholder="Leave blank to use name"
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                {/* Row 2: State & Parent */}
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="state">
                    State <span className="text-coral-600">*</span>
                  </label>
                  <input
                    id="state"
                    name="state"
                    list="location-states-list"
                    required
                    defaultValue={location?.state ?? (states[0] || 'Kerala')}
                    placeholder="e.g. Kerala"
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                  <datalist id="location-states-list">
                    {states.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="parent_id">
                    Part of (Main Town)
                  </label>
                  <ComboInput
                    id="parent_id"
                    value={parentText}
                    onChange={setParentText}
                    options={selectableParents.map(locationLabel)}
                    placeholder="Type or select (blank = standalone)"
                    emptyText="No matching main town"
                    className="h-9 py-1.5 text-sm"
                  />
                </div>
  
                {/* Row 3: Sort Order & Flags */}
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="sort_order">
                    Sort Order
                  </label>
                  <input
                    id="sort_order"
                    name="sort_order"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={location?.sort_order ?? 100}
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                <div className="flex flex-col justify-end gap-1.5 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-800 select-none">
                    <input
                      type="checkbox"
                      name="is_houseboat"
                      defaultChecked={location?.is_houseboat ?? false}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    />
                    Houseboat Location (all meals, priced per boat)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-800 select-none">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={location?.is_active ?? true}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    />
                    Active (Offered in Quotes)
                  </label>
                </div>
  
                {/* Row 4: Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="description">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={2}
                    defaultValue={location?.description ?? ''}
                    placeholder="Overview, highlights, travel tips…"
                    className="input w-full text-xs py-1.5 resize-none"
                  />
                </div>
              </div>
  
              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-100 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="btn-outline py-2 px-4 text-xs sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary py-2 px-4 text-xs sm:text-sm"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  {locationId ? 'Save Changes' : 'Add Location'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
