'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import {
  Upload,
  Plus,
  Trash2,
  RotateCcw,
  Pencil,
  Image as ImageIcon,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Building2,
  ShieldCheck,
  Handshake,
  X,
} from 'lucide-react';
import { saveQuotationLogos, uploadQuotationLogo } from '@/lib/tour/master-actions';
import type { QuotationLogosConfig, QuotationLogoItem } from '@/lib/tour/types';
import { DEFAULT_QUOTATION_LOGOS } from '@/lib/tour/types';
import { ModalPortal } from '@/components/ui/modal-portal';

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-ink-950/50 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8 print:hidden"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="card w-full max-w-lg bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between border-b border-ink-100 pb-3">
            <h2 className="text-base font-bold text-ink-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-400 hover:bg-sand-100 hover:text-ink-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}

export function QuotationLogosEditor({
  initialConfig,
}: {
  initialConfig?: QuotationLogosConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [headerLogoUrl, setHeaderLogoUrl] = useState(
    initialConfig?.header_logo_url || DEFAULT_QUOTATION_LOGOS.header_logo_url || '/brand/travinco-logo.png'
  );
  const [tourLogoUrl, setTourLogoUrl] = useState(
    initialConfig?.tour_logo_url || DEFAULT_QUOTATION_LOGOS.tour_logo_url || '/brand/Tour_logo.jpg'
  );
  const [registeredTitle, setRegisteredTitle] = useState(
    initialConfig?.registered_title || DEFAULT_QUOTATION_LOGOS.registered_title || 'Registered with'
  );
  const [partnersTitle, setPartnersTitle] = useState(
    initialConfig?.partners_title || DEFAULT_QUOTATION_LOGOS.partners_title || 'Proud Booking partners of'
  );
  const [logos, setLogos] = useState<QuotationLogoItem[]>(
    initialConfig?.logos && initialConfig.logos.length > 0
      ? initialConfig.logos
      : DEFAULT_QUOTATION_LOGOS.logos
  );

  // Modal State for adding/editing a logo
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLogoId, setEditingLogoId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'registered' | 'partner' | 'other'>('registered');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // File input refs
  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const tourFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Header logo upload handler
  async function handleHeaderLogoUpload(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await uploadQuotationLogo(formData);
      if (res.error) {
        toast.error(res.error);
      } else if (res.url) {
        setHeaderLogoUrl(res.url);
        toast.success('Company header logo uploaded');
      }
    } catch {
      toast.error('Failed to upload logo image');
    } finally {
      setUploading(false);
    }
  }

  // Tour logo upload handler
  async function handleTourLogoUpload(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await uploadQuotationLogo(formData);
      if (res.error) {
        toast.error(res.error);
      } else if (res.url) {
        setTourLogoUrl(res.url);
        toast.success('Tourism logo uploaded');
      }
    } catch {
      toast.error('Failed to upload logo image');
    } finally {
      setUploading(false);
    }
  }

  // Generic logo upload in modal
  async function handleModalLogoUpload(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await uploadQuotationLogo(formData);
      if (res.error) {
        toast.error(res.error);
      } else if (res.url) {
        setFormImageUrl(res.url);
        if (!formName) {
          const autoName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          setFormName(autoName.charAt(0).toUpperCase() + autoName.slice(1));
        }
        toast.success('Logo uploaded');
      }
    } catch {
      toast.error('Failed to upload logo image');
    } finally {
      setUploading(false);
    }
  }

  function openAddModal(category: 'registered' | 'partner' = 'registered') {
    setEditingLogoId(null);
    setFormName('');
    setFormCategory(category);
    setFormSubtitle('');
    setFormImageUrl('');
    setModalOpen(true);
  }

  function openEditModal(logo: QuotationLogoItem) {
    setEditingLogoId(logo.id);
    setFormName(logo.name);
    setFormCategory(logo.category);
    setFormSubtitle(logo.subtitle || '');
    setFormImageUrl(logo.image_url);
    setModalOpen(true);
  }

  function handleSaveLogoModal() {
    if (!formName.trim()) {
      return toast.error('Please enter a logo name');
    }
    if (!formImageUrl.trim()) {
      return toast.error('Please upload a logo image or provide an image URL');
    }

    if (editingLogoId) {
      setLogos((prev) =>
        prev.map((l) =>
          l.id === editingLogoId
            ? {
                ...l,
                name: formName.trim(),
                category: formCategory,
                subtitle: formSubtitle.trim() || null,
                image_url: formImageUrl.trim(),
              }
            : l
        )
      );
      toast.success('Logo updated in list');
    } else {
      const newLogo: QuotationLogoItem = {
        id: `logo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: formName.trim(),
        category: formCategory,
        subtitle: formSubtitle.trim() || null,
        image_url: formImageUrl.trim(),
        is_active: true,
        sort_order: logos.length + 1,
      };
      setLogos((prev) => [...prev, newLogo]);
      toast.success('New logo added to list');
    }
    setModalOpen(false);
  }

  function toggleLogoActive(id: string) {
    setLogos((prev) =>
      prev.map((l) => (l.id === id ? { ...l, is_active: !l.is_active } : l))
    );
  }

  function deleteLogo(id: string) {
    setLogos((prev) => prev.filter((l) => l.id !== id));
    toast.success('Logo removed');
  }

  function handleResetToDefaults() {
    if (
      !window.confirm(
        'Reset all quotation logos to system defaults (Travinco, MSME, KTDC, ABAD, CGH Earth, Green Routes)?'
      )
    )
      return;
    setHeaderLogoUrl(DEFAULT_QUOTATION_LOGOS.header_logo_url || '/brand/travinco-logo.png');
    setTourLogoUrl(DEFAULT_QUOTATION_LOGOS.tour_logo_url || '/brand/Tour_logo.jpg');
    setRegisteredTitle(DEFAULT_QUOTATION_LOGOS.registered_title || 'Registered with');
    setPartnersTitle(DEFAULT_QUOTATION_LOGOS.partners_title || 'Proud Booking partners of');
    setLogos(DEFAULT_QUOTATION_LOGOS.logos);
    toast.success('Reset to default logos. Click "Save logo settings" to persist.');
  }

  function handleSaveAll() {
    const configToSave: QuotationLogosConfig = {
      header_logo_url: headerLogoUrl,
      tour_logo_url: tourLogoUrl,
      registered_title: registeredTitle.trim() || 'Registered with',
      partners_title: partnersTitle.trim() || 'Proud Booking partners of',
      logos,
    };

    startTransition(async () => {
      const res = await saveQuotationLogos(configToSave);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Quotation logos & branding saved successfully!');
        router.refresh();
      }
    });
  }

  const registeredLogos = logos.filter((l) => l.category === 'registered');
  const partnerLogos = logos.filter((l) => l.category === 'partner');
  const otherLogos = logos.filter((l) => l.category === 'other');

  return (
    <div className="card space-y-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-ink-900">
            Quotation Branding &amp; Partner Logos
          </h2>
          <p className="text-xs text-ink-500">
            These logos appear in the bottom trust footer of quotation previews and are automatically stamped on the bottom of every page in downloaded PDFs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="btn-outline text-xs"
            title="Restore default Travinco partner & accreditation logos"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={pending || uploading}
            className="btn-primary text-xs"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              'Save logo settings'
            )}
          </button>
        </div>
      </div>

      {/* 1. Header Branding Logos */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-800 flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-brand-600" /> Header Branding Logos
        </h3>
        <p className="text-xs text-ink-500 mb-4">
          The company logo appears at the top-left of every quotation and invoice. The tourism logo appears under the header line.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Company Header Logo */}
          <div className="rounded-xl border border-ink-200 p-4 bg-sand-50/50">
            <label className="label text-xs font-semibold">Company Logo (Header Left)</label>
            <div className="mt-2 flex items-center gap-4">
              <div className="flex h-14 w-32 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white p-1">
                {headerLogoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={headerLogoUrl}
                    alt="Company Logo Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-ink-300" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <input
                  type="text"
                  value={headerLogoUrl}
                  onChange={(e) => setHeaderLogoUrl(e.target.value)}
                  placeholder="/brand/travinco-logo.png or image URL"
                  className="input text-xs"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={headerFileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleHeaderLogoUpload(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => headerFileInputRef.current?.click()}
                    disabled={uploading}
                    className="btn-outline px-2.5 py-1 text-xs"
                  >
                    <Upload className="h-3 w-3" /> Upload image
                  </button>
                  {headerLogoUrl !== '/brand/travinco-logo.png' && (
                    <button
                      type="button"
                      onClick={() => setHeaderLogoUrl('/brand/travinco-logo.png')}
                      className="text-[11px] text-ink-500 hover:text-ink-800 underline"
                    >
                      Default
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tour/Tourism Logo */}
          <div className="rounded-xl border border-ink-200 p-4 bg-sand-50/50">
            <label className="label text-xs font-semibold">Tourism / Tour Logo</label>
            <div className="mt-2 flex items-center gap-4">
              <div className="flex h-14 w-28 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white p-1">
                {tourLogoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tourLogoUrl}
                    alt="Tour Logo Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-ink-300" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <input
                  type="text"
                  value={tourLogoUrl}
                  onChange={(e) => setTourLogoUrl(e.target.value)}
                  placeholder="/brand/Tour_logo.jpg or image URL"
                  className="input text-xs"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={tourFileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleTourLogoUpload(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => tourFileInputRef.current?.click()}
                    disabled={uploading}
                    className="btn-outline px-2.5 py-1 text-xs"
                  >
                    <Upload className="h-3 w-3" /> Upload image
                  </button>
                  {tourLogoUrl !== '/brand/Tour_logo.jpg' && (
                    <button
                      type="button"
                      onClick={() => setTourLogoUrl('/brand/Tour_logo.jpg')}
                      className="text-[11px] text-ink-500 hover:text-ink-800 underline"
                    >
                      Default
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Registered With Section */}
      <div className="border-t border-ink-100 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            <input
              type="text"
              value={registeredTitle}
              onChange={(e) => setRegisteredTitle(e.target.value)}
              className="font-semibold text-sm text-ink-900 border-b border-transparent hover:border-ink-300 focus:border-brand-500 focus:outline-none bg-transparent px-1 py-0.5 rounded"
              title="Click to edit section title"
            />
            <span className="text-xs text-ink-400">(Section Title)</span>
          </div>
          <button
            type="button"
            onClick={() => openAddModal('registered')}
            className="btn-outline px-2.5 py-1 text-xs text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add registration logo
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {registeredLogos.map((logo) => (
            <div
              key={logo.id}
              className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                logo.is_active
                  ? 'border-ink-200 bg-white shadow-2xs'
                  : 'border-ink-200/50 bg-ink-50/50 opacity-60'
              }`}
            >
              <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-ink-100 bg-sand-50/40 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.image_url}
                  alt={logo.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-semibold text-ink-900">{logo.name}</p>
                {logo.subtitle ? (
                  <p className="truncate text-[11px] text-ink-500">{logo.subtitle}</p>
                ) : (
                  <p className="text-[11px] text-ink-400 italic">No subtitle</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleLogoActive(logo.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    logo.is_active
                      ? 'text-brand-600 hover:bg-brand-50'
                      : 'text-ink-400 hover:bg-ink-100'
                  }`}
                  title={logo.is_active ? 'Active (Click to hide)' : 'Hidden (Click to show)'}
                >
                  {logo.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(logo)}
                  className="p-1.5 text-ink-500 hover:text-ink-800 hover:bg-ink-100 rounded-lg"
                  title="Edit logo"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteLogo(logo.id)}
                  className="p-1.5 text-coral-500 hover:text-coral-700 hover:bg-coral-50 rounded-lg"
                  title="Delete logo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {registeredLogos.length === 0 && (
            <div className="col-span-full py-4 text-center text-xs text-ink-400 border border-dashed border-ink-200 rounded-xl">
              No registration logos added yet. Click &quot;Add registration logo&quot; above.
            </div>
          )}
        </div>
      </div>

      {/* 3. Proud Booking Partners Section */}
      <div className="border-t border-ink-100 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-brand-600" />
            <input
              type="text"
              value={partnersTitle}
              onChange={(e) => setPartnersTitle(e.target.value)}
              className="font-semibold text-sm text-ink-900 border-b border-transparent hover:border-ink-300 focus:border-brand-500 focus:outline-none bg-transparent px-1 py-0.5 rounded"
              title="Click to edit section title"
            />
            <span className="text-xs text-ink-400">(Section Title)</span>
          </div>
          <button
            type="button"
            onClick={() => openAddModal('partner')}
            className="btn-outline px-2.5 py-1 text-xs text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add booking partner logo
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {partnerLogos.map((logo) => (
            <div
              key={logo.id}
              className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                logo.is_active
                  ? 'border-ink-200 bg-white shadow-2xs'
                  : 'border-ink-200/50 bg-ink-50/50 opacity-60'
              }`}
            >
              <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-ink-100 bg-sand-50/40 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.image_url}
                  alt={logo.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-semibold text-ink-900">{logo.name}</p>
                {logo.subtitle ? (
                  <p className="truncate text-[11px] text-ink-500">{logo.subtitle}</p>
                ) : (
                  <p className="text-[11px] text-ink-400 italic">No subtitle</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleLogoActive(logo.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    logo.is_active
                      ? 'text-brand-600 hover:bg-brand-50'
                      : 'text-ink-400 hover:bg-ink-100'
                  }`}
                  title={logo.is_active ? 'Active (Click to hide)' : 'Hidden (Click to show)'}
                >
                  {logo.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(logo)}
                  className="p-1.5 text-ink-500 hover:text-ink-800 hover:bg-ink-100 rounded-lg"
                  title="Edit logo"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteLogo(logo.id)}
                  className="p-1.5 text-coral-500 hover:text-coral-700 hover:bg-coral-50 rounded-lg"
                  title="Delete logo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {partnerLogos.length === 0 && (
            <div className="col-span-full py-4 text-center text-xs text-ink-400 border border-dashed border-ink-200 rounded-xl">
              No booking partner logos added yet. Click &quot;Add booking partner logo&quot; above.
            </div>
          )}
        </div>
      </div>

      {/* 4. Live Preview in Settings */}
      <div className="border-t border-ink-100 pt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
          Live Footer Preview (as shown at bottom of quotation &amp; each PDF page)
        </h3>
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-6 overflow-x-auto py-2">
            {/* Left preview: Registered */}
            <div className="flex-1 text-center min-w-[200px]">
              <div className="text-xs font-bold text-ink-800 mb-2">{registeredTitle}</div>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {registeredLogos
                  .filter((l) => l.is_active)
                  .map((l) => (
                    <div key={l.id} className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={l.image_url}
                        alt={l.name}
                        className="h-8 max-w-[80px] object-contain mx-auto"
                      />
                      {l.subtitle && (
                        <div className="text-[9px] text-ink-600 font-medium mt-0.5 whitespace-nowrap">
                          {l.subtitle}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div className="w-px h-12 bg-ink-200 shrink-0" />

            {/* Right preview: Partners */}
            <div className="flex-1 text-center min-w-[200px]">
              <div className="text-xs font-bold text-ink-800 mb-2">{partnersTitle}</div>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {partnerLogos
                  .filter((l) => l.is_active)
                  .map((l) => (
                    <div key={l.id} className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={l.image_url}
                        alt={l.name}
                        className="h-8 max-w-[90px] object-contain mx-auto"
                      />
                      {l.subtitle && (
                        <div className="text-[9px] text-ink-600 font-medium mt-0.5 whitespace-nowrap">
                          {l.subtitle}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={pending || uploading}
          className="btn-primary"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving settings…
            </>
          ) : (
            'Save logo settings'
          )}
        </button>
      </div>

      {/* Add / Edit Logo Modal Dialog */}
      {modalOpen && (
        <Dialog
          title={editingLogoId ? 'Edit Quotation Logo' : 'Add New Quotation Logo'}
          onClose={() => setModalOpen(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Logo Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. MSME, KTDC, Taj Hotels, etc."
                className="input"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Group / Category *</label>
                <select
                  value={formCategory}
                  onChange={(e) =>
                    setFormCategory(e.target.value as 'registered' | 'partner' | 'other')
                  }
                  className="input"
                >
                  <option value="registered">Registered with / Accreditations</option>
                  <option value="partner">Proud Booking Partners</option>
                  <option value="other">Other Brand Affiliation</option>
                </select>
              </div>

              <div>
                <label className="label">Subtitle / Registration # (Optional)</label>
                <input
                  type="text"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="e.g. Reg: KL-12-0120111 or Kerala Tourism"
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Logo Image *</label>
              <div className="mt-1 flex items-center gap-3">
                <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-sand-50/50 p-1">
                  {formImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={formImageUrl}
                      alt="Logo preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-ink-300" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="Enter image URL or upload file below"
                    className="input text-xs"
                  />
                  <div>
                    <input
                      type="file"
                      ref={logoFileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleModalLogoUpload(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      disabled={uploading}
                      className="btn-outline px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                    >
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {uploading ? 'Uploading…' : 'Upload from device'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-ink-100 pt-4 mt-6">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLogoModal}
                disabled={uploading}
                className="btn-primary"
              >
                <Check className="h-4 w-4" /> {editingLogoId ? 'Update Logo' : 'Add Logo'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
