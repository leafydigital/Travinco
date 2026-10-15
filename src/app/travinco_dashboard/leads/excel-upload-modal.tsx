'use client';

import { useRef, useState, useTransition } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { LeadImportRow } from './actions';
import { importLeads } from './actions';

interface ExcelRow {
  'Contact Name'?: string;
  'Contact Number'?: string;
  'Email'?: string;
  'Package'?: string;
  'Number of Days'?: string | number;
  'Budget'?: string | number;
  'From Date'?: string | number;
  'To Date'?: string | number;
  'Number of People'?: string | number;
  [key: string]: unknown;
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

function mapRow(raw: ExcelRow): LeadImportRow {
  return {
    contact_name: String(raw['Contact Name'] ?? '').trim(),
    contact_number: String(raw['Contact Number'] ?? '').trim(),
    email: String(raw['Email'] ?? '').trim(),
    package: String(raw['Package'] ?? '').trim(),
    number_of_days: raw['Number of Days'] ? Number(raw['Number of Days']) : null,
    budget: raw['Budget'] ? Number(raw['Budget']) : null,
    from_date: parseExcelDate(raw['From Date']),
    to_date: parseExcelDate(raw['To Date']),
    number_of_people: raw['Number of People'] ? Number(raw['Number of People']) : null,
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

  async function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setParseError('Please upload an .xlsx or .xls file.');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        setParseError('The spreadsheet contains no sheets.');
        return;
      }
      const ws = wb.Sheets[firstSheetName];
      if (!ws) {
        setParseError('Could not read the worksheet.');
        return;
      }
      const rows: ExcelRow[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (rows.length === 0) {
        setParseError('The spreadsheet appears to be empty.');
        return;
      }
      setPreview(rows.map(mapRow));
      setStep('preview');
    } catch (e) {
      setParseError('Could not read the file. Make sure it is a valid Excel spreadsheet.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-brand-600" />
            <h2 className="text-base font-semibold text-ink-900">Upload Leads from Excel</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* -- STEP 1: Upload -- */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-ink-500">
                Upload an Excel file (<code>.xlsx</code> or <code>.xls</code>) with the following columns:{' '}
                <span className="font-medium text-ink-700">
                  Contact Name, Contact Number, Email, Package, Number of Days, Budget, From Date, To Date, Number of People
                </span>
              </p>
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
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {parseError}
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
                <button onClick={() => setStep('upload')} className="btn-outline text-xs px-3 py-1.5">
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
                <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>{result.error}</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  <div>
                    <p className="font-semibold">Import complete!</p>
                    <p>
                      {result.imported} lead{result.imported !== 1 ? 's' : ''} imported
                      {result.duplicates ? `, ${result.duplicates} duplicate${result.duplicates !== 1 ? 's' : ''} skipped` : ''}.
                    </p>
                  </div>
                </div>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="rounded-lg border border-sand-200 bg-sand-50 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sand-700">Row errors</p>
                  <ul className="space-y-1 text-xs text-sand-800">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4">
          {step === 'upload' && (
            <button onClick={onClose} className="btn-outline">Cancel</button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={onClose} className="btn-outline">Cancel</button>
              <button onClick={handleImport} disabled={isPending} className="btn-primary flex items-center gap-2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import {preview.length} leads
              </button>
            </>
          )}
          {step === 'result' && (
            <button onClick={onClose} className="btn-primary">Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
