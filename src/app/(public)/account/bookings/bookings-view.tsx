'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Calendar,
  Clock,
  ArrowRight,
  Package,
  Compass,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { CustomerDashboardData, CustomerInvoice } from '@/lib/services/customer-account';

export function BookingsView({ data }: { data: CustomerDashboardData }) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'enquiries' | 'bookings'>('invoices');

  const { invoices, enquiries, bookings } = data;
  const hasNothing = invoices.length === 0 && enquiries.length === 0 && bookings.length === 0;

  return (
    <div className="space-y-6">
      {/* ── Navigation Tabs ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-200/80 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'invoices'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white text-ink-600 hover:bg-sand-100 hover:text-ink-900 border border-ink-200/60'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>My Invoices</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === 'invoices'
                  ? 'bg-white/20 text-white'
                  : 'bg-sand-100 text-ink-600'
              }`}
            >
              {invoices.length}
            </span>
          </button>

          {enquiries.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('enquiries')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'enquiries'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-white text-ink-600 hover:bg-sand-100 hover:text-ink-900 border border-ink-200/60'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Pending Requests</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activeTab === 'enquiries'
                    ? 'bg-white/20 text-white'
                    : 'bg-sand-100 text-ink-600'
                }`}
              >
                {enquiries.length}
              </span>
            </button>
          )}

          {bookings.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'bookings'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-white text-ink-600 hover:bg-sand-100 hover:text-ink-900 border border-ink-200/60'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Direct Bookings</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activeTab === 'bookings'
                    ? 'bg-white/20 text-white'
                    : 'bg-sand-100 text-ink-600'
                }`}
              >
                {bookings.length}
              </span>
            </button>
          )}
        </div>

        <Link
          href="/booking"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
        >
          <span>Need a new quote?</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── Main Tab Content ─────────────────────────────────────────── */}
      {hasNothing ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-14 px-6 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Receipt className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-display text-lg font-bold text-ink-900">
            No Invoices Found
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500 leading-relaxed">
            When our travel experts confirm your trip and convert your quotation into an official booking invoice, your invoice and payment details will appear here.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/booking"
              className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <Compass className="h-4 w-4" /> Request a Custom Quote
            </Link>
          </div>
        </div>
      ) : activeTab === 'invoices' ? (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="rounded-xl border border-ink-100 bg-white p-8 text-center text-sm text-ink-500">
              No confirmed invoices found under this account yet.
            </div>
          ) : (
            invoices.map((inv) => {
              const tripTitle =
                inv.trip_title ||
                inv.items?.[0]?.description?.split('.')[0] ||
                'Tour Package Invoice';

              return (
                <div
                  key={inv.id}
                  className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-xs transition hover:shadow-md hover:border-brand-200"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-sand-50/60 px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-mono font-bold text-brand-700 border border-brand-200/60">
                        {inv.invoice_number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'partially_paid'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {inv.status === 'paid'
                          ? 'Paid in Full'
                          : inv.status === 'partially_paid'
                          ? 'Partially Paid'
                          : 'Payment Due'}
                      </span>
                    </div>

                    <span className="text-xs text-ink-400">
                      Date: {formatDate(inv.invoice_date)}
                      {inv.due_date ? ` · Due: ${formatDate(inv.due_date)}` : ''}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 sm:p-6">
                    <div className="grid gap-6 lg:grid-cols-12 items-center">
                      {/* Trip & Billed To Info (Left 7 Cols) */}
                      <div className="lg:col-span-7 space-y-2.5">
                        <h3 className="font-display text-base sm:text-lg font-bold text-ink-900 line-clamp-2">
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

                      {/* Financials & Action Button (Right 5 Cols) */}
                      <div className="lg:col-span-5 rounded-xl border border-ink-150 bg-sand-50/40 p-4 space-y-3">
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between text-ink-500">
                            <span>Total Invoice:</span>
                            <span className="font-semibold text-ink-900">
                              {formatCurrency(inv.total_amount, 'INR')}
                            </span>
                          </div>
                          {Number(inv.amount_paid) > 0 && (
                            <div className="flex justify-between text-emerald-700">
                              <span>Amount Paid:</span>
                              <span className="font-semibold">
                                {formatCurrency(inv.amount_paid, 'INR')}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-ink-900 pt-1 border-t border-ink-100">
                            <span>Balance Due:</span>
                            <span
                              className={
                                Number(inv.balance_amount) > 0
                                  ? 'text-coral-700'
                                  : 'text-emerald-700'
                              }
                            >
                              {formatCurrency(inv.balance_amount, 'INR')}
                            </span>
                          </div>
                        </div>

                        <Link
                          href={`/account/bookings/invoices/${inv.id}`}
                          className="btn-primary flex w-full items-center justify-center gap-1.5 py-2 text-xs font-semibold shadow-xs"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>View Official Invoice</span>
                          <ExternalLink className="h-3 w-3 opacity-70" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : activeTab === 'enquiries' ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              These are your pending trip requests. Once our team converts your quote into an official invoice, it will appear under My Invoices above.
            </p>
          </div>

          {enquiries.map((enquiry) => (
            <div
              key={enquiry.id}
              className="card flex flex-wrap items-center justify-between gap-4 p-4 hover:border-brand-200 transition"
            >
              <div>
                <p className="text-xs font-mono font-medium text-brand-600">
                  {enquiry.enquiry_number}
                </p>
                <p className="mt-0.5 font-medium text-ink-900">
                  {enquiry.package_title || enquiry.destination || 'Custom Tour Request'}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                  <Clock className="h-3.5 w-3.5" /> Submitted on {formatDate(enquiry.created_at)}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-sand-100 text-sand-800">
                  Under Review
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="card flex flex-wrap items-center justify-between gap-4 p-4 hover:border-brand-200 transition"
            >
              <div>
                <p className="text-xs font-mono font-medium text-brand-600">
                  {booking.booking_number}
                </p>
                <p className="mt-0.5 font-medium text-ink-900">
                  {booking.package_title || 'Package Booking'}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(booking.travel_start_date)} – {formatDate(booking.travel_end_date)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink-900">
                  {formatCurrency(booking.total_amount, 'INR')}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-brand-50 text-brand-700">
                  {booking.booking_status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
