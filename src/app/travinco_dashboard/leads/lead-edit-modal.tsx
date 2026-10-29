'use client';

import { useState, useTransition } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { updateLead, type LeadStatus } from './actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ModalPortal } from '@/components/ui/modal-portal';

export interface LeadRecord {
  id: string;
  contact_name: string;
  contact_number: string;
  email: string | null;
  package: string | null;
  number_of_days: number | null;
  budget: number | null;
  from_date: string | null;
  to_date: string | null;
  number_of_people: number | null;
  status: LeadStatus;
}

interface Props {
  lead: LeadRecord;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'fresh_lead', label: 'Fresh Lead' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'enquired', label: 'Enquired' },
  { value: 'converted', label: 'Converted' },
];

export function LeadEditModal({ lead, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactName, setContactName] = useState(lead.contact_name);
  const [contactNumber, setContactNumber] = useState(lead.contact_number);
  const [email, setEmail] = useState(lead.email ?? '');
  const [pkg, setPkg] = useState(lead.package ?? '');
  const [days, setDays] = useState<string>(lead.number_of_days ? String(lead.number_of_days) : '');
  const [budget, setBudget] = useState<string>(lead.budget ? String(lead.budget) : '');
  const [fromDate, setFromDate] = useState(lead.from_date ?? '');
  const [toDate, setToDate] = useState(lead.to_date ?? '');
  const [people, setPeople] = useState<string>(lead.number_of_people ? String(lead.number_of_people) : '');
  const [status, setStatus] = useState<LeadStatus>(lead.status);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim()) {
      toast.error('Contact name is required');
      return;
    }
    if (!contactNumber.trim()) {
      toast.error('Contact number is required');
      return;
    }

    startTransition(async () => {
      const res = await updateLead(lead.id, {
        contact_name: contactName.trim(),
        contact_number: contactNumber.trim(),
        email: email.trim() || undefined,
        package: pkg.trim() || undefined,
        number_of_days: days ? parseInt(days, 10) : null,
        budget: budget ? parseFloat(budget) : null,
        from_date: fromDate || null,
        to_date: toDate || null,
        number_of_people: people ? parseInt(people, 10) : null,
        status,
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success('Lead updated successfully');
      router.refresh();
      onClose();
    });
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-4">
        <div className="card w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
            <h2 className="text-base font-semibold text-ink-900">Edit Lead Details</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
  
          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">
                  Contact Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  required
                  className="input text-sm"
                />
              </div>
            </div>
  
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Package</label>
                <input
                  type="text"
                  value={pkg}
                  onChange={(e) => setPkg(e.target.value)}
                  className="input text-sm"
                />
              </div>
            </div>
  
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Number of Days</label>
                <input
                  type="number"
                  min="0"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Budget (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">People</label>
                <input
                  type="number"
                  min="0"
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  className="input text-sm"
                />
              </div>
            </div>
  
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="input text-sm"
                />
              </div>
            </div>
  
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="input text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
  
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="btn-outline text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
