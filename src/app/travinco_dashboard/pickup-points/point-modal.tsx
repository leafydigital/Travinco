'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { savePickupPoint } from '@/lib/tour/master-actions';
import { getPickupPointById, type FullPickupPoint, type LocationOption } from './actions';

interface PointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pointId: number | null; // null = Add, number = Edit
  locations: LocationOption[];
}

const POINT_TYPES = [
  { value: 'airport', label: 'Airport' },
  { value: 'railway', label: 'Railway station' },
  { value: 'bus', label: 'Bus stand' },
  { value: 'hotel', label: 'Hotel / residence' },
  { value: 'port', label: 'Port / jetty' },
  { value: 'other', label: 'Other' },
];

export function PointModal({
  isOpen,
  onClose,
  onSuccess,
  pointId,
  locations,
}: PointModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [point, setPoint] = useState<Partial<FullPickupPoint> | null>(null);

  // Keep fresh ref to onClose to avoid re-triggering effect on parent re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Track the point ID that has already been loaded to prevent duplicate fetches on field clicks
  const loadedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPoint(null);
      setIsLoading(false);
      loadedIdRef.current = null;
      return;
    }

    if (pointId) {
      // If we have already loaded this point, do NOT re-fetch!
      if (loadedIdRef.current === pointId) {
        return;
      }

      loadedIdRef.current = pointId;
      setIsLoading(true);
      let cancelled = false;

      getPickupPointById(pointId)
        .then((res) => {
          if (cancelled) return;
          if (res.error || !res.point) {
            toast.error(res.error || 'Failed to load point details');
            onCloseRef.current?.();
          } else {
            setPoint(res.point);
          }
        })
        .catch(() => {
          if (cancelled) return;
          toast.error('Failed to load point details');
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
      // Add mode: initialize default state once
      if (loadedIdRef.current === -1) {
        return;
      }
      loadedIdRef.current = -1;
      setPoint({
        name: '',
        code: '',
        point_type: 'airport',
        location_id: locations[0]?.id ?? null,
        km_from_location: 0,
        address: '',
        google_maps_url: '',
        contact_phone: '',
        use_for_pickup: true,
        use_for_drop: true,
        notes: '',
        sort_order: 100,
        is_active: true,
      });
      setIsLoading(false);
    }
  }, [isOpen, pointId, locations]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const locIdRaw = formData.get('location_id');

    const data: Record<string, unknown> = {
      name: formData.get('name'),
      code: formData.get('code') || null,
      point_type: formData.get('point_type'),
      location_id: locIdRaw ? Number(locIdRaw) : null,
      km_from_location: Number(formData.get('km_from_location') || 0),
      address: formData.get('address') || null,
      google_maps_url: formData.get('google_maps_url') || null,
      contact_phone: formData.get('contact_phone') || null,
      sort_order: Number(formData.get('sort_order') || 100),
      use_for_pickup: formData.get('use_for_pickup') === 'on',
      use_for_drop: formData.get('use_for_drop') === 'on',
      notes: formData.get('notes') || null,
      is_active: formData.get('is_active') === 'on',
    };

    startTransition(async () => {
      const res = await savePickupPoint(pointId, data);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(pointId ? 'Point updated successfully' : 'Point added successfully');
      onSuccess();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl max-h-[calc(100vh-2rem)] flex flex-col rounded-xl bg-white shadow-2xl ring-1 ring-ink-900/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-3 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              {pointId ? 'Edit Pickup / Drop Point' : 'Add Pickup / Drop Point'}
            </h2>
            <p className="text-xs text-ink-500">
              {pointId ? 'Update point coordinates, type and town link' : 'Register a new airport, station or pickup hub'}
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
            <p className="text-sm text-ink-500 font-medium">Fetching point details…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2.5">
              {/* Row 1: Core Identification */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="name">
                  Point Name <span className="text-coral-600">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  defaultValue={point?.name ?? ''}
                  placeholder="e.g. Cochin International Airport (COK)"
                  className="input h-9 py-1.5 text-sm w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="code">
                  Short Code
                </label>
                <input
                  id="code"
                  name="code"
                  defaultValue={point?.code ?? ''}
                  placeholder="e.g. COK"
                  className="input h-9 py-1.5 text-sm uppercase w-full"
                />
              </div>

              {/* Row 2: Type, Town & Distance */}
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="point_type">
                  Point Type <span className="text-coral-600">*</span>
                </label>
                <select
                  id="point_type"
                  name="point_type"
                  required
                  defaultValue={point?.point_type ?? 'airport'}
                  className="input h-9 py-1 text-sm w-full"
                >
                  {POINT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="location_id">
                  Nearest Town (Location)
                </label>
                <select
                  id="location_id"
                  name="location_id"
                  defaultValue={point?.location_id ? String(point.location_id) : ''}
                  className="input h-9 py-1 text-sm w-full"
                >
                  <option value="">— Select town —</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={String(loc.id)}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="km_from_location">
                  Distance to Town (km)
                </label>
                <input
                  id="km_from_location"
                  name="km_from_location"
                  type="number"
                  min="0"
                  step="0.5"
                  defaultValue={point?.km_from_location ?? 0}
                  className="input h-9 py-1.5 text-sm w-full"
                />
              </div>

              {/* Row 3: Google Maps, Phone, Sort & Flags */}
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="google_maps_url">
                  Google Maps Link
                </label>
                <input
                  id="google_maps_url"
                  name="google_maps_url"
                  type="url"
                  defaultValue={point?.google_maps_url ?? ''}
                  placeholder="https://maps.google.com/…"
                  className="input h-9 py-1.5 text-sm w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="contact_phone">
                  Contact Phone
                </label>
                <input
                  id="contact_phone"
                  name="contact_phone"
                  type="tel"
                  defaultValue={point?.contact_phone ?? ''}
                  placeholder="e.g. +91 484 2610115"
                  className="input h-9 py-1.5 text-sm w-full"
                />
              </div>

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
                  defaultValue={point?.sort_order ?? 100}
                  className="input h-9 py-1.5 text-sm w-full"
                />
              </div>

              {/* Checkboxes Row */}
              <div className="sm:col-span-3 flex flex-wrap items-center gap-6 py-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-800 select-none">
                  <input
                    type="checkbox"
                    name="use_for_pickup"
                    defaultChecked={point?.use_for_pickup ?? true}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  Offer as Pickup Point
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-800 select-none">
                  <input
                    type="checkbox"
                    name="use_for_drop"
                    defaultChecked={point?.use_for_drop ?? true}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  Offer as Drop Point
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-800 select-none">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={point?.is_active ?? true}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  Active (Offered in Quotes)
                </label>
              </div>

              {/* Row 4: Address & Notes */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="address">
                  Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={2}
                  defaultValue={point?.address ?? ''}
                  placeholder="Terminal, gate, street, road, city…"
                  className="input w-full text-xs py-1.5 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="notes">
                  Notes &amp; Policies
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  defaultValue={point?.notes ?? ''}
                  placeholder="Meeting point, parking, terms…"
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
                {pointId ? 'Save Changes' : 'Add Point'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
