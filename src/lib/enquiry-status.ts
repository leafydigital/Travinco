import type { EnquiryPriority, EnquiryStatus } from '@/types/database';

/**
 * The enquiry pipeline, in the order staff move an enquiry through it.
 * Every new enquiry (website forms, contact page, Excel upload) starts as 'new'.
 */
export const ENQUIRY_STATUS_OPTIONS: {
  value: EnquiryStatus;
  label: string;
  badgeClass: string;
  dotColor: string;
}[] = [
  {
    value: 'new',
    label: 'New lead',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200/80 hover:bg-sky-100/70',
    dotColor: 'bg-sky-500',
  },
  {
    value: 'pending_quote',
    label: 'Pending for quote',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70',
    dotColor: 'bg-amber-500',
  },
  {
    value: 'follow_up',
    label: 'Follow up',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200/80 hover:bg-purple-100/70',
    dotColor: 'bg-purple-500',
  },
  {
    value: 'converted',
    label: 'Converted',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70',
    dotColor: 'bg-emerald-500',
  },
  {
    value: 'lost',
    label: 'Deal lost or not interested',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/80 hover:bg-rose-100/70',
    dotColor: 'bg-rose-500',
  },
];

export const ENQUIRY_STATUS_VALUES = ENQUIRY_STATUS_OPTIONS.map((o) => o.value);

/** Enquiries in these states need no more follow-up (never shown as overdue). */
export const RESOLVED_ENQUIRY_STATUSES: EnquiryStatus[] = ['converted', 'lost'];

/** Rows written before the status migration ran still read sensibly. */
const LEGACY_STATUS_MAP: Record<string, EnquiryStatus> = {
  contacted: 'follow_up',
  negotiation: 'follow_up',
  quotation_sent: 'follow_up',
  confirmed: 'converted',
  booked: 'converted',
  closed: 'lost',
};

export function normalizeEnquiryStatus(status: string | null | undefined): EnquiryStatus {
  if (!status) return 'new';
  if ((ENQUIRY_STATUS_VALUES as string[]).includes(status)) return status as EnquiryStatus;
  return LEGACY_STATUS_MAP[status] ?? 'new';
}

export function enquiryStatusLabel(status: string | null | undefined): string {
  const value = normalizeEnquiryStatus(status);
  return ENQUIRY_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? 'New lead';
}

/**
 * Priority from how soon the customer travels (YYYY-MM-DD).
 * No travel date yet → urgent, so someone calls to find out.
 */
export function computePriorityFromTravelDate(travelDate?: string | null): EnquiryPriority {
  if (!travelDate || !/^\d{4}-\d{2}-\d{2}/.test(travelDate)) return 'urgent';
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = travelDate.slice(0, 10).split('-').map(Number);
  const travelUtc = Date.UTC(y!, m! - 1, d!);
  const diffDays = Math.round((travelUtc - todayUtc) / 86_400_000);
  if (diffDays <= 2) return 'urgent'; // today or upcoming within 48h
  if (diffDays <= 7) return 'high'; // within a week
  if (diffDays <= 30) return 'medium';
  return 'low';
}
