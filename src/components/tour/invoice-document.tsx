/* eslint-disable @next/next/no-img-element */
import type { TourSettings } from '@/lib/tour/types';

export type InvoiceDoc = {
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  bill_to_name: string;
  bill_to_phone: string | null;
  bill_to_email: string | null;
  bill_to_address: string | null;
  bill_to_gstin: string | null;
  place_of_supply: string | null;
  travel_start: string | null;
  travel_end: string | null;
  items: { description: string; sac: string; qty: number; rate: number; amount: number }[];
  subtotal: number;
  discount: number;
  taxable_amount: number;
  gst_pct: number;
  tax_mode: 'cgst_sgst' | 'igst';
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  round_off: number;
  total_amount: number;
  amount_paid: number;
  balance_amount: number;
  notes: string | null;
  terms: string | null;
  quote_number?: string | null;
};

const money = (n: number) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function two(n: number): string {
  return n < 20 ? ONES[n]! : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}
function three(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? two(r) : ''].filter(Boolean).join(' ');
}
/** Indian numbering: crore, lakh, thousand. */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1e7);
  const lakh = Math.floor((rupees % 1e7) / 1e5);
  const thousand = Math.floor((rupees % 1e5) / 1e3);
  const rest = rupees % 1e3;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return `${parts.join(' ')} Rupees${paise ? ` and ${two(paise)} Paise` : ''} Only`;
}

const cell: React.CSSProperties = { border: '1px solid #dfe5e2', padding: '6px 8px', fontSize: 12, verticalAlign: 'top' };
const head: React.CSSProperties = { ...cell, background: '#eef7f1', fontWeight: 700, color: '#14532d' };

export function InvoiceDocument({ inv, s, logoUrl = '/brand/travinco-logo.png' }: { inv: InvoiceDoc; s: TourSettings; logoUrl?: string }) {
  const sumRow = (label: string, v: number, bold = false) => (
    <tr>
      <td style={{ ...cell, textAlign: 'right', fontWeight: bold ? 700 : 400 }} colSpan={4}>{label}</td>
      <td style={{ ...cell, textAlign: 'right', fontWeight: bold ? 700 : 400 }}>{money(v)}</td>
    </tr>
  );
  const halfPct = Number(inv.gst_pct) / 2;
  return (
    <article id="invoice-doc" className="mx-auto max-w-[820px] bg-white px-6 py-8 text-ink-800 sm:px-10 print:max-w-none print:p-0" style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13 }}>
      <header style={{ borderBottom: '2px solid #1f8f57', paddingBottom: 14 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f3d2a', letterSpacing: 2, textTransform: 'uppercase' }}>INVOICE</div>
          {inv.status === 'cancelled' && <div style={{ color: '#b91c1c', fontWeight: 800, marginTop: 4, fontSize: 13 }}>CANCELLED</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <img src={logoUrl} alt={s.company_name ?? 'Travinco'} style={{ height: 42, objectFit: 'contain' }} />
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5 }}>
              <b>{s.company_name}</b>
              {s.company_address && <div style={{ whiteSpace: 'pre-line' }}>{s.company_address}</div>}
              <div>{[s.company_phone, s.company_email].filter(Boolean).join(' · ')}</div>
              {s.company_gstin && <div>GSTIN: <b>{s.company_gstin}</b></div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <table style={{ marginLeft: 'auto', fontSize: 12 }}>
              <tbody>
                <tr><td style={{ paddingRight: 8, color: '#6b7280' }}>Invoice no.</td><td><b>{inv.invoice_number}</b></td></tr>
                <tr><td style={{ paddingRight: 8, color: '#6b7280' }}>Date</td><td>{d(inv.invoice_date)}</td></tr>
                {inv.due_date && <tr><td style={{ paddingRight: 8, color: '#6b7280' }}>Due</td><td>{d(inv.due_date)}</td></tr>}
                {inv.quote_number && <tr><td style={{ paddingRight: 8, color: '#6b7280' }}>Quotation</td><td>{inv.quote_number}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </header>

      <section style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>Bill to</div>
          <b style={{ fontSize: 14 }}>{inv.bill_to_name}</b>
          {inv.bill_to_address && <div style={{ whiteSpace: 'pre-line' }}>{inv.bill_to_address}</div>}
          <div>{[inv.bill_to_phone, inv.bill_to_email].filter(Boolean).join(' · ')}</div>
          {inv.bill_to_gstin && <div>GSTIN: {inv.bill_to_gstin}</div>}
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div>Place of supply: <b>{inv.place_of_supply || '—'}</b></div>
          {inv.travel_start && <div>Travel: {d(inv.travel_start)} – {d(inv.travel_end)}</div>}
        </div>
      </section>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr>
            <th style={{ ...head, width: 30 }}>#</th>
            <th style={{ ...head, textAlign: 'left' }}>Description</th>
            <th style={{ ...head, width: 70 }}>SAC</th>
            <th style={{ ...head, width: 50, textAlign: 'right' }}>Qty</th>
            <th style={{ ...head, width: 110, textAlign: 'right' }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it, i) => (
            <tr key={i}>
              <td style={cell}>{i + 1}</td>
              <td style={cell}>{it.description}{Number(it.qty) !== 1 && <div style={{ color: '#6b7280' }}>₹{money(it.rate)} × {it.qty}</div>}</td>
              <td style={cell}>{it.sac}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{it.qty}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{money(it.amount)}</td>
            </tr>
          ))}
          {sumRow('Subtotal', inv.subtotal)}
          {Number(inv.discount) > 0 && sumRow('Less: discount', -inv.discount)}
          {sumRow('Taxable value', inv.taxable_amount, true)}
          {inv.tax_mode === 'igst'
            ? sumRow(`IGST @ ${Number(inv.gst_pct)}%`, inv.igst_amount)
            : (
              <>
                {sumRow(`CGST @ ${halfPct}%`, inv.cgst_amount)}
                {sumRow(`SGST @ ${halfPct}%`, inv.sgst_amount)}
              </>
            )}
          {Number(inv.round_off) !== 0 && sumRow('Round off', inv.round_off)}
          <tr>
            <td style={{ ...head, textAlign: 'right', fontSize: 14 }} colSpan={4}>Total</td>
            <td style={{ ...head, textAlign: 'right', fontSize: 14 }}>₹{money(inv.total_amount)}</td>
          </tr>
          {Number(inv.amount_paid) > 0 && sumRow('Paid', inv.amount_paid)}
          {Number(inv.amount_paid) > 0 && sumRow('Balance due', inv.balance_amount, true)}
        </tbody>
      </table>
      <p style={{ fontSize: 12, marginTop: 8 }}>
        <b>Amount in words:</b> {amountInWords(Number(inv.total_amount))}
      </p>

      <section style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 12 }}>
        {s.bank_details && (
          <div style={{ flex: 1, border: '1px solid #dfe5e2', borderRadius: 6, padding: 10 }}>
            <b>Bank details</b>
            <div style={{ whiteSpace: 'pre-line' }}>{s.bank_details}</div>
          </div>
        )}
        <div style={{ flex: 1, textAlign: 'right', paddingTop: 40 }}>
          For <b>{s.company_name}</b>
          <div style={{ marginTop: 30, color: '#6b7280' }}>Authorised signatory</div>
        </div>
      </section>

      {(inv.notes || inv.terms) && (
        <section style={{ marginTop: 16, fontSize: 11, color: '#4b5563' }}>
          {inv.notes && <p style={{ whiteSpace: 'pre-line' }}><b>Notes:</b> {inv.notes}</p>}
          {inv.terms && <p style={{ whiteSpace: 'pre-line' }}><b>Terms:</b> {inv.terms}</p>}
        </section>
      )}
      <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 16, textAlign: 'center' }}>This is a computer-generated invoice.</p>
    </article>
  );
}
