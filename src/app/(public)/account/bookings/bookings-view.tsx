'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Calendar,
  Clock,
  ArrowRight,
  Compass,
  Eye,
  Download,
  MessageSquareText,
  Users,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import type { CustomerDashboardData } from '@/lib/services/customer-account';
import { ListPagination, PAGE_SIZE_OPTIONS } from '@/components/public/list-pagination';

type Tab = 'invoices' | 'enquiries';

/** Customer-facing wording for the team's enquiry pipeline statuses. */
const ENQUIRY_STATUS: Record<string, { label: string; className: string }> = {
  new: { label: 'Submitted', className: 'bg-sky-100 text-sky-800' },
  pending_quote: { label: 'Preparing Quote', className: 'bg-indigo-100 text-indigo-800' },
  converted: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800' },
  contacted: { label: 'Contacted', className: 'bg-indigo-100 text-indigo-800' },
  follow_up: { label: 'In Progress', className: 'bg-amber-100 text-amber-800' },
  quotation_sent: { label: 'Quotation Sent', className: 'bg-violet-100 text-violet-800' },
  negotiation: { label: 'In Discussion', className: 'bg-amber-100 text-amber-800' },
  booked: { label: 'Booked', className: 'bg-emerald-100 text-emerald-800' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800' },
  lost: { label: 'Closed', className: 'bg-ink-100 text-ink-600' },
  closed: { label: 'Closed', className: 'bg-ink-100 text-ink-600' },
};

function enquiryStatus(status: string) {
  return (
    ENQUIRY_STATUS[status] ?? {
      label: status ? status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Submitted',
      className: 'bg-sand-100 text-sand-800',
    }
  );
}

function travellersLabel(adults: number, children: number, infants: number) {
  const parts = [
    adults ? `${adults} adult${adults === 1 ? '' : 's'}` : '',
    children ? `${children} child${children === 1 ? '' : 'ren'}` : '',
    infants ? `${infants} infant${infants === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return parts.join(', ');
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Receipt;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-brand-600 text-white shadow-xs'
          : 'border border-ink-200/60 bg-white text-ink-600 hover:bg-sand-100 hover:text-ink-900'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-sand-100 text-ink-600'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Receipt; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center shadow-xs">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="mt-4 font-display text-lg font-bold text-ink-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">{text}</p>
      <div className="mt-6 flex justify-center">
        <Link href="/booking" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          <Compass className="h-4 w-4" /> Request a Custom Quote
        </Link>
      </div>
    </div>
  );
}

export function BookingsView({ data }: { data: CustomerDashboardData }) {
  const { invoices, enquiries } = data;
  // Open on enquiries when there are no invoices yet but there are enquiries
  const [activeTab, setActiveTab] = useState<Tab>(
    invoices.length === 0 && enquiries.length > 0 ? 'enquiries' : 'invoices'
  );
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [invoicePage, setInvoicePage] = useState(1);
  const [enquiryPage, setEnquiryPage] = useState(1);

  const pageCount = (n: number) => Math.max(1, Math.ceil(n / pageSize));
  const safeInvoicePage = Math.min(invoicePage, pageCount(invoices.length));
  const safeEnquiryPage = Math.min(enquiryPage, pageCount(enquiries.length));
  const visibleInvoices = invoices.slice((safeInvoicePage - 1) * pageSize, safeInvoicePage * pageSize);
  const visibleEnquiries = enquiries.slice((safeEnquiryPage - 1) * pageSize, safeEnquiryPage * pageSize);

  function changePageSize(size: number) {
    setPageSize(size);
    setInvoicePage(1);
    setEnquiryPage(1);
  }

  function goToPage(setter: (p: number) => void, p: number) {
    setter(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="space-y-6">
      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-200/80 pb-3">
        <div role="tablist" className="flex items-center gap-2 overflow-x-auto">
          <TabButton
            active={activeTab === 'invoices'}
            onClick={() => setActiveTab('invoices')}
            icon={Receipt}
            label="My Invoices"
            count={invoices.length}
          />
          <TabButton
            active={activeTab === 'enquiries'}
            onClick={() => setActiveTab('enquiries')}
            icon={MessageSquareText}
            label="My Enquiries"
            count={enquiries.length}
          />
        </div>

        <Link
          href="/booking"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
        >
          <span>Need a new quote?</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── Invoices ───────────────────────────────────────────────────── */}
      {activeTab === 'invoices' &&
        (invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No Invoices Yet"
            text="When our travel experts confirm your trip and convert your quotation into an official invoice, it will appear here."
          />
        ) : (
          <div className="space-y-4">
            {visibleInvoices.map((inv) => {
              const tripTitle =
                inv.trip_title || inv.items?.[0]?.description?.split('.')[0] || 'Tour Package Invoice';
              const href = `/account/bookings/invoices/${inv.id}`;

              return (
                <div
                  key={inv.id}
                  className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-xs transition hover:border-brand-200 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-sand-50/60 px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-md border border-brand-200/60 bg-brand-50 px-2.5 py-1 font-mono text-xs font-bold text-brand-700">
                        {inv.invoice_number}
                      </span>
                    </div>
                    <span className="text-xs text-ink-400">
                      Date: {formatDate(inv.invoice_date)}
                      {inv.due_date ? ` · Due: ${formatDate(inv.due_date)}` : ''}
                    </span>
                  </div>

                  <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="min-w-0 space-y-2.5">
                      <h3 className="line-clamp-2 font-display text-base font-bold text-ink-900 sm:text-lg">
                        {tripTitle}
                      </h3>
                      {inv.travel_start && (
                        <div className="flex items-center gap-1.5 text-xs text-ink-500">
                          <Calendar className="h-3.5 w-3.5 text-ink-400" />
                          <span>
                            Travel Dates: {formatDate(inv.travel_start)}
                            {inv.travel_end ? ` – ${formatDate(inv.travel_end)}` : ''}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-ink-400">
                        Billed to: <span className="font-medium text-ink-700">{inv.bill_to_name}</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        href={href}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 shadow-xs transition hover:bg-sand-50 hover:text-ink-900 sm:flex-none"
                      >
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Link>
                      <Link
                        href={`${href}?download=1`}
                        className="btn-primary inline-flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold shadow-xs sm:flex-none"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            <ListPagination
              page={safeInvoicePage}
              pageSize={pageSize}
              totalItems={invoices.length}
              itemLabel="invoices"
              onPageChange={(p) => goToPage(setInvoicePage, p)}
              onPageSizeChange={changePageSize}
            />
          </div>
        ))}

      {/* ── Enquiries ──────────────────────────────────────────────────── */}
      {activeTab === 'enquiries' &&
        (enquiries.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title="No Enquiries Yet"
            text="Trip enquiries you send through our Book With Us form will appear here, along with their latest status."
          />
        ) : (
          <div className="space-y-3">
            {visibleEnquiries.map((enquiry) => {
              const status = enquiryStatus(enquiry.status);
              const travellers = travellersLabel(
                enquiry.number_of_adults,
                enquiry.number_of_children,
                enquiry.number_of_infants
              );
              return (
                <div
                  key={enquiry.id}
                  className="card flex flex-wrap items-start justify-between gap-4 p-4 transition hover:border-brand-200 sm:p-5"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-xs font-medium text-brand-600">{enquiry.enquiry_number}</p>
                    <p className="font-medium text-ink-900">
                      {enquiry.package_title || enquiry.destination || 'Custom Tour Request'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Submitted {formatDate(enquiry.created_at)}
                      </span>
                      {enquiry.travel_date && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" /> Travel {formatDate(enquiry.travel_date)}
                        </span>
                      )}
                      {travellers && (
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> {travellers}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Status</span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
            <ListPagination
              page={safeEnquiryPage}
              pageSize={pageSize}
              totalItems={enquiries.length}
              itemLabel="enquiries"
              onPageChange={(p) => goToPage(setEnquiryPage, p)}
              onPageSizeChange={changePageSize}
            />
          </div>
        ))}
    </div>
  );
}
