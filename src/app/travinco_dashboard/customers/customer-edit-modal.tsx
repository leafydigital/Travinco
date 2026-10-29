'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Save, Loader2 } from 'lucide-react';
import { updateCustomer, getCustomerById } from './actions';
import { HField } from '@/components/admin/horizontal-field';
import { ModalPortal } from '@/components/ui/modal-portal';

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
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-ink-100 overflow-hidden">
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
            <form onSubmit={handleSubmit} className="p-6 space-y-3">
              <HField label="Full name" required htmlFor="edit-cust-name" labelWidth="sm:w-28" fieldClassName="sm:max-w-sm">
                <input
                  id="edit-cust-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. Rahul Sharma"
                />
              </HField>
  
              <HField label="Phone" htmlFor="edit-cust-phone" labelWidth="sm:w-28" fieldClassName="sm:max-w-[15rem]">
                <input
                  id="edit-cust-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input text-sm"
                  placeholder="Enter number"
                />
              </HField>
  
              <HField label="WhatsApp" htmlFor="edit-cust-wa" labelWidth="sm:w-28" fieldClassName="sm:max-w-[15rem]">
                <input
                  id="edit-cust-wa"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="input text-sm"
                  placeholder="Enter number"
                />
              </HField>
  
              <HField label="Email" htmlFor="edit-cust-email" labelWidth="sm:w-28" fieldClassName="sm:max-w-sm">
                <input
                  id="edit-cust-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. customer@example.com"
                />
              </HField>
  
              <HField label="City" htmlFor="edit-cust-city" labelWidth="sm:w-28" fieldClassName="sm:max-w-[15rem]">
                <input
                  id="edit-cust-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. Mumbai"
                />
              </HField>
  
              <HField label="State" htmlFor="edit-cust-state" labelWidth="sm:w-28" fieldClassName="sm:max-w-[15rem]">
                <input
                  id="edit-cust-state"
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. Maharashtra"
                />
              </HField>
  
              <HField label="Source" htmlFor="edit-cust-source" labelWidth="sm:w-28" fieldClassName="sm:max-w-[15rem]">
                <select
                  id="edit-cust-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="input text-sm"
                >
                  <option value="website">Website</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="walk_in">Walk-in</option>
                  <option value="referral">Referral</option>
                  <option value="social_media">Social media</option>
                  <option value="other">Other</option>
                </select>
              </HField>
  
              <HField label="Notes" htmlFor="edit-cust-notes" labelWidth="sm:w-28">
                <textarea
                  id="edit-cust-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="input text-sm resize-none"
                  placeholder="Special preferences, past booking history, notes..."
                />
              </HField>
  
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
    </ModalPortal>
  );
}
