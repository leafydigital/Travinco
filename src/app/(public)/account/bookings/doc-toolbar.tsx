'use client';

import Link from 'next/link';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { printAsPdf, downloadPdf } from '@/components/tour/doc-tools';

export function CustomerDocToolbar({
  title,
  docType,
  docNumber,
  elementId,
  fileName,
}: {
  title: string;
  docType: 'quotation' | 'invoice';
  docNumber: string;
  elementId: string;
  fileName: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-200/80 bg-white p-4 shadow-sm print:hidden">
      <div className="flex items-center gap-3">
        <Link
          href="/account/bookings"
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-sand-50 hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Bookings
        </Link>
        <div>
          <h1 className="text-base font-semibold text-ink-900">{title}</h1>
          <p className="text-xs text-ink-500">
            {docType === 'quotation' ? 'Proposal & Itinerary' : 'Official Tax Invoice'} · Ref: {docNumber}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => printAsPdf(elementId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 shadow-xs transition hover:bg-sand-50 hover:text-ink-900"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>

        <button
          type="button"
          onClick={() => downloadPdf(elementId, fileName)}
          className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <Download className="h-3.5 w-3.5" /> Download PDF
        </button>
      </div>
    </div>
  );
}
