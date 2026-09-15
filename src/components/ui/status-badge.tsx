import { cn } from '@/lib/utils/cn';
import { toLabel } from '@/lib/utils/format';

const toneMap: Record<string, string> = {
  // content status
  draft: 'bg-ink-100 text-ink-600',
  published: 'bg-brand-100 text-brand-800',
  archived: 'bg-ink-100 text-ink-500',
  // enquiry status
  new: 'bg-ocean-100 text-ocean-800',
  contacted: 'bg-sand-100 text-sand-800',
  follow_up: 'bg-sand-200 text-sand-800',
  quotation_sent: 'bg-navy-100 text-navy-700',
  negotiation: 'bg-navy-100 text-navy-700',
  confirmed: 'bg-brand-100 text-brand-800',
  lost: 'bg-coral-100 text-coral-700',
  closed: 'bg-ink-100 text-ink-500',
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

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', toneMap[status] ?? 'bg-ink-100 text-ink-600')}>
      {toLabel(status)}
    </span>
  );
}
