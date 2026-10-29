'use client';

import { useRef, useState, useTransition } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { LeadImportRow } from './actions';
import { importLeads } from './actions';
import { ModalPortal } from '@/components/ui/modal-portal';

function cleanHeader(key: string): string {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HEADER_SYNONYMS = {
  contact_name: ['contactname', 'name', 'customername', 'clientname', 'leadname', 'fullname', 'contactperson'],
  contact_number: ['contactnumber', 'phone', 'mobile', 'contactno', 'phonenumber', 'mobilenumber', 'contact', 'phoneno', 'mobileno', 'whatsappnumber', 'whatsapp'],
  email: ['email', 'emailaddress', 'emailid', 'mail'],
  package: ['package', 'packagename', 'tour', 'destination', 'pkg', 'tourpackage'],
  number_of_days: ['numberofdays', 'days', 'duration', 'noofdays', 'numdays'],
  budget: ['budget', 'price', 'packagebudget', 'cost', 'amount'],
  from_date: ['fromdate', 'startdate', 'traveldate', 'departuredate', 'from'],
  to_date: ['todate', 'enddate', 'returndate', 'to'],
  number_of_people: ['numberofpeople', 'pax', 'people', 'travellers', 'guests', 'noofpeople', 'adults', 'numpeople'],
} as const;

function getHeaderValue(row: Record<string, unknown>, synonyms: readonly string[]): unknown {
  for (const rawKey of Object.keys(row)) {
    const cleaned = cleanHeader(rawKey);
    if ((synonyms as readonly string[]).includes(cleaned)) {
      return row[rawKey];
    }
  }
  return undefined;
}

function parseCleanNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const clean = String(val).replace(/[₹$€,\s]/gi, '').replace(/rs\.?/gi, '').trim();
  if (!clean) return null;
  const num = Number(clean);
  return isNaN(num) ? null : num;
}

function parseExcelDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (!s) return null;
  const ddmm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (ddmm && ddmm[1] && ddmm[2] && ddmm[3]) {
    const d = ddmm[1];
    const m = ddmm[2];
    const y = ddmm[3];
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const isoLike = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLike) return isoLike[0];
  return s;
}

function mapRow(raw: Record<string, unknown>): LeadImportRow {
  const nameVal = getHeaderValue(raw, HEADER_SYNONYMS.contact_name);
  const phoneVal = getHeaderValue(raw, HEADER_SYNONYMS.contact_number);
  const emailVal = getHeaderValue(raw, HEADER_SYNONYMS.email);
  const packageVal = getHeaderValue(raw, HEADER_SYNONYMS.package);
  const daysVal = getHeaderValue(raw, HEADER_SYNONYMS.number_of_days);
  const budgetVal = getHeaderValue(raw, HEADER_SYNONYMS.budget);
  const fromVal = getHeaderValue(raw, HEADER_SYNONYMS.from_date);
  const toVal = getHeaderValue(raw, HEADER_SYNONYMS.to_date);
  const peopleVal = getHeaderValue(raw, HEADER_SYNONYMS.number_of_people);

  return {
    contact_name: String(nameVal ?? '').trim(),
    contact_number: String(phoneVal ?? '').trim(),
    email: String(emailVal ?? '').trim(),
    package: String(packageVal ?? '').trim(),
    number_of_days: parseCleanNumber(daysVal),
    budget: parseCleanNumber(budgetVal),
    from_date: parseExcelDate(fromVal),
    to_date: parseExcelDate(toVal),
    number_of_people: parseCleanNumber(peopleVal),
  };
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'preview' | 'result';

export function ExcelUploadModal({ onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<LeadImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported?: number; duplicates?: number; errors?: string[]; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function downloadSampleTemplate() {
    try {
      const XLSX = await import('xlsx');
      const sampleData = [
        {
          'Contact Name': 'Rajesh Kumar',
          'Contact Number': '9876543210',
          'Email': 'rajesh@example.com',
          'Package': 'Kashmir Paradise Tour',
          'Number of Days': 5,
          'Budget': 35000,
          'From Date': '2026-11-15',
          'To Date': '2026-11-20',
          'Number of People': 2,
        },
        {
          'Contact Name': 'Priya Sharma',
          'Contact Number': '9123456780',
          'Email': 'priya@example.com',
          'Package': 'Goa Beach Escape',
          'Number of Days': 4,
          'Budget': 25000,
          'From Date': '2026-12-01',
          'To Date': '2026-12-05',
          'Number of People': 4,
        },
      ];
      const ws = XLSX.utils.json_to_sheet(sampleData);
      ws['!cols'] = [
        { wch: 18 },
        { wch: 16 },
        { wch: 24 },
        { wch: 24 },
        { wch: 15 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads Template');
      XLSX.writeFile(wb, 'travinco_leads_sample_template.xlsx');
      toast.success('Sample Excel template downloaded');
    } catch (e) {
      toast.error('Could not download sample template.');
    }
  }

  async function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setParseError('Invalid file format: Please upload a standard Excel spreadsheet (.xlsx or .xls).');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        setParseError('This Excel workbook is empty and contains no worksheets.');
        return;
      }
      const ws = wb.Sheets[firstSheetName];
      if (!ws) {
        setParseError('We could not read data from the selected worksheet. Please verify the file is not damaged.');
        return;
      }
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (rows.length === 0) {
        setParseError('This Excel spreadsheet does not contain any lead records to import.');
        return;
      }

      // Check required header presence
      const sampleRow = rows[0] || {};
      const hasName = getHeaderValue(sampleRow, HEADER_SYNONYMS.contact_name) !== undefined;
      const hasPhone = getHeaderValue(sampleRow, HEADER_SYNONYMS.contact_number) !== undefined;

      if (!hasName || !hasPhone) {
        const missing: string[] = [];
        if (!hasName) missing.push("'Contact Name'");
        if (!hasPhone) missing.push("'Contact Number'");
        setParseError(
          `Missing required columns: Your spreadsheet must include ${missing.join(' and ')} column headers. Please check your sheet headers or download our sample template.`
        );
        return;
      }

      setPreview(rows.map(mapRow));
      setStep('preview');
    } catch (e) {
      setParseError('We could not open this file. Please verify that the spreadsheet is not damaged or password-protected and try again.');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleImport() {
    startTransition(async () => {
      const res = await importLeads(preview);
      setResult(res);
      setStep('result');
      if (res.imported && res.imported > 0) onSuccess();
    });
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-4">
        <div className="card w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-semibold text-ink-900">Upload Leads from Excel</h2>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
  
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* -- STEP 1: Upload -- */}
            {step === 'upload' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ink-500">
                    Upload an Excel file (<code>.xlsx</code> or <code>.xls</code>) with lead details.
                  </p>
                  <button
                    type="button"
                    onClick={downloadSampleTemplate}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-brand-700" />
                    Download Sample Template
                  </button>
                </div>
  
                <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3.5 text-xs text-ink-600 space-y-1.5">
                  <p className="font-semibold text-ink-800">Supported Column Headers:</p>
                  <p className="leading-relaxed">
                    <span className="font-semibold text-brand-900">• Required:</span> Contact Name, Contact Number<br />
                    <span className="font-semibold text-ink-700">• Optional:</span> Email, Package, Number of Days, Budget, From Date, To Date, Number of People
                  </p>
                  <p className="text-[11px] text-ink-400 italic">
                    Note: Common variations like &quot;Name&quot;, &quot;Phone&quot;, &quot;Mobile&quot;, or &quot;Days&quot; are automatically recognized.
                  </p>
                </div>
  
                <div className="flex items-center gap-2 rounded-lg bg-blue-50/80 border border-blue-200 px-3.5 py-2 text-xs text-blue-800">
                  <span className="font-semibold">Default Status:</span>
                  <span>All imported leads will automatically be assigned the status</span>
                  <span className="font-semibold text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                    Fresh Lead
                  </span>
                </div>
  
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-ink-200 bg-ink-50 p-10 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
                >
                  <Upload className="h-8 w-8 text-ink-300" />
                  <div>
                    <p className="text-sm font-medium text-ink-700">Click or drag & drop your Excel file here</p>
                    <p className="mt-0.5 text-xs text-ink-400">.xlsx or .xls only</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </div>
  
                {parseError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">Could not proceed with upload</p>
                      <p className="leading-relaxed">{parseError}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
  
            {/* -- STEP 2: Preview -- */}
            {step === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-ink-500">
                    Found <span className="font-semibold text-ink-800">{preview.length}</span> records in{' '}
                    <span className="font-medium">{fileName}</span>. Review before importing.
                  </p>
                  <button onClick={() => setStep('upload')} className="btn-outline text-xs px-3 py-1.5 cursor-pointer">
                    Change file
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-ink-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
                        {['Contact Name','Contact Number','Email','Package','Days','Budget','From','To','People','Status'].map((h) => (
                          <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {preview.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-ink-50/50">
                          <td className="px-3 py-2 font-medium text-ink-800">{row.contact_name || <span className="text-red-500">-</span>}</td>
                          <td className="px-3 py-2 text-ink-600">{row.contact_number || <span className="text-red-500">-</span>}</td>
                          <td className="px-3 py-2 text-ink-500">{row.email || '-'}</td>
                          <td className="px-3 py-2 text-ink-500">{row.package || '-'}</td>
                          <td className="px-3 py-2 text-ink-500">{row.number_of_days ?? '-'}</td>
                          <td className="px-3 py-2 text-ink-500">{row.budget ? ('₹' + Number(row.budget).toLocaleString('en-IN')) : '-'}</td>
                          <td className="px-3 py-2 text-ink-500">{row.from_date || '-'}</td>
                          <td className="px-3 py-2 text-ink-500">{row.to_date || '-'}</td>
                          <td className="px-3 py-2 text-ink-500">{row.number_of_people ?? '-'}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                              Fresh Lead
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 50 && (
                    <p className="px-3 py-2 text-xs text-ink-400 border-t border-ink-100">
                      Showing first 50 of {preview.length} rows. All rows will be imported.
                    </p>
                  )}
                </div>
              </div>
            )}
  
            {/* -- STEP 3: Result -- */}
            {step === 'result' && result && (
              <div className="space-y-4">
                {result.error ? (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">Import Unsuccessful</p>
                      <p className="text-xs leading-relaxed text-red-700">{result.error}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <div>
                      <p className="font-semibold">Import complete!</p>
                      <p className="text-xs text-green-800 mt-0.5">
                        {result.imported} lead{result.imported !== 1 ? 's' : ''} successfully imported
                        {result.duplicates ? `, ${result.duplicates} duplicate${result.duplicates !== 1 ? 's' : ''} skipped` : ''}.
                      </p>
                    </div>
                  </div>
                )}
                {result.errors && result.errors.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
                        Row Validation Notices ({result.errors.length})
                      </p>
                      <span className="text-[11px] text-amber-700">Please review row numbers below</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-amber-950 max-h-48 overflow-y-auto pr-1">
                      {result.errors.slice(0, 50).map((e, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                    {result.errors.length > 50 && (
                      <p className="mt-2 text-[11px] text-amber-800 border-t border-amber-200/80 pt-1.5">
                        Showing first 50 notices. All {result.errors.length} skipped rows should be verified.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
  
          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4">
            {step === 'upload' && (
              <button onClick={onClose} className="btn-outline cursor-pointer">Cancel</button>
            )}
            {step === 'preview' && (
              <>
                <button onClick={onClose} className="btn-outline cursor-pointer">Cancel</button>
                <button onClick={handleImport} disabled={isPending} className="btn-primary flex items-center gap-2 cursor-pointer">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Import {preview.length} leads
                </button>
              </>
            )}
            {step === 'result' && (
              <button onClick={onClose} className="btn-primary cursor-pointer">Done</button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
