'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  X,
  Loader2,
  FileSpreadsheet,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { bulkCreatePackages, type BulkPackageInput } from './actions';
import { uploadPackageImage } from './upload-actions';
import { packageCategories } from '@/lib/validations/package';
import { ModalPortal } from '@/components/ui/modal-portal';

export type DestinationOption = { id: string; name: string };

type PackageRow = {
  id: string;
  title: string;
  destination_id: string;
  category: (typeof packageCategories)[number];
  duration_days: number;
  duration_nights: number;
  base_price: number | '';
  discount_price: number | '';
  status: 'draft' | 'published';
  short_description: string;
  is_featured: boolean;
  cover_image_url?: string;
};

function createEmptyRow(): PackageRow {
  return {
    id: Math.random().toString(36).substring(2, 9),
    title: '',
    destination_id: '',
    category: 'family',
    duration_days: 3,
    duration_nights: 2,
    base_price: '',
    discount_price: '',
    status: 'draft',
    short_description: '',
    is_featured: false,
    cover_image_url: '',
  };
}

interface BulkCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinations: DestinationOption[];
  onSuccess?: () => void;
}

export function BulkCreateModal({
  isOpen,
  onClose,
  destinations,
  onSuccess,
}: BulkCreateModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'grid' | 'paste'>('grid');
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<PackageRow[]>([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);
  const [pasteText, setPasteText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);

  async function handleRowImageUpload(index: number, file: File) {
    const row = rows[index];
    if (!row) return;
    setUploadingRowId(row.id);
    const formData = new FormData();
    formData.set('file', file);
    const res = await uploadPackageImage(formData);
    if (res.error) {
      toast.error(res.error);
    } else if (res.url) {
      updateRow(index, 'cover_image_url', res.url);
      toast.success('Cover image uploaded');
    }
    setUploadingRowId(null);
  }

  if (!isOpen) return null;

  function updateRow<K extends keyof PackageRow>(index: number, field: K, value: PackageRow[K]) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };
        // Auto-adjust nights when days changes if nights was 1 less than old days
        if (field === 'duration_days' && typeof value === 'number') {
          if (row.duration_nights === Math.max(0, row.duration_days - 1)) {
            updated.duration_nights = Math.max(0, value - 1);
          }
        }
        return updated;
      })
    );
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  function addMultipleRows(count: number) {
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => createEmptyRow()),
    ]);
  }

  function duplicateRow(index: number) {
    setRows((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const clone: PackageRow = {
        ...source,
        id: Math.random().toString(36).substring(2, 9),
        title: source.title ? `${source.title} (Copy)` : '',
        destination_id: source.destination_id || '',
      };
      const copy = [...prev];
      copy.splice(index + 1, 0, clone);
      return copy;
    });
  }

  function removeRow(index: number) {
    if (rows.length <= 1) {
      setRows([createEmptyRow()]);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function clearEmptyRows() {
    const valid = rows.filter((r) => r.title.trim().length > 0);
    setRows(valid.length > 0 ? valid : [createEmptyRow()]);
  }

  // Parse TSV / CSV pasted text from Excel or Google Sheets
  function handleParsePaste() {
    if (!pasteText.trim()) return;

    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const parsedRows: PackageRow[] = [];

    for (const line of lines) {
      // Split by tab (Excel/Google Sheets default) or comma
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      const title = parts[0]?.trim() || '';
      if (!title) continue;

      const destText = parts[1]?.trim()?.toLowerCase() || '';
      const matchedDest = destinations.find(
        (d) => d.name.toLowerCase() === destText || destText.includes(d.name.toLowerCase())
      );

      const days = parseInt(parts[2]?.trim() || '3', 10) || 3;
      const nights = parseInt(parts[3]?.trim() || String(Math.max(0, days - 1)), 10) || Math.max(0, days - 1);
      const price = parseFloat(parts[4]?.replace(/[^0-9.]/g, '') || '0') || 0;
      
      const rawCat = parts[5]?.trim()?.toLowerCase() || 'family';
      const cat = (packageCategories as readonly string[]).includes(rawCat)
        ? (rawCat as (typeof packageCategories)[number])
        : 'family';

      parsedRows.push({
        id: Math.random().toString(36).substring(2, 9),
        title,
        destination_id: matchedDest ? matchedDest.id : '',
        category: cat,
        duration_days: days,
        duration_nights: nights,
        base_price: price > 0 ? price : '',
        discount_price: '',
        status: 'draft',
        short_description: '',
        is_featured: false,
      });
    }

    if (parsedRows.length > 0) {
      // Filter out empty rows from current state and append parsed ones
      setRows((prev) => {
        const existing = prev.filter((r) => r.title.trim().length > 0);
        return [...existing, ...parsedRows];
      });
      toast.success(`Imported ${parsedRows.length} packages from spreadsheet!`);
      setActiveTab('grid');
      setPasteText('');
    } else {
      toast.error('No valid rows found. Please check the pasted format.');
    }
  }

  // Submit all valid rows in bulk
  function handleBulkSave() {
    setFormError(null);

    const validRows = rows.filter((r) => r.title.trim().length > 0);
    if (validRows.length === 0) {
      setFormError('Please enter at least one package with a title.');
      return;
    }

    // Check for short titles
    const invalidTitle = validRows.find((r) => r.title.trim().length < 3);
    if (invalidTitle) {
      setFormError(`"${invalidTitle.title}" is too short. Package titles must be at least 3 characters.`);
      return;
    }

    const payload: BulkPackageInput[] = validRows.map((r) => ({
      title: r.title.trim(),
      destination_id: r.destination_id || null,
      category: r.category,
      duration_days: Math.max(1, r.duration_days),
      duration_nights: Math.max(0, r.duration_nights),
      base_price: typeof r.base_price === 'number' ? r.base_price : 0,
      discount_price: typeof r.discount_price === 'number' && r.discount_price > 0 ? r.discount_price : null,
      status: r.status,
      short_description: r.short_description || null,
      is_featured: r.is_featured,
      cover_image_url: r.cover_image_url || null,
      imageUrls: r.cover_image_url ? [r.cover_image_url] : [],
    }));

    startTransition(async () => {
      const res = await bulkCreatePackages(payload);
      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
      } else {
        toast.success(`Successfully saved ${res.count ?? validRows.length} packages in bulk!`);
        router.refresh();
        if (onSuccess) onSuccess();
        onClose();
      }
    });
  }

  const validCount = rows.filter((r) => r.title.trim().length > 0).length;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
        <div className="flex flex-col w-full max-w-6xl max-h-[92vh] bg-white rounded-2xl shadow-lg shadow-ink-900/5 border border-ink-100 overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-ink-100 px-5 sm:px-6 py-4 bg-ink-50/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-2xs">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-ink-900">Bulk Create Packages</h2>
                  <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                    Batch Mode
                  </span>
                </div>
                <p className="text-xs text-ink-500">
                  Quickly add multiple tour packages to your catalog at once.
                </p>
              </div>
            </div>
  
            <div className="flex items-center gap-2">
              {/* View Mode Tabs */}
              <div className="flex items-center rounded-lg bg-ink-200/50 p-0.5 text-xs font-medium text-ink-600">
                <button
                  type="button"
                  onClick={() => setActiveTab('grid')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition cursor-pointer ${
                    activeTab === 'grid'
                      ? 'bg-white text-ink-900 font-semibold shadow-2xs'
                      : 'hover:text-ink-900'
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  <span>Table Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition cursor-pointer ${
                    activeTab === 'paste'
                      ? 'bg-white text-ink-900 font-semibold shadow-2xs'
                      : 'hover:text-ink-900'
                  }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Paste Spreadsheet</span>
                </button>
              </div>
  
              <Link
                href="/travinco_dashboard/packages/bulk"
                onClick={onClose}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 hover:border-brand-300 transition"
                title="Open full-page bulk creator with complete fields and itineraries"
              >
                <span>Full Page Mode</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
  
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
  
          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {formError && (
              <div className="flex items-center gap-2.5 rounded-xl border border-coral-200 bg-coral-50 p-3 text-xs text-coral-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-coral-600" />
                <span className="font-medium">{formError}</span>
              </div>
            )}
  
            {activeTab === 'grid' ? (
              <div className="space-y-4">
                {/* Grid Table Container */}
                <div className="border border-ink-150 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[940px]">
                      <thead className="bg-ink-50/80 border-b border-ink-100 uppercase tracking-wider text-[11px] font-semibold text-ink-600">
                        <tr>
                          <th className="w-10 px-3 py-2.5 text-center">#</th>
                          <th className="w-14 px-2 py-2.5 text-center">Photo</th>
                          <th className="min-w-[220px] px-3 py-2.5">
                            Package Title <span className="text-coral-500">*</span>
                          </th>
                          <th className="w-44 px-3 py-2.5">Destination</th>
                          <th className="w-36 px-3 py-2.5">Category</th>
                          <th className="w-32 px-3 py-2.5 text-center">Duration</th>
                          <th className="w-32 px-3 py-2.5">Price (₹)</th>
                          <th className="w-28 px-3 py-2.5">Status</th>
                          <th className="w-20 px-3 py-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100/70 bg-white">
                        {rows.map((row, index) => (
                          <tr
                            key={row.id}
                            className="hover:bg-brand-50/30 transition-colors group"
                          >
                            {/* Row Number */}
                            <td className="px-3 py-2 text-center font-medium text-ink-400">
                              {index + 1}
                            </td>
  
                            {/* Photo Cell */}
                            <td className="px-2 py-2 text-center">
                              <label className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-ink-50 hover:bg-brand-50 hover:border-brand-300 transition cursor-pointer overflow-hidden group">
                                {uploadingRowId === row.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                                ) : row.cover_image_url ? (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={row.cover_image_url}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-ink-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                      <UploadCloud className="h-3 w-3" />
                                    </div>
                                  </>
                                ) : (
                                  <ImageIcon className="h-3.5 w-3.5 text-ink-400 group-hover:text-brand-600" />
                                )}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  disabled={isPending || uploadingRowId === row.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleRowImageUpload(index, file);
                                    e.target.value = '';
                                  }}
                                  className="sr-only"
                                />
                              </label>
                            </td>
  
                            {/* Title Input */}
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.title}
                                onChange={(e) => updateRow(index, 'title', e.target.value)}
                                placeholder="e.g. 5D/4N Munnar & Alleppey"
                                className="input h-8 text-xs w-full font-medium"
                                disabled={isPending}
                              />
                            </td>
  
                            {/* Destination Select */}
                            <td className="px-3 py-2">
                              <select
                                value={row.destination_id}
                                onChange={(e) => updateRow(index, 'destination_id', e.target.value)}
                                className="input h-8 text-xs w-full cursor-pointer"
                                disabled={isPending}
                              >
                                <option value="">— Select —</option>
                                {destinations.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </td>
  
                            {/* Category Select */}
                            <td className="px-3 py-2">
                              <select
                                value={row.category}
                                onChange={(e) =>
                                  updateRow(index, 'category', e.target.value as (typeof packageCategories)[number])
                                }
                                className="input h-8 text-xs w-full capitalize cursor-pointer"
                                disabled={isPending}
                              >
                                {packageCategories.map((c) => (
                                  <option key={c} value={c} className="capitalize">
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </td>
  
                            {/* Duration (Days & Nights) */}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <div className="flex items-center gap-0.5">
                                  <input
                                    type="number"
                                    min={1}
                                    max={60}
                                    value={row.duration_days}
                                    onChange={(e) =>
                                      updateRow(index, 'duration_days', parseInt(e.target.value || '1', 10))
                                    }
                                    className="input h-8 w-12 text-center text-xs px-1"
                                    title="Days"
                                    disabled={isPending}
                                  />
                                  <span className="text-[11px] font-medium text-ink-400">D</span>
                                </div>
                                <span className="text-ink-300">/</span>
                                <div className="flex items-center gap-0.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={60}
                                    value={row.duration_nights}
                                    onChange={(e) =>
                                      updateRow(index, 'duration_nights', parseInt(e.target.value || '0', 10))
                                    }
                                    className="input h-8 w-12 text-center text-xs px-1"
                                    title="Nights"
                                    disabled={isPending}
                                  />
                                  <span className="text-[11px] font-medium text-ink-400">N</span>
                                </div>
                              </div>
                            </td>
  
                            {/* Base Price */}
                            <td className="px-3 py-2">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 text-xs font-semibold">
                                  ₹
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step={100}
                                  value={row.base_price}
                                  onChange={(e) =>
                                    updateRow(
                                      index,
                                      'base_price',
                                      e.target.value === '' ? '' : parseFloat(e.target.value)
                                    )
                                  }
                                  placeholder="0"
                                  className="input h-8 text-xs pl-6 w-full font-medium"
                                  disabled={isPending}
                                />
                              </div>
                            </td>
  
                            {/* Status */}
                            <td className="px-3 py-2">
                              <select
                                value={row.status}
                                onChange={(e) =>
                                  updateRow(index, 'status', e.target.value as 'draft' | 'published')
                                }
                                className={`input h-8 text-xs w-full font-medium cursor-pointer ${
                                  row.status === 'published' ? 'text-emerald-700 bg-emerald-50/50' : 'text-ink-600'
                                }`}
                                disabled={isPending}
                              >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                              </select>
                            </td>
  
                            {/* Action Buttons */}
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => duplicateRow(index)}
                                  title="Duplicate row"
                                  disabled={isPending}
                                  className="rounded p-1 text-ink-400 hover:text-brand-600 hover:bg-ink-100 transition cursor-pointer"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeRow(index)}
                                  title="Delete row"
                                  disabled={isPending}
                                  className="rounded p-1 text-ink-400 hover:text-coral-600 hover:bg-coral-50 transition cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
  
                {/* Table Toolbar / Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addRow}
                      disabled={isPending}
                      className="btn-outline inline-flex items-center gap-1.5 h-8 text-xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Row</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addMultipleRows(3)}
                      disabled={isPending}
                      className="btn-outline inline-flex items-center gap-1.5 h-8 text-xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add 3 Rows</span>
                    </button>
                    <button
                      type="button"
                      onClick={clearEmptyRows}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-ink-500 hover:text-ink-800 transition cursor-pointer"
                    >
                      <span>Clear empty rows</span>
                    </button>
                  </div>
  
                  <div className="flex items-center gap-2 text-xs text-ink-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" />
                    <span>Unique slugs &amp; SEO metadata are auto-generated on save.</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Quick Paste / Import Tab */
              <div className="space-y-4">
                <div className="rounded-xl border border-ink-150 bg-ink-50/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-800">
                    <FileSpreadsheet className="h-4 w-4 text-brand-600" />
                    <span>Paste From Excel, Google Sheets, or CSV</span>
                  </div>
                  <p className="text-xs text-ink-500 leading-relaxed">
                    Copy rows from your spreadsheet and paste them below. Expected columns in order:
                    <br />
                    <code className="text-brand-700 font-mono bg-white px-1.5 py-0.5 rounded border border-ink-200 mt-1 inline-block">
                      Package Title [Tab] Destination [Tab] Days [Tab] Nights [Tab] Price [Tab] Category
                    </code>
                  </p>
                </div>
  
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Munnar Honeymoon Special\tKerala\t4\t3\t18500\thoneymoon\nAlleppey Houseboat Cruise\tKerala\t2\t1\t9500\tfamily\nMaldives Luxury Escape\tMaldives\t5\t4\t65000\tluxury`}
                  rows={10}
                  className="input font-mono text-xs w-full leading-relaxed p-3"
                  disabled={isPending}
                />
  
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ink-400">
                    Destination names will be matched automatically to active destinations.
                  </p>
                  <button
                    type="button"
                    onClick={handleParsePaste}
                    disabled={!pasteText.trim() || isPending}
                    className="btn-primary inline-flex items-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Parse &amp; Populate Table Grid</span>
                  </button>
                </div>
              </div>
            )}
          </div>
  
          {/* Modal Footer */}
          <div className="flex items-center justify-between border-t border-ink-100 px-5 sm:px-6 py-3.5 bg-ink-50/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-500">
                Ready to create:
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-200">
                {validCount} package{validCount !== 1 ? 's' : ''}
              </span>
            </div>
  
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="btn-outline h-9 text-xs px-4 cursor-pointer"
              >
                Cancel
              </button>
  
              <button
                type="button"
                onClick={handleBulkSave}
                disabled={validCount === 0 || isPending}
                className="btn-primary inline-flex items-center gap-2 h-9 text-xs px-5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving {validCount} packages…</span>
                  </>
                ) : (
                  <>
                    <Layers className="h-3.5 w-3.5" />
                    <span>Bulk Save {validCount > 0 ? `(${validCount})` : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function BulkCreateButton({
  destinations,
  className = '',
}: {
  destinations: DestinationOption[];
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`btn-outline inline-flex items-center gap-2 shadow-2xs hover:shadow-xs transition cursor-pointer ${className}`}
      >
        <Layers className="h-4 w-4 text-brand-600" />
        <span>Bulk create</span>
      </button>

      <BulkCreateModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        destinations={destinations}
      />
    </>
  );
}
