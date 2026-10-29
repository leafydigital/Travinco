'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { saveDistance } from '@/lib/tour/master-actions';
import { getDistanceById, type FullDistance } from './actions';
import { ComboInput } from '@/components/ui/combo-input';
import { findLocationByLabel, locationLabel } from '@/lib/tour/location-label';
import { ModalPortal } from '@/components/ui/modal-portal';

interface DistanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  distanceId: number | null; // null = Add, number = Edit
  locations: Array<{ id: number; name: string; display_name?: string | null }>;
}

export function DistanceModal({
  isOpen,
  onClose,
  onSuccess,
  distanceId,
  locations,
}: DistanceModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [distance, setDistance] = useState<Partial<FullDistance> | null>(null);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const loadedIdRef = useRef<number | null>(null);

  const labelFor = (id: number | undefined) => {
    const l = locations.find((x) => x.id === id);
    return l ? locationLabel(l) : '';
  };
  const locationOptions = locations.map(locationLabel);

  useEffect(() => {
    if (!isOpen) {
      setDistance(null);
      setIsLoading(false);
      loadedIdRef.current = null;
      return;
    }

    if (distanceId) {
      if (loadedIdRef.current === distanceId) {
        return;
      }

      loadedIdRef.current = distanceId;
      setIsLoading(true);
      let cancelled = false;

      getDistanceById(distanceId)
        .then((res) => {
          if (cancelled) return;
          if (res.error || !res.distance) {
            toast.error(res.error || 'Failed to load distance details');
            onCloseRef.current?.();
          } else {
            setDistance(res.distance);
            setFromText(labelFor(res.distance.from_location_id));
            setToText(labelFor(res.distance.to_location_id));
          }
        })
        .catch(() => {
          if (cancelled) return;
          toast.error('Failed to load distance details');
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
      setDistance({
        from_location_id: locations[0]?.id ?? 0,
        to_location_id: locations[1]?.id ?? 0,
        distance_km: 0,
        duration_text: '',
        notes: '',
      });
      setFromText(labelFor(locations[0]?.id));
      setToText(labelFor(locations[1]?.id));
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFor only reads `locations`
  }, [isOpen, distanceId, locations]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const from = findLocationByLabel(locations, fromText);
    const to = findLocationByLabel(locations, toText);
    if (!from || !to) {
      toast.error(`Choose ${!from ? 'a From' : 'a To'} location from the list`);
      return;
    }
    const fromId = from.id;
    const toId = to.id;

    if (fromId === toId) {
      toast.error('From and To locations must be different');
      return;
    }

    const data: Record<string, unknown> = {
      from_location_id: fromId,
      to_location_id: toId,
      distance_km: Number(formData.get('distance_km') || 0),
      duration_text: formData.get('duration_text') || null,
      notes: formData.get('notes') || null,
    };

    startTransition(async () => {
      const res = await saveDistance(distanceId, data);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(distanceId ? 'Distance updated successfully' : 'Distance added successfully');
      onSuccess();
      onClose();
    });
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
        <div
          className="w-full max-w-xl max-h-[calc(100vh-2rem)] flex flex-col rounded-xl bg-white shadow-lg shadow-ink-900/5 ring-1 ring-ink-900/10 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-3 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                {distanceId ? 'Edit Distance Route' : 'Add Distance Route'}
              </h2>
              <p className="text-xs text-ink-500">
                One entry per pair works both ways in quotations
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
              <p className="text-sm text-ink-500 font-medium">Fetching distance details…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                {/* Row 1: From & To */}
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="from_location_id">
                    From Location <span className="text-coral-600">*</span>
                  </label>
                  <ComboInput
                    id="from_location_id"
                    required
                    value={fromText}
                    onChange={setFromText}
                    options={locationOptions}
                    placeholder="Type or select origin"
                    emptyText="No matching location"
                    className="h-9 py-1.5 text-sm"
                  />
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="to_location_id">
                    To Location <span className="text-coral-600">*</span>
                  </label>
                  <ComboInput
                    id="to_location_id"
                    required
                    value={toText}
                    onChange={setToText}
                    options={locationOptions}
                    placeholder="Type or select destination"
                    emptyText="No matching location"
                    className="h-9 py-1.5 text-sm"
                  />
                </div>
  
                {/* Row 2: Distance & Duration */}
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="distance_km">
                    Distance (km) <span className="text-coral-600">*</span>
                  </label>
                  <input
                    id="distance_km"
                    name="distance_km"
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    defaultValue={distance?.distance_km ?? 0}
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="duration_text">
                    Drive Time
                  </label>
                  <input
                    id="duration_text"
                    name="duration_text"
                    defaultValue={distance?.duration_text ?? ''}
                    placeholder="e.g. 3.5–4 hrs"
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                {/* Row 3: Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="notes">
                    Notes &amp; Route Information
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    defaultValue={distance?.notes ?? ''}
                    placeholder="Route details, ghat roads, toll gates…"
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
                  {distanceId ? 'Save Changes' : 'Add Distance'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
