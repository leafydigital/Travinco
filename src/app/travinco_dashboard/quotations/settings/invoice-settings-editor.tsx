/* eslint-disable @next/next/no-img-element */
'use client';

import {
  useState,
  useTransition,
  useEffect,
  useRef,
  createContext,
  useContext,
  type ReactNode,
  type ChangeEvent,
  type RefObject,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import {
  Building2,
  QrCode,
  Upload,
  Check,
  RefreshCw,
  Eye,
  FileSignature,
  FileText,
  HelpCircle,
} from 'lucide-react';
import type { InvoiceSettings } from '@/lib/tour/types';
import { DEFAULT_INVOICE_SETTINGS } from '@/lib/tour/types';
import {
  saveInvoiceSettings,
  uploadInvoiceSignature,
  uploadInvoiceQrCode,
} from '@/lib/tour/master-actions';

// -----------------------------------------------------------------------------
// Context Definition for Shared State between Editor & Live Preview
// -----------------------------------------------------------------------------
interface InvoiceSettingsContextType {
  settings: InvoiceSettings;
  update: (patch: Partial<InvoiceSettings>) => void;
  sampleQrDataUrl: string;
  pending: boolean;
  handleSave: () => void;
  handleReset: () => void;
  handleSignUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleQrUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  uploadingSign: boolean;
  uploadingQr: boolean;
  signFileRef: RefObject<HTMLInputElement>;
  qrFileRef: RefObject<HTMLInputElement>;
}

const InvoiceSettingsContext = createContext<InvoiceSettingsContextType | null>(null);

export function useInvoiceSettings() {
  const ctx = useContext(InvoiceSettingsContext);
  if (!ctx) {
    throw new Error('useInvoiceSettings must be used within an InvoiceSettingsProvider');
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Provider Component
// -----------------------------------------------------------------------------
export function InvoiceSettingsProvider({
  initialSettings,
  children,
}: {
  initialSettings?: InvoiceSettings;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [settings, setSettings] = useState<InvoiceSettings>(
    initialSettings || DEFAULT_INVOICE_SETTINGS
  );
  const [sampleQrDataUrl, setSampleQrDataUrl] = useState<string>('');
  const [uploadingSign, setUploadingSign] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const signFileRef = useRef<HTMLInputElement>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);

  // Generate sample QR code for preview
  useEffect(() => {
    let active = true;
    const upiId = settings.bank_upi_id || 'travinco1@fdl';
    const accName = settings.bank_account_name || 'Travinco Travel Solutions';
    const sampleAmount = '211000.00';
    const sampleInvoice = 'TRV364';

    if (settings.qr_code_mode === 'custom_image' && settings.custom_qr_url) {
      setSampleQrDataUrl(settings.custom_qr_url);
      return;
    }

    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
      accName
    )}&am=${sampleAmount}&cu=INR&tn=${encodeURIComponent(`Invoice ${sampleInvoice}`)}`;

    import('qrcode')
      .then((QRCodeModule) => {
        const QRCode = QRCodeModule.default || QRCodeModule;
        return QRCode.toDataURL(upiUri, {
          width: 140,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
      })
      .then((url) => {
        if (active) setSampleQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate sample QR code:', err);
      });

    return () => {
      active = false;
    };
  }, [
    settings.bank_upi_id,
    settings.bank_account_name,
    settings.qr_code_mode,
    settings.custom_qr_url,
  ]);

  const update = (patch: Partial<InvoiceSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = () => {
    start(async () => {
      const res = await saveInvoiceSettings(settings);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Invoice design and bank settings saved successfully!');
      router.refresh();
    });
  };

  const handleReset = () => {
    if (!window.confirm('Reset all invoice bank details and terms back to official defaults?'))
      return;
    setSettings(DEFAULT_INVOICE_SETTINGS);
    toast.info('Reset to default invoice configuration. Click "Save Invoice Settings" to confirm.');
  };

  const handleSignUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSign(true);
    const fd = new FormData();
    fd.append('file', file);

    const res = await uploadInvoiceSignature(fd);
    setUploadingSign(false);

    if (res?.error) {
      toast.error(res.error);
      return;
    }
    if (res?.url) {
      update({ signature_url: res.url });
      toast.success('Signature image uploaded!');
    }
  };

  const handleQrUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingQr(true);
    const fd = new FormData();
    fd.append('file', file);

    const res = await uploadInvoiceQrCode(fd);
    setUploadingQr(false);

    if (res?.error) {
      toast.error(res.error);
      return;
    }
    if (res?.url) {
      update({ custom_qr_url: res.url, qr_code_mode: 'custom_image' });
      toast.success('Custom QR code uploaded!');
    }
  };

  return (
    <InvoiceSettingsContext.Provider
      value={{
        settings,
        update,
        sampleQrDataUrl,
        pending,
        handleSave,
        handleReset,
        handleSignUpload,
        handleQrUpload,
        uploadingSign,
        uploadingQr,
        signFileRef,
        qrFileRef,
      }}
    >
      {children}
    </InvoiceSettingsContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Editor Form Component (Full Width Form Controls)
// -----------------------------------------------------------------------------
function InvoiceSettingsEditorForm() {
  const {
    settings,
    update,
    pending,
    handleSave,
    handleReset,
    handleSignUpload,
    handleQrUpload,
    uploadingSign,
    uploadingQr,
    signFileRef,
    qrFileRef,
  } = useInvoiceSettings();

  return (
    <div className="card space-y-6 p-5 sm:p-6 shadow-xs border border-ink-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-700" />
            <h2 className="text-lg font-semibold text-ink-900">
              Invoice Design, Bank &amp; QR Settings
            </h2>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Configure bank account particulars, dynamic amount-embedded UPI QR code, official seal,
            and terms shown on the tax invoice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="btn-outline h-8 text-xs text-ink-600 hover:text-ink-900"
            disabled={pending}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="btn-primary h-8 text-xs font-semibold"
          >
            {pending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" /> Save Invoice Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Form Fields Body */}
      <div className="space-y-5">
        {/* Bank Details Section */}
        <div className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-sky-700" />
              <h3 className="text-sm font-semibold text-sky-950">Bank Account Details</h3>
            </div>
            <span className="text-[11px] font-medium text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded-full">
              Printed on invoice
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label text-xs" htmlFor="inv-bname">
                Bank Name
              </label>
              <input
                id="inv-bname"
                type="text"
                className="input h-9 text-xs bg-white"
                value={settings.bank_name}
                onChange={(e) => update({ bank_name: e.target.value })}
                placeholder="e.g. Federal bank"
              />
            </div>
            <div>
              <label className="label text-xs" htmlFor="inv-branch">
                Branch
              </label>
              <input
                id="inv-branch"
                type="text"
                className="input h-9 text-xs bg-white"
                value={settings.bank_branch}
                onChange={(e) => update({ bank_branch: e.target.value })}
                placeholder="e.g. Vattiyoorkavu"
              />
            </div>
            <div>
              <label className="label text-xs" htmlFor="inv-accname">
                Account Name
              </label>
              <input
                id="inv-accname"
                type="text"
                className="input h-9 text-xs bg-white"
                value={settings.bank_account_name}
                onChange={(e) => update({ bank_account_name: e.target.value })}
                placeholder="e.g. Travinco Travel Solutions"
              />
            </div>
            <div>
              <label className="label text-xs" htmlFor="inv-accnum">
                Account Number
              </label>
              <input
                id="inv-accnum"
                type="text"
                className="input h-9 text-xs font-mono bg-white"
                value={settings.bank_account_number}
                onChange={(e) => update({ bank_account_number: e.target.value })}
                placeholder="e.g. 22040200004059"
              />
            </div>
            <div>
              <label className="label text-xs" htmlFor="inv-ifsc">
                IFSC Code
              </label>
              <input
                id="inv-ifsc"
                type="text"
                className="input h-9 text-xs font-mono uppercase bg-white"
                value={settings.bank_ifsc}
                onChange={(e) => update({ bank_ifsc: e.target.value.toUpperCase() })}
                placeholder="e.g. FDRL0002204"
              />
            </div>
            <div>
              <label className="label text-xs" htmlFor="inv-upi">
                UPI ID (VPA)
              </label>
              <input
                id="inv-upi"
                type="text"
                className="input h-9 text-xs font-mono bg-white"
                value={settings.bank_upi_id}
                onChange={(e) => update({ bank_upi_id: e.target.value })}
                placeholder="e.g. travinco1@fdl"
              />
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="rounded-xl border border-ink-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-semibold text-ink-900">Payment QR Code</h3>
            </div>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Auto-generates with amount
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="qr_mode"
                  checked={settings.qr_code_mode === 'dynamic_upi'}
                  onChange={() => update({ qr_code_mode: 'dynamic_upi' })}
                  className="text-brand-700"
                />
                <span>
                  <strong className="text-ink-900">Dynamic UPI QR Code</strong> (Recommended)
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="qr_mode"
                  checked={settings.qr_code_mode === 'custom_image'}
                  onChange={() => update({ qr_code_mode: 'custom_image' })}
                  className="text-brand-700"
                />
                <span>
                  <strong className="text-ink-900">Custom QR Image</strong>
                </span>
              </label>
            </div>

            {settings.qr_code_mode === 'dynamic_upi' ? (
              <div className="rounded-lg bg-emerald-50/50 p-3 text-xs text-emerald-900 border border-emerald-100">
                <p className="flex items-start gap-1.5 leading-relaxed">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>
                    Each invoice automatically renders a real-time UPI QR code encoding the recipient
                    UPI ID (<strong>{settings.bank_upi_id || 'travinco1@fdl'}</strong>) and the
                    exact invoice balance amount. When guests scan with GPay / PhonePe / Paytm, the
                    payment amount is pre-filled automatically!
                  </span>
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-ink-200 bg-ink-50/50 p-3">
                <label className="label text-xs">Upload Custom QR Code Image</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={qrFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleQrUpload}
                  />
                  <button
                    type="button"
                    onClick={() => qrFileRef.current?.click()}
                    disabled={uploadingQr}
                    className="btn-outline h-8 text-xs bg-white"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingQr ? 'Uploading…' : 'Choose QR image'}
                  </button>
                  {settings.custom_qr_url && (
                    <span className="truncate text-xs text-ink-500 font-mono">
                      {settings.custom_qr_url.split('/').pop()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stamp & Authorised Signatory Section */}
        <div className="rounded-xl border border-ink-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-purple-700" />
              <h3 className="text-sm font-semibold text-ink-900">Official Stamp &amp; Signature</h3>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 items-start">
            {/* Signature Preview & Change Seal button below the sign image */}
            <div>
              <label className="label text-xs mb-1.5">Official Signature / Seal</label>
              <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-ink-200 bg-sand-50/30 p-3.5 text-center">
                <div className="flex h-24 w-48 items-center justify-center rounded-lg bg-white border border-ink-200/80 p-2 shadow-2xs">
                  <img
                    src={settings.signature_url || '/brand/signature.png'}
                    alt="Official Signature / Seal"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <input
                  ref={signFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSignUpload}
                />

                {/* Change Seal Button BELOW the sign image */}
                <button
                  type="button"
                  onClick={() => signFileRef.current?.click()}
                  disabled={uploadingSign}
                  className="btn-outline inline-flex items-center justify-center gap-1.5 h-8 px-4 text-xs font-semibold bg-white hover:bg-sand-50 w-full max-w-[200px] shadow-2xs cursor-pointer"
                  title="Upload a new official seal or signature image"
                >
                  <Upload className="h-3.5 w-3.5 text-brand-600" />
                  <span>{uploadingSign ? 'Uploading…' : 'Change Seal'}</span>
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-400">
                Supports PNG, JPEG with transparent background for crisp document printing.
              </p>
            </div>

            {/* Signatory Labels */}
            <div className="space-y-3">
              <div>
                <label className="label text-xs" htmlFor="inv-siglabel">
                  Signatory Label
                </label>
                <input
                  id="inv-siglabel"
                  type="text"
                  className="input h-9 text-xs"
                  value={settings.authorized_signatory_label}
                  onChange={(e) => update({ authorized_signatory_label: e.target.value })}
                  placeholder="Authorised Signatory"
                />
              </div>

              <div>
                <label className="label text-xs" htmlFor="inv-decl">
                  Declaration Note
                </label>
                <input
                  id="inv-decl"
                  type="text"
                  className="input h-9 text-xs"
                  value={settings.company_declaration}
                  onChange={(e) => update({ company_declaration: e.target.value })}
                  placeholder="Certified that the particulars given above are true and correct."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Jurisdiction Section */}
        <div className="rounded-xl border border-ink-100 bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-ink-700" />
            <h3 className="text-sm font-semibold text-ink-900">Terms &amp; Jurisdiction</h3>
          </div>
          <textarea
            rows={4}
            className="input text-xs leading-relaxed"
            value={settings.terms_and_conditions}
            onChange={(e) => update({ terms_and_conditions: e.target.value })}
            placeholder="Booking and cancellation terms printed on the invoice footer…"
          />
        </div>

        {/* Bottom Save Action */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="btn-primary h-9 px-5 text-xs font-semibold"
          >
            {pending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Save Invoice Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Live Preview Component (Rendered in the Right Column)
// -----------------------------------------------------------------------------
export function BankDetailsLivePreview() {
  const { settings, sampleQrDataUrl } = useInvoiceSettings();

  return (
    <div className="card overflow-hidden shadow-xs border border-ink-200">
      {/* Card Header */}
      <div className="border-b border-ink-100 bg-sand-50/60 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-ink-900">Bank Details Live Preview</h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
            <RefreshCw className="h-3 w-3 text-emerald-600" /> Real-time Sync
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          Responsive live preview of the payment particulars and declaration printed on customer
          invoices.
        </p>
      </div>

      <div className="p-3.5 sm:p-4 space-y-3">
        {/* Authentic Invoice Footer Document Strip */}
        <div className="rounded-xl border-2 border-sky-600 bg-white shadow-sm text-xs font-sans text-ink-900 overflow-hidden">
          {/* Top Bar: Total In Words & Total Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] border-b border-sky-600 font-medium">
            <div className="border-b sm:border-b-0 sm:border-r border-sky-600 p-2 text-center bg-sky-50/20">
              <div className="text-[10px] font-semibold text-ink-600 uppercase tracking-wider">
                Total in words
              </div>
              <div className="text-xs font-bold text-ink-950 mt-0.5">
                TWO LAKH ELEVEN THOUSAND RUPEES ONLY
              </div>
            </div>
            <div className="p-2 sm:px-4 bg-sky-50/40 flex flex-col justify-center text-center sm:text-right shrink-0">
              <div className="flex items-center justify-between sm:justify-end gap-3">
                <span className="text-[11px] font-semibold text-ink-700">Total Amount:</span>
                <span className="text-sm font-extrabold text-ink-950">₹2,11,000.00</span>
              </div>
              <div className="text-[9px] text-ink-500 font-bold">(E &amp; O.E.)</div>
            </div>
          </div>

          {/* Middle Section: Bank Details & QR (Left) | Verification & Signature (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_150px] border-b border-sky-600 divide-y md:divide-y-0 md:divide-x divide-sky-600">
            {/* Left Column: Bank Particulars & QR Code */}
            <div className="p-3 space-y-2.5">
              <div className="text-center font-bold text-xs text-sky-950 pb-1 border-b border-sky-200">
                Bank Details
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 pt-0.5">
                {/* Bank Fields Table */}
                <table className="w-full text-[11px] leading-tight">
                  <tbody>
                    <tr>
                      <td className="text-ink-500 pr-2 py-0.5 font-medium whitespace-nowrap w-20">
                        Name
                      </td>
                      <td className="font-semibold text-ink-900 break-words">
                        {settings.bank_name || 'Federal bank'}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-ink-500 pr-2 py-0.5 font-medium whitespace-nowrap">
                        Branch
                      </td>
                      <td className="font-semibold text-ink-900 break-words">
                        {settings.bank_branch || 'Vattiyoorkavu'}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-ink-500 pr-2 py-0.5 font-medium whitespace-nowrap">
                        Acc. Name
                      </td>
                      <td className="font-semibold text-ink-900 break-words">
                        {settings.bank_account_name || 'Travinco Travel Solutions'}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-ink-500 pr-2 py-0.5 font-medium whitespace-nowrap">
                        Acc. Number
                      </td>
                      <td className="font-bold text-ink-950 font-mono tracking-wider break-all">
                        {settings.bank_account_number || '22040200004059'}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-ink-500 pr-2 py-0.5 font-medium whitespace-nowrap">
                        IFSC
                      </td>
                      <td className="font-bold text-ink-950 font-mono tracking-wider">
                        {settings.bank_ifsc || 'FDRL0002204'}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-ink-500 pr-2 py-0.5 font-medium whitespace-nowrap">
                        UPI ID
                      </td>
                      <td className="font-semibold text-emerald-800 font-mono text-[10.5px] break-all">
                        {settings.bank_upi_id || 'travinco1@fdl'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center shrink-0 p-1.5 rounded-lg border border-ink-100 bg-sand-50/40 text-center">
                  {sampleQrDataUrl ? (
                    <img
                      src={sampleQrDataUrl}
                      alt="Pay using UPI"
                      className="h-20 w-20 object-contain rounded bg-white p-0.5 border border-ink-200"
                    />
                  ) : (
                    <div className="h-20 w-20 border border-dashed border-ink-300 flex items-center justify-center text-[10px] text-ink-400">
                      Generating…
                    </div>
                  )}
                  <span className="text-[10px] font-bold text-sky-950 mt-1">Pay using UPI</span>
                </div>
              </div>
            </div>

            {/* Right Column: Signature & Official Seal */}
            <div className="p-3 flex flex-col justify-between text-center bg-white space-y-2">
              <div className="text-[9.5px] text-ink-500 leading-snug">
                {settings.company_declaration ||
                  'Certified that the particulars given above are true and correct.'}
              </div>

              <div className="text-xs font-bold text-sky-950">For Travinco</div>

              <div className="py-1 flex items-center justify-center min-h-[88px]">
                <img
                  src={settings.signature_url || '/brand/signature.png'}
                  alt="Official Seal / Authorised Signatory"
                  className="max-h-24 max-w-[180px] object-contain mx-auto"
                />
              </div>

              <div className="border-t border-sky-400 pt-1 text-[11px] font-bold text-ink-900">
                {settings.authorized_signatory_label || 'Authorised Signatory'}
              </div>
            </div>
          </div>

          {/* Bottom Strip: Terms & Conditions */}
          <div className="p-2.5 bg-sand-50/20 text-[10px] leading-relaxed text-ink-600 max-h-28 overflow-y-auto">
            {settings.terms_and_conditions ||
              'All bookings are subject to availability and standard cancellation policies. Guests must carry valid Passport and Visa during travel.'}
          </div>
        </div>

        {/* Informative Guidance Note */}
        <div className="rounded-lg bg-sky-50/70 p-2.5 text-[11px] text-sky-900 border border-sky-200/80 flex items-start gap-1.5 leading-snug">
          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-sky-600 mt-0.5" />
          <span>
            Edits made in the Bank &amp; Invoice Settings on the left reflect here in real-time.
            Click <b>Save Invoice Settings</b> to commit changes.
          </span>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Export (Works standalone or inside InvoiceSettingsProvider)
// -----------------------------------------------------------------------------
export function InvoiceSettingsEditor({
  initialSettings,
}: {
  initialSettings?: InvoiceSettings;
}) {
  const context = useContext(InvoiceSettingsContext);

  if (!context) {
    return (
      <InvoiceSettingsProvider initialSettings={initialSettings}>
        <InvoiceSettingsEditorForm />
      </InvoiceSettingsProvider>
    );
  }

  return <InvoiceSettingsEditorForm />;
}
