import { cn } from '@/lib/utils/cn';
import { toLabel } from '@/lib/utils/format';

const toneMap: Record<string, string> = {
  // content status
  draft: 'bg-ink-100 text-ink-600',
  published: 'bg-brand-100 text-brand-800',
  archived: 'bg-ink-100 text-ink-500',
  // enquiry status
  new: 'bg-amber-50 text-amber-800 border border-amber-200/80',
  contacted: 'bg-sand-100 text-sand-800 border border-sand-200',
  follow_up: 'bg-purple-50 text-purple-800 border border-purple-200/80',
  quotation_sent: 'bg-indigo-50 text-indigo-800 border border-indigo-200/80',
  negotiation: 'bg-blue-50 text-blue-800 border border-blue-200/80',
  confirmed: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
  booked: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
  lost: 'bg-rose-50 text-rose-800 border border-rose-200/80',
  closed: 'bg-ink-100 text-ink-500 border border-ink-200',
  // priorities
  urgent: 'bg-rose-100 text-rose-800 border border-rose-300 font-semibold',
  high: 'bg-amber-100 text-amber-800 border border-amber-300 font-medium',
  medium: 'bg-sky-100 text-sky-800 border border-sky-300',
  low: 'bg-ink-100 text-ink-600 border border-ink-200',
  // booking status
  inquiry: 'bg-ocean-100 text-ocean-800',
  pending: 'bg-sand-100 text-sand-800',
  partially_paid: 'bg-sand-200 text-sand-800',
  fully_paid: 'bg-brand-100 text-brand-800',
  cancelled: 'bg-coral-100 text-coral-700',
  completed: 'bg-brand-100 text-brand-800',
  // payment status
  paid: 'bg-brand-100 text-brand-800',
  partial: 'bg-sand-200 text-sand-800',
  refunded: 'bg-ink-100 text-ink-600',
};

const labelOverrides: Record<string, string> = {
  new: 'Pending',
  follow_up: 'Follow Up',
  quotation_sent: 'Quotations Sent',
  lost: 'Not Interested',
  confirmed: 'Confirmed',
  booked: 'Booked',
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const displayLabel = labelOverrides[status] ?? toLabel(status);
  return (
    <span className={cn('badge', toneMap[status] ?? 'bg-ink-100 text-ink-600', className)}>
      {displayLabel}
    </span>
  );
}

