import { cn } from '@/lib/utils/cn';
import { toLabel } from '@/lib/utils/format';

const toneMap: Record<string, string> = {
  // content status
  draft: 'bg-ink-100 text-ink-600',
  published: 'bg-brand-100 text-brand-800',
  archived: 'bg-ink-100 text-ink-500',
  // enquiry status
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-sand-100 text-sand-800',
  follow_up: 'bg-amber-100 text-amber-800',
  quotation_sent: 'bg-purple-100 text-purple-800',
  negotiation: 'bg-purple-100 text-purple-800',
  confirmed: 'bg-brand-100 text-brand-800',
  lost: 'bg-red-100 text-red-700',
  closed: 'bg-ink-100 text-ink-500',
  // booking status
  inquiry: 'bg-blue-100 text-blue-800',
  pending: 'bg-sand-100 text-sand-800',
  partially_paid: 'bg-amber-100 text-amber-800',
  fully_paid: 'bg-brand-100 text-brand-800',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-brand-100 text-brand-800',
  // payment status
  paid: 'bg-brand-100 text-brand-800',
  partial: 'bg-amber-100 text-amber-800',
  refunded: 'bg-ink-100 text-ink-600',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', toneMap[status] ?? 'bg-ink-100 text-ink-600')}>
      {toLabel(status)}
    </span>
  );
}
