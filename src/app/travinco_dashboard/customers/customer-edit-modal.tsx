'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Save } from 'lucide-react';
import { updateCustomer } from './actions';

interface CustomerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    id: string;
    full_name: string;
    phone?: string | null;
    whatsapp_number?: string | null;
    email?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    source?: string | null;
    notes?: string | null;
  };
}

export function CustomerEditModal({ isOpen, onClose, customer }: CustomerEditModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(customer.full_name || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [whatsappNumber, setWhatsappNumber] = useState(customer.whatsapp_number || '');
  const [email, setEmail] = useState(customer.email || '');
  const [city, setCity] = useState(customer.city || '');
  const [state, setState] = useState(customer.state || '');
  const [source, setSource] = useState(customer.source || 'website');
  const [notes, setNotes] = useState(customer.notes || '');

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateCustomer(customer.id, {
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
            <p className="text-xs text-ink-500">Update customer details</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
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
              <label className="block text-xs font-medium text-ink-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input text-sm"
                placeholder="+91..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">WhatsApp Number</label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="input text-sm"
                placeholder="+91..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input text-sm"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="input text-sm"
              >
                <option value="website">Website</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone</option>
                <option value="walk_in">Walk-in</option>
                <option value="referral">Referral</option>
                <option value="social_media">Social Media</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input text-sm"
                placeholder="e.g. Kochi"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="input text-sm"
                placeholder="e.g. Kerala"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input text-sm resize-none"
              placeholder="Internal notes or customer preferences..."
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-ink-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-outline h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !fullName.trim()}
              className="btn-primary h-9 px-4 text-xs"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
