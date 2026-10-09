'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, CopyPlus, FileDown, MessageCircle, Pencil, Printer, ReceiptText, Send, Trash2, X, ClipboardCopy } from 'lucide-react';
import { setQuotationStatus, duplicateQuotation, deleteQuotation } from '../actions';
import { convertQuotationToInvoice } from '../../invoices/actions';
import { copyElement, copyText, downloadPdf, downloadWord, printAsPdf, waLink } from '@/components/tour/doc-tools';
import { Dialog } from '@/components/admin/entity-manager';

export function QuoteActions({
  id,
  number,
  status,
  phone,
  whatsapp,
  options,
  invoiceId,
  isAdmin,
  fileName,
}: {
  id: string;
  number: string;
  status: string;
  phone: string | null;
  whatsapp: string;
  options: { label: string; total: number }[];
  invoiceId: string | null;
  isAdmin: boolean;
  fileName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [convertOpen, setConvertOpen] = useState(false);
  const [option, setOption] = useState<1 | 2>(1);
  const locked = status === 'invoiced';

  const run = (fn: () => Promise<{ error?: string; id?: string } | undefined>, ok: string, then?: (r: { id?: string }) => void) =>
    start(async () => {
      const r = await fn();
      if (r?.error) return void toast.error(r.error);
      toast.success(ok);
      if (then) then(r ?? {});
      else router.refresh();
    });

  const convert = (opt: 1 | 2) =>
    run(() => convertQuotationToInvoice(id, opt), 'Invoice created', (r) => {
      setConvertOpen(false);
      if (r.id) router.push(`/admin/invoices/${r.id}`);
    });

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {invoiceId ? (
        <Link href={`/admin/invoices/${invoiceId}`} className="btn-cta">
          <ReceiptText className="h-4 w-4" /> View invoice
        </Link>
      ) : (
        <button type="button" className="btn-cta" disabled={pending || status === 'rejected'} onClick={() => (options.length > 1 ? setConvertOpen(true) : convert(1))}>
          <ReceiptText className="h-4 w-4" /> Convert to Invoice
        </button>
      )}
      {!locked && (
        <Link href={`/admin/quotations/${id}/edit`} className="btn-outline">
          <Pencil className="h-4 w-4" /> Edit
        </Link>
      )}
      <button type="button" className="btn-outline text-brand-700" onClick={() => downloadPdf('quote-doc', fileName)}>
        <FileDown className="h-4 w-4" /> Download PDF
      </button>
      <button type="button" className="btn-outline" onClick={() => printAsPdf(fileName)}>
        <Printer className="h-4 w-4" /> Print
      </button>
      <button type="button" className="btn-outline" onClick={() => downloadWord('quote-doc', fileName)}>
        <FileDown className="h-4 w-4" /> Word
      </button>
      <button type="button" className="btn-outline" onClick={async () => ((await copyText(whatsapp)) ? toast.success('WhatsApp text copied') : toast.error('Copy failed – your browser blocked the clipboard'))}>
        <Copy className="h-4 w-4" /> Copy for WhatsApp
      </button>
      {phone && (
        <a className="btn-outline" href={waLink(phone, whatsapp)} target="_blank" rel="noreferrer">
          <MessageCircle className="h-4 w-4" /> Send on WhatsApp
        </a>
      )}
      <button type="button" className="btn-ghost" title="Copy formatted (for email)" onClick={async () => ((await copyElement('quote-doc')) ? toast.success('Copied – paste into your email') : toast.error('Copy failed'))}>
        <ClipboardCopy className="h-4 w-4" /> Copy formatted
      </button>

      <span className="mx-1 h-6 w-px bg-ink-200" />
      {!locked && status !== 'sent' && (
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => setQuotationStatus(id, 'sent'), 'Marked as sent')}>
          <Send className="h-4 w-4" /> Mark sent
        </button>
      )}
      {!locked && status !== 'accepted' && (
        <button type="button" className="btn-ghost text-brand-700" disabled={pending} onClick={() => run(() => setQuotationStatus(id, 'accepted'), 'Marked as accepted')}>
          <Check className="h-4 w-4" /> Accepted
        </button>
      )}
      {!locked && status !== 'rejected' && (
        <button type="button" className="btn-ghost text-red-600" disabled={pending} onClick={() => run(() => setQuotationStatus(id, 'rejected'), 'Marked as rejected')}>
          <X className="h-4 w-4" /> Rejected
        </button>
      )}
      <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => duplicateQuotation(id), 'Copy created', (r) => r.id && router.push(`/admin/quotations/${r.id}/edit`))}>
        <CopyPlus className="h-4 w-4" /> Duplicate
      </button>
      {isAdmin && !locked && (
        <button
          type="button"
          className="btn-ghost text-red-600"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Delete quotation ${number}? This cannot be undone.`)) run(() => deleteQuotation(id), 'Quotation deleted', () => router.push('/admin/quotations'));
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      )}

      {convertOpen && (
        <Dialog title="Convert to invoice" onClose={() => setConvertOpen(false)}>
          <p className="mb-3 text-sm text-ink-600">This quotation has two options. Which one did the guest choose?</p>
          <div className="space-y-2">
            {options.map((o, i) => (
              <label key={o.label} className="flex cursor-pointer items-center justify-between rounded-lg border border-ink-200 p-3 text-sm hover:bg-ink-50">
                <span className="flex items-center gap-2">
                  <input type="radio" name="opt" checked={option === i + 1} onChange={() => setOption((i + 1) as 1 | 2)} />
                  {o.label}
                </span>
                <b className="tabular-nums">₹{Math.round(o.total).toLocaleString('en-IN')}</b>
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setConvertOpen(false)}>Cancel</button>
            <button className="btn-cta" disabled={pending} onClick={() => convert(option)}>{pending ? 'Creating…' : 'Create invoice'}</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
