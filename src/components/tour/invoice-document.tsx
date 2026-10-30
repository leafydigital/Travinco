/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { TourSettings, InvoiceSettings } from '@/lib/tour/types';
import { DEFAULT_INVOICE_SETTINGS } from '@/lib/tour/types';

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
  markup_pct?: number | null;
  markup_amount?: number | null;
};

const money = (n: number) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const d = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
};

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
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
  if (rupees === 0 && paise === 0) return 'ZERO RUPEES ONLY';
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1e7);
  const lakh = Math.floor((rupees % 1e7) / 1e5);
  const thousand = Math.floor((rupees % 1e5) / 1e3);
  const rest = rupees % 1e3;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return `${parts.join(' ')} Rupees${paise ? ` and ${two(paise)} Paise` : ''} Only`.toUpperCase();
}

const BLUE = '#0284c7';
const LIGHT_BLUE = '#f0f9ff';

export function InvoiceDocument({
  inv,
  s,
  logoUrl = '/brand/travinco-logo.png',
}: {
  inv: InvoiceDoc;
  s: TourSettings;
  logoUrl?: string;
}) {
  const cfg: InvoiceSettings = s.invoice_settings || DEFAULT_INVOICE_SETTINGS;
  const signatureUrl = cfg.signature_url || '/brand/signature.png';

  // Build UPI URI encoding invoice total balance amount
  const upiId = cfg.bank_upi_id || 'travinco1@fdl';
  const accName = cfg.bank_account_name || s.company_name || 'Travinco Travel Solutions';
  const totalAmt = Number(inv.total_amount) || 0;
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(accName)}&am=${totalAmt.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${inv.invoice_number}`)}`;

  const [qrSrc, setQrSrc] = useState<string>(
    cfg.custom_qr_url
      ? cfg.custom_qr_url
      : `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUri)}`
  );

  useEffect(() => {
    let active = true;
    if (cfg.custom_qr_url) {
      setQrSrc(cfg.custom_qr_url);
      return;
    }

    QRCode.toDataURL(upiUri, {
      width: 150,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrSrc(url);
      })
      .catch((err) => {
        console.warn('Could not generate client QR data URL, fallback in place:', err);
      });

    return () => {
      active = false;
    };
  }, [upiUri, cfg.custom_qr_url]);

  // Line items formatting: ensure the invoice always shows the total price everywhere
  const rawItems = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [];

  let items: { description: string; sac: string; qty: number; rate: number; amount: number }[] = [];

  if (rawItems.length === 0) {
    items = [
      {
        description: `Land Package Services for Kerala Tour${inv.travel_start ? `\nFrom ${d(inv.travel_start)} to ${d(inv.travel_end)} Inclusive of all taxes` : ' Inclusive of all taxes'}`,
        sac: s.sac_code || '998555',
        qty: 1,
        rate: totalAmt,
        amount: totalAmt,
      },
    ];
  } else if (rawItems.length === 1 && rawItems[0]) {
    const it = rawItems[0];
    const qty = Number(it.qty) || 1;
    items = [
      {
        description: it.description,
        sac: it.sac || s.sac_code || '998555',
        qty: qty,
        rate: qty > 0 ? Math.round((totalAmt / qty) * 100) / 100 : totalAmt,
        amount: totalAmt,
      },
    ];
  } else {
    // If multiple items, ensure their sum matches totalAmt; if not, scale them so the sum equals totalAmt
    const currentSum = rawItems.reduce(
      (acc, it) => acc + (Number(it.amount) || (Number(it.rate) || 0) * (Number(it.qty) || 1)),
      0
    );
    if (currentSum > 0 && Math.abs(currentSum - totalAmt) > 0.5) {
      const scale = totalAmt / currentSum;
      let running = 0;
      items = rawItems.map((it, idx) => {
        const isLast = idx === rawItems.length - 1;
        const qty = Number(it.qty) || 1;
        const itemAmt = isLast
          ? Math.round((totalAmt - running) * 100) / 100
          : Math.round((Number(it.amount) || (Number(it.rate) || 0) * qty) * scale * 100) / 100;
        running += itemAmt;
        return {
          description: it.description,
          sac: it.sac || s.sac_code || '998555',
          qty: qty,
          rate: qty > 0 ? Math.round((itemAmt / qty) * 100) / 100 : itemAmt,
          amount: itemAmt,
        };
      });
    } else {
      items = rawItems.map((it) => ({
        description: it.description,
        sac: it.sac || s.sac_code || '998555',
        qty: Number(it.qty) || 1,
        rate: Number(it.rate) || 0,
        amount: Number(it.amount) || (Number(it.rate) || 0) * (Number(it.qty) || 1),
      }));
    }
  }

  const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);

  return (
    <article
      id="invoice-doc"
      className="mx-auto max-w-[840px] bg-white p-6 sm:p-10 text-ink-900 print:max-w-none print:p-0"
      style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 12.5, lineHeight: 1.4 }}
    >
      {/* 1. Header (Logo left, Company Address center, Contact right) */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <div style={{ flex: '0 0 auto', width: 200 }}>
          <img
            src={logoUrl}
            alt={s.company_name || 'Travinco'}
            crossOrigin="anonymous"
            style={{ height: 46, maxWidth: 190, objectFit: 'contain' }}
          />
        </div>

        <div style={{ flex: 1, textAlign: 'center', fontSize: 11.5, color: '#1f2937', lineHeight: 1.35 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>
            {s.company_name || 'Travinco'}
          </div>
          {s.company_address ? (
            <div style={{ whiteSpace: 'pre-line' }}>{s.company_address}</div>
          ) : (
            <div>
              1st Floor, Muthassi Building,<br />
              Mannamoola, Peroorkada<br />
              Trivandrum, Kerala - 695005
            </div>
          )}
        </div>

        <div style={{ flex: '0 0 auto', textAlign: 'right', fontSize: 11.5, color: '#1f2937', lineHeight: 1.4 }}>
          <div>
            <span style={{ color: '#4b5563' }}>Name :</span>{' '}
            <b>C/O {s.company_name || 'Travinco Travel Solutions'}</b>
          </div>
          <div>
            <span style={{ color: '#4b5563' }}>Phone :</span>{' '}
            <b>{s.company_phone || '7025549224'}</b>
          </div>
          <div>
            <span style={{ color: '#4b5563' }}>Email :</span>{' '}
            <b>{s.company_email || 'info@travinco.com'}</b>
          </div>
          <div>
            <span style={{ color: '#4b5563' }}>Website :</span>{' '}
            <b>{s.company_website || 'www.travinco.com'}</b>
          </div>
        </div>
      </header>

      {/* 2. Main Box with Blue Border */}
      <div style={{ border: `1.5px solid ${BLUE}`, borderRadius: 2, overflow: 'hidden' }}>
        {/* Title Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderBottom: `1.5px solid ${BLUE}`,
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ width: 140 }} />
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: BLUE,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            TAX INVOICE
          </div>
          <div style={{ width: 140, textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: '#1f2937' }}>
            {inv.status === 'cancelled' ? (
              <span style={{ color: '#dc2626', fontWeight: 800 }}>CANCELLED</span>
            ) : (
              'ORIGINAL FOR RECIPIENT'
            )}
          </div>
        </div>

        {/* Customer & Invoice Meta Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', borderBottom: `1.5px solid ${BLUE}` }}>
          {/* Customer Details (Left) */}
          <div style={{ borderRight: `1.5px solid ${BLUE}` }}>
            <div
              style={{
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 11.5,
                color: '#1e3a8a',
                padding: '4px 8px',
                borderBottom: `1px solid ${BLUE}`,
                backgroundColor: LIGHT_BLUE,
              }}
            >
              Customer Detail
            </div>
            <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', width: 110, color: '#374151', fontWeight: 600 }}>Name</td>
                  <td style={{ padding: '4px 8px', fontWeight: 700, color: '#0f172a' }}>{inv.bill_to_name}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: '#374151', fontWeight: 600, verticalAlign: 'top' }}>Address</td>
                  <td style={{ padding: '4px 8px', color: '#1f2937', whiteSpace: 'pre-line' }}>
                    {inv.bill_to_address || '—'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: '#374151', fontWeight: 600 }}>Phone</td>
                  <td style={{ padding: '4px 8px', color: '#1f2937' }}>{inv.bill_to_phone || '—'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: '#374151', fontWeight: 600 }}>GSTIN</td>
                  <td style={{ padding: '4px 8px', color: '#1f2937' }}>{inv.bill_to_gstin || '-'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: '#374151', fontWeight: 600 }}>Place of Supply</td>
                  <td style={{ padding: '4px 8px', color: '#1f2937', fontWeight: 600 }}>
                    {inv.place_of_supply || `${s.company_state || 'Kerala'} ( 32 )`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Invoice Meta (Right) */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${BLUE}` }}>
              <div style={{ padding: '6px 8px', borderRight: `1px solid ${BLUE}` }}>
                <span style={{ color: '#4b5563', fontSize: 11 }}>Invoice No.</span>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', marginTop: 1 }}>{inv.invoice_number}</div>
              </div>
              <div style={{ padding: '6px 8px' }}>
                <span style={{ color: '#4b5563', fontSize: 11 }}>Invoice Date</span>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a', marginTop: 1 }}>{d(inv.invoice_date)}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ padding: '6px 8px', borderRight: `1px solid ${BLUE}` }}>
                <span style={{ color: '#4b5563', fontSize: 11 }}>Due Date</span>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a', marginTop: 1 }}>
                  {inv.due_date ? d(inv.due_date) : d(inv.invoice_date)}
                </div>
              </div>
              <div style={{ padding: '6px 8px' }}>
                {inv.quote_number && (
                  <>
                    <span style={{ color: '#4b5563', fontSize: 11 }}>Quotation Ref</span>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a', marginTop: 1 }}>{inv.quote_number}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: LIGHT_BLUE, borderBottom: `1.5px solid ${BLUE}` }}>
              <th style={{ width: '6%', borderRight: `1px solid ${BLUE}`, padding: '6px 4px', textAlign: 'center', color: '#1e3a8a', fontWeight: 700 }}>
                Sr.<br />No.
              </th>
              <th style={{ width: '48%', borderRight: `1px solid ${BLUE}`, padding: '6px 8px', textAlign: 'center', color: '#1e3a8a', fontWeight: 700 }}>
                Name of Product / Service
              </th>
              <th style={{ width: '13%', borderRight: `1px solid ${BLUE}`, padding: '6px 4px', textAlign: 'center', color: '#1e3a8a', fontWeight: 700 }}>
                HSN / SAC
              </th>
              <th style={{ width: '9%', borderRight: `1px solid ${BLUE}`, padding: '6px 4px', textAlign: 'center', color: '#1e3a8a', fontWeight: 700 }}>
                Qty
              </th>
              <th style={{ width: '12%', borderRight: `1px solid ${BLUE}`, padding: '6px 6px', textAlign: 'center', color: '#1e3a8a', fontWeight: 700 }}>
                Rate
              </th>
              <th style={{ width: '12%', padding: '6px 6px', textAlign: 'center', color: '#1e3a8a', fontWeight: 700 }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} style={{ verticalAlign: 'top' }}>
                <td style={{ borderRight: `1px solid ${BLUE}`, padding: '10px 4px', textAlign: 'center', fontWeight: 600 }}>
                  {idx + 1}
                </td>
                <td style={{ borderRight: `1px solid ${BLUE}`, padding: '10px 8px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{it.description.split('\n')[0]}</div>
                  {it.description.includes('\n') && (
                    <div style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>
                      {it.description.split('\n').slice(1).join('\n')}
                    </div>
                  )}
                </td>
                <td style={{ borderRight: `1px solid ${BLUE}`, padding: '10px 4px', textAlign: 'center', color: '#374151' }}>
                  {it.sac || s.sac_code || '998555'}
                </td>
                <td style={{ borderRight: `1px solid ${BLUE}`, padding: '10px 4px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {Number(it.qty).toFixed(2)}
                </td>
                <td style={{ borderRight: `1px solid ${BLUE}`, padding: '10px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {money(it.rate)}
                </td>
                <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {money(it.amount)}
                </td>
              </tr>
            ))}

            {/* Spacer row to maintain official invoice tall layout */}
            <tr style={{ height: 160 }}>
              <td style={{ borderRight: `1px solid ${BLUE}` }}>&nbsp;</td>
              <td style={{ borderRight: `1px solid ${BLUE}` }}>&nbsp;</td>
              <td style={{ borderRight: `1px solid ${BLUE}` }}>&nbsp;</td>
              <td style={{ borderRight: `1px solid ${BLUE}` }}>&nbsp;</td>
              <td style={{ borderRight: `1px solid ${BLUE}` }}>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>

            {/* Total Row */}
            <tr style={{ borderTop: `1.5px solid ${BLUE}`, backgroundColor: '#ffffff', fontWeight: 700 }}>
              <td colSpan={3} style={{ borderRight: `1px solid ${BLUE}`, padding: '6px 12px', textAlign: 'right' }}>
                Total
              </td>
              <td style={{ borderRight: `1px solid ${BLUE}`, padding: '6px 4px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {totalQty.toFixed(2)}
              </td>
              <td style={{ borderRight: `1px solid ${BLUE}`, padding: '6px 6px', textAlign: 'right' }}>
                {/* Empty */}
              </td>
              <td style={{ padding: '6px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {money(inv.total_amount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 4. Total In Words & Total Amount Box */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', borderTop: `1.5px solid ${BLUE}`, borderBottom: `1.5px solid ${BLUE}` }}>
          {/* Left: Total in words */}
          <div style={{ borderRight: `1.5px solid ${BLUE}`, padding: '8px 12px', textAlign: 'center', backgroundColor: '#fafafa' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>
              Total in words
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', letterSpacing: 0.3 }}>
              {amountInWords(Number(inv.total_amount))}
            </div>
          </div>

          {/* Right: Total Amount */}
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>Total Amount</span>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                ₹{money(inv.total_amount)}
              </span>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, color: '#6b7280', fontWeight: 700, marginTop: 4 }}>
              (E &amp; O.E.)
            </div>
          </div>
        </div>

        {/* 5. Bottom Section: Bank Details & QR (Left) | Verification & Signature (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr' }}>
          {/* Left Column: Bank Details & UPI QR Code & Terms */}
          <div style={{ borderRight: `1.5px solid ${BLUE}` }}>
            <div
              style={{
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 11.5,
                color: '#1e3a8a',
                padding: '4px 8px',
                borderBottom: `1px solid ${BLUE}`,
                backgroundColor: LIGHT_BLUE,
              }}
            >
              Bank Details
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', gap: 12 }}>
              <table style={{ fontSize: 11.5, borderCollapse: 'collapse', flex: 1 }}>
                <tbody>
                  <tr>
                    <td style={{ color: '#4b5563', padding: '2px 4px', width: 95 }}>Name</td>
                    <td style={{ fontWeight: 600, color: '#0f172a', padding: '2px 4px' }}>
                      {cfg.bank_name || 'Federal bank'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#4b5563', padding: '2px 4px' }}>Branch</td>
                    <td style={{ fontWeight: 600, color: '#0f172a', padding: '2px 4px' }}>
                      {cfg.bank_branch || 'Vattiyoorkavu'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#4b5563', padding: '2px 4px' }}>Acc. Name</td>
                    <td style={{ fontWeight: 600, color: '#0f172a', padding: '2px 4px' }}>
                      {cfg.bank_account_name || 'Travinco Travel Solutions'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#4b5563', padding: '2px 4px' }}>Acc. Number</td>
                    <td style={{ fontWeight: 700, color: '#0f172a', padding: '2px 4px', letterSpacing: 0.5, fontFamily: 'monospace' }}>
                      {cfg.bank_account_number || '22040200004059'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#4b5563', padding: '2px 4px' }}>IFSC</td>
                    <td style={{ fontWeight: 700, color: '#0f172a', padding: '2px 4px', fontFamily: 'monospace' }}>
                      {cfg.bank_ifsc || 'FDRL0002204'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#4b5563', padding: '2px 4px' }}>UPI ID</td>
                    <td style={{ fontWeight: 600, color: '#0f172a', padding: '2px 4px', fontFamily: 'monospace', fontSize: 11 }}>
                      {cfg.bank_upi_id || 'travinco1@fdl'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Payment QR Code */}
              <div style={{ textAlign: 'center', flexShrink: 0, paddingRight: 4 }}>
                <img
                  src={qrSrc}
                  alt="Pay using UPI"
                  crossOrigin="anonymous"
                  style={{
                    height: 96,
                    width: 96,
                    objectFit: 'contain',
                    border: '1px solid #d1d5db',
                    padding: 2,
                    borderRadius: 3,
                    backgroundColor: '#ffffff',
                  }}
                />
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a', marginTop: 3 }}>
                  Pay using UPI
                </div>
              </div>
            </div>

            {/* Terms & Jurisdiction Strip */}
            <div
              style={{
                borderTop: `1px solid ${BLUE}`,
                padding: '6px 8px',
                fontSize: 9.5,
                color: '#4b5563',
                lineHeight: 1.3,
              }}
            >
              {cfg.terms_and_conditions ||
                'All bookings are subject to availability and standard cancellation policies. Guests must carry valid Passport and Visa during travel. Additional expenses arising due to delays, weather conditions, or unforeseen circumstances shall be borne by the traveler. Any dispute arising in connection with this booking shall be subject to the jurisdiction of courts in Thiruvananthapuram, Kerala, India'}
            </div>
          </div>

          {/* Right Column: Verification & Official Seal / Signature */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9.5, color: '#4b5563', lineHeight: 1.25 }}>
              {cfg.company_declaration || 'Certified that the particulars given above are true and correct.'}
            </div>

            <div style={{ marginTop: 4, fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
              For {s.company_name || 'Travinco'}
            </div>

            {/* Official Seal and Signature */}
            <div style={{ padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={signatureUrl}
                alt={cfg.authorized_signatory_label || 'Authorised Signatory'}
                crossOrigin="anonymous"
                style={{ height: 115, maxWidth: 220, objectFit: 'contain' }}
              />
            </div>

            <div
              style={{
                borderTop: `1px solid ${BLUE}`,
                paddingTop: 4,
                fontWeight: 700,
                fontSize: 11,
                color: '#0f172a',
              }}
            >
              {cfg.authorized_signatory_label || 'Authorised Signatory'}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
