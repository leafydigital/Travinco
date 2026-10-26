'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Save, Loader2 } from 'lucide-react';
import { updateCustomer, getCustomerById } from './actions';

interface CustomerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  initialName?: string;
}

export function CustomerEditModal({
  isOpen,
  onClose,
  customerId,
  initialName = '',
}: CustomerEditModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [source, setSource] = useState('website');
  const [notes, setNotes] = useState('');

  // Fetch full customer details on demand when edit modal opens
  useEffect(() => {
    let cancelled = false;
    if (isOpen && customerId) {
      setIsLoading(true);
      getCustomerById(customerId).then((res) => {
        if (cancelled) return;
        if (res.data) {
          setFullName(res.data.full_name || '');
          setPhone(res.data.phone || '');
          setWhatsappNumber(res.data.whatsapp_number || '');
          setEmail(res.data.email || '');
          setCity(res.data.city || '');
          setState(res.data.state || '');
          setSource(res.data.source || 'website');
          setNotes(res.data.notes || '');
        } else if (res.error) {
          toast.error(res.error);
        }
        setIsLoading(false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, customerId]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateCustomer(customerId, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        whatsapp_number: whatsappNumber.trim() || null,
        email: email.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        source: source as any,
        notes: notes.trim() || null,
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success('Customer updated successfully');
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-ink-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Edit Customer</h2>
            <p className="text-xs text-ink-500">Update complete customer details</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="p-6 space-y-4 animate-pulse">
            <div>
              <div className="h-3 w-20 rounded bg-ink-200 mb-2" />
              <div className="h-9 w-full rounded-lg bg-ink-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="h-3 w-16 rounded bg-ink-200 mb-2" />
                <div className="h-9 w-full rounded-lg bg-ink-100" />
              </div>
              <div>
                <div className="h-3 w-24 rounded bg-ink-200 mb-2" />
                <div className="h-9 w-full rounded-lg bg-ink-100" />
              </div>
            </div>
            <div>
              <div className="h-3 w-16 rounded bg-ink-200 mb-2" />
              <div className="h-9 w-full rounded-lg bg-ink-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="h-3 w-12 rounded bg-ink-200 mb-2" />
                <div className="h-9 w-full rounded-lg bg-ink-100" />
              </div>
              <div>
                <div className="h-3 w-12 rounded bg-ink-200 mb-2" />
                <div className="h-9 w-full rounded-lg bg-ink-100" />
              </div>
            </div>
            <div>
              <div className="h-3 w-16 rounded bg-ink-200 mb-2" />
              <div className="h-16 w-full rounded-lg bg-ink-100" />
            </div>
            <div className="flex justify-end pt-2">
              <div className="h-9 w-28 rounded-lg bg-ink-200" />
            </div>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">
                Full Name <span className="text-coral-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input text-sm"
                placeholder="e.g. Rahul Sharma"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. +91 9876543210"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. +91 9876543210"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input text-sm"
                placeholder="e.g. customer@example.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. Mumbai"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. Maharashtra"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">
                Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="input text-sm capitalize"
              >
                <option value="website">Website</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="referral">Referral</option>
                <option value="direct">Direct</option>
                <option value="social">Social Media</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="input text-sm resize-none"
                placeholder="Special preferences, past booking history, notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-ink-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="btn-outline text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
