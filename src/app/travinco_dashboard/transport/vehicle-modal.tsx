'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { saveTransportVehicle } from '@/lib/tour/master-actions';
import { getTransportVehicleById } from './actions';
import type { TransportVehicle } from '@/lib/tour/types';
import { isAllZeroPhone } from '@/lib/validations/phone';
import { ModalPortal } from '@/components/ui/modal-portal';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId: number | null; // null = Add, number = Edit
}

export function VehicleModal({
  isOpen,
  onClose,
  onSuccess,
  vehicleId,
}: VehicleModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [vehicle, setVehicle] = useState<Partial<TransportVehicle> | null>(null);

  // Keep fresh ref to onClose to avoid re-triggering effect on parent re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Track the vehicle ID that has already been loaded to prevent duplicate fetches on field clicks
  const loadedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setVehicle(null);
      setIsLoading(false);
      loadedIdRef.current = null;
      return;
    }

    if (vehicleId) {
      // If we have already loaded this vehicle, do NOT re-fetch!
      if (loadedIdRef.current === vehicleId) {
        return;
      }

      loadedIdRef.current = vehicleId;
      setIsLoading(true);
      let cancelled = false;

      getTransportVehicleById(vehicleId)
        .then((res) => {
          if (cancelled) return;
          if (res.error || !res.vehicle) {
            toast.error(res.error || 'Failed to load vehicle details');
            onCloseRef.current?.();
          } else {
            setVehicle(res.vehicle);
          }
        })
        .catch(() => {
          if (cancelled) return;
          toast.error('Failed to load vehicle details');
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
      // Add mode: only initialize once per open session
      if (loadedIdRef.current === -1) {
        return;
      }
      loadedIdRef.current = -1;
      setVehicle({
        vehicle_type: '',
        company_name: '',
        contact_person: '',
        contact_number: '',
        alt_contact_number: '',
        seats: 7,
        is_ac: true,
        rate_basis: 'per_day',
        amount: 3500,
        free_km: 250,
        extra_per_km: 18,
        driver_bata_per_day: 500,
        notes: '',
        is_active: true,
      });
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, vehicleId]); // Strictly depend only on modal visibility and target ID

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (isAllZeroPhone(String(formData.get('contact_number') ?? ''))) {
      toast.error('Contact number cannot be all zeros.');
      return;
    }
    if (isAllZeroPhone(String(formData.get('alt_contact_number') ?? ''))) {
      toast.error('Alternate number cannot be all zeros.');
      return;
    }
    const data: Record<string, unknown> = {
      vehicle_type: formData.get('vehicle_type'),
      company_name: formData.get('company_name'),
      contact_person: formData.get('contact_person'),
      contact_number: formData.get('contact_number'),
      alt_contact_number: formData.get('alt_contact_number'),
      seats: formData.get('seats') ? Number(formData.get('seats')) : null,
      is_ac: formData.get('is_ac') === 'on',
      rate_basis: formData.get('rate_basis'),
      amount: Number(formData.get('amount') || 0),
      free_km: Number(formData.get('free_km') || 0),
      extra_per_km: Number(formData.get('extra_per_km') || 0),
      driver_bata_per_day: Number(formData.get('driver_bata_per_day') || 0),
      notes: formData.get('notes'),
      is_active: formData.get('is_active') === 'on',
    };

    startTransition(async () => {
      const res = await saveTransportVehicle(vehicleId, data);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(vehicleId ? 'Vehicle updated successfully' : 'Vehicle added successfully');
      onSuccess();
      onClose();
    });
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
        <div 
          className="w-full max-w-4xl max-h-[calc(100vh-2rem)] flex flex-col rounded-xl bg-white shadow-lg shadow-ink-900/5 ring-1 ring-ink-900/10 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-3 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                {vehicleId ? 'Edit Vehicle' : 'Add Vehicle'}
              </h2>
              <p className="text-xs text-ink-500">
                {vehicleId ? 'Update vehicle rates and vendor contacts' : 'Add a new transport vendor vehicle'}
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
              <p className="text-sm text-ink-500 font-medium">Fetching vehicle details…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2.5">
                {/* Row 1: Vehicle & Vendor Core */}
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="vehicle_type">
                    Car Type <span className="text-coral-600">*</span>
                  </label>
                  <input
                    id="vehicle_type"
                    name="vehicle_type"
                    required
                    autoComplete="off"
                    defaultValue={vehicle?.vehicle_type ?? ''}
                    placeholder="e.g. Innova Crysta"
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="company_name">
                    Company Name <span className="text-coral-600">*</span>
                  </label>
                  <input
                    id="company_name"
                    name="company_name"
                    required
                    defaultValue={vehicle?.company_name ?? ''}
                    placeholder="e.g. Apex Travels"
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="seats">
                    Seats
                  </label>
                  <input
                    id="seats"
                    name="seats"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue={vehicle?.seats ?? ''}
                    placeholder="e.g. 7"
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                {/* Row 2: Contact Details */}
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="contact_person">
                    Contact Person
                  </label>
                  <input
                    id="contact_person"
                    name="contact_person"
                    defaultValue={vehicle?.contact_person ?? ''}
                    placeholder="e.g. Rajesh Kumar"
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="contact_number">
                    Contact Number <span className="text-coral-600">*</span>
                  </label>
                  <input
                    id="contact_number"
                    name="contact_number"
                    type="tel"
                    required
                    defaultValue={vehicle?.contact_number ?? ''}
                    placeholder="e.g. +91 9876543210"
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="alt_contact_number">
                    Alternate Number
                  </label>
                  <input
                    id="alt_contact_number"
                    name="alt_contact_number"
                    type="tel"
                    defaultValue={vehicle?.alt_contact_number ?? ''}
                    placeholder="e.g. +91 9876543211"
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                {/* Row 3: Rates & Kilometres */}
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="rate_basis">
                    Amount Charged <span className="text-coral-600">*</span>
                  </label>
                  <select
                    id="rate_basis"
                    name="rate_basis"
                    required
                    defaultValue={vehicle?.rate_basis ?? 'per_day'}
                    className="input h-9 py-1 text-sm w-full"
                  >
                    <option value="per_day">Per day</option>
                    <option value="per_trip">Per trip (whole package)</option>
                  </select>
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="amount">
                    Amount (₹) <span className="text-coral-600">*</span>
                  </label>
                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={vehicle?.amount ?? 0}
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="free_km">
                    Free Kilometres <span className="text-coral-600">*</span>
                  </label>
                  <input
                    id="free_km"
                    name="free_km"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={vehicle?.free_km ?? 250}
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                {/* Row 4: Extra Rates & Options */}
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="extra_per_km">
                    Extra per km (₹) <span className="text-coral-600">*</span>
                  </label>
                  <input
                    id="extra_per_km"
                    name="extra_per_km"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={vehicle?.extra_per_km ?? 0}
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="driver_bata_per_day">
                    Driver Bata / Day (₹)
                  </label>
                  <input
                    id="driver_bata_per_day"
                    name="driver_bata_per_day"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={vehicle?.driver_bata_per_day ?? 0}
                    className="input h-9 py-1.5 text-sm w-full"
                  />
                </div>
  
                <div className="flex items-center gap-5 sm:justify-start pt-2 sm:pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-800 select-none">
                    <input
                      type="checkbox"
                      name="is_ac"
                      defaultChecked={vehicle?.is_ac ?? true}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    />
                    Air-Conditioned
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-800 select-none">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={vehicle?.is_active ?? true}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    />
                    Active (Offered)
                  </label>
                </div>
  
                {/* Row 5: Notes & Policies */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-ink-700 mb-1" htmlFor="notes">
                    Notes &amp; Policies
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    defaultValue={vehicle?.notes ?? ''}
                    placeholder="Night halt, permits, toll terms, parking rules…"
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
                  {vehicleId ? 'Save Changes' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
