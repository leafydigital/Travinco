import { cn } from '@/lib/utils/cn';

const QUOTE: Record<string, string> = {
  draft: 'bg-ink-100 text-ink-600',
  sent: 'bg-ocean-50 text-ocean-800',
  accepted: 'bg-brand-100 text-brand-800',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-sand-100 text-sand-800',
  invoiced: 'bg-navy-800 text-white',
};

const INVOICE: Record<string, string> = {
  draft: 'bg-ink-100 text-ink-600',
  issued: 'bg-ocean-50 text-ocean-800',
  partially_paid: 'bg-sand-100 text-sand-800',
  paid: 'bg-brand-100 text-brand-800',
  cancelled: 'bg-red-50 text-red-700',
};

export function QuoteStatusBadge({ status, className }: { status: string; className?: string }) {
  return <span className={cn('badge capitalize', QUOTE[status] ?? 'bg-ink-100 text-ink-600', className)}>{status}</span>;
}

export function InvoiceStatusBadge({ status, className }: { status: string; className?: string }) {
  return <span className={cn('badge capitalize', INVOICE[status] ?? 'bg-ink-100 text-ink-600', className)}>{status.replace('_', ' ')}</span>;
}
