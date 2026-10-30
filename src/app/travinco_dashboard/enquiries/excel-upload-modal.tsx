'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { ModalPortal } from '@/components/ui/modal-portal';
import { formatDate } from '@/lib/utils/format';
import {
  IMPORT_COLUMNS,
  IMPORT_FILE_PATTERN,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  detectSheetLayout,
  extractRawRows,
  findInFileDuplicates,
  missingRequiredColumns,
  normalizeImportRow,
  todayInIndia,
  type NormalizedImportRow,
  type RawImportRow,
} from '@/lib/excel/enquiry-import';
import { importEnquiries, type ImportEnquiriesResult, type ImportRowIssue } from './actions';

interface Props {
  isAdmin: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'preview' | 'result';

interface ParsedFile {
  fileName: string;
  sheetName: string;
  date1904: boolean;
  rawRows: RawImportRow[];
  rows: NormalizedImportRow[];
  repeats: Map<number, number>;
  notes: string[];
}

const PREVIEW_LIMIT = 100;

export function ExcelUploadModal({ isAdmin, onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [result, setResult] = useState<ImportEnquiriesResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(() => {
    if (!parsed) return { ready: 0, withWarnings: 0, invalid: 0, repeats: 0 };
    let ready = 0;
    let withWarnings = 0;
    let invalid = 0;
    for (const r of parsed.rows) {
      if (!r.record) invalid++;
      else if (!parsed.repeats.has(r.rowNumber)) {
        ready++;
        if (r.warnings.length > 0) withWarnings++;
      }
    }
    return { ready, withWarnings, invalid, repeats: parsed.repeats.size };
  }, [parsed]);

  async function downloadTemplate() {
    try {
      const XLSX = await import('xlsx');
      const header = IMPORT_COLUMNS.map((c) => c.label);
      const rows = [
        header,
        ['', '28/10/2026', 'Instagram', 'Rahul Menon', '9847012345', 'rahul@example.com', 'Munnar & Thekkady', '15/11/2026', '19/11/2026', 5, 45000, 2, 1, 0],
        ['', '29/10/2026', 'Referral', 'Anjali Nair', '+91 98950 67812', '', 'Alleppey Houseboat', '05/12/2026', '', 2, '20k - 25k', 4, 0, 1],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = header.map((h) => ({ wch: Math.max(14, h.length + 4) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Enquiries');
      XLSX.writeFile(wb, 'travinco_enquiries_template.xlsx');
    } catch {
      toast.error('Could not download the template.');
    }
  }

  async function handleFile(file: File) {
    setParseError(null);
    setParsed(null);
    if (!IMPORT_FILE_PATTERN.test(file.name)) {
      setParseError('Please upload an Excel file (.xlsx or .xls) or a .csv file.');
      return;
    }
    if (file.size === 0) {
      setParseError('This file is empty.');
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setParseError(`This file is larger than ${MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB. Remove unused sheets or split it into smaller files.`);
      return;
    }

    setIsReading(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true });
      if (wb.SheetNames.length === 0) {
        setParseError('This workbook has no sheets.');
        return;
      }
      const date1904 = Boolean(wb.Workbook?.WBProps?.date1904);

      // First visible sheet that has the expected header row
      let chosen: { name: string; rows: unknown[][]; startRow: number } | null = null;
      let firstRows: unknown[][] = [];
      for (let i = 0; i < wb.SheetNames.length; i++) {
        const name = wb.SheetNames[i]!;
        if (wb.Workbook?.Sheets?.[i]?.Hidden) continue;
        const ws = wb.Sheets[name];
        if (!ws || !ws['!ref']) continue;
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '', blankrows: true });
        if (firstRows.length === 0) firstRows = rows;
        if (detectSheetLayout(rows)) {
          chosen = { name, rows, startRow: XLSX.utils.decode_range(ws['!ref']).s.r };
          break;
        }
      }

      if (!chosen) {
        const missing = missingRequiredColumns(firstRows);
        setParseError(
          firstRows.length === 0
            ? 'The sheet is empty.'
            : `Could not find the column headers. The sheet needs ${missing.length ? missing.map((m) => `"${m}"`).join(' and ') : '"Customer Name" and "Contact Number"'} columns. Download the template to see the expected layout.`
        );
        return;
      }

      const layout = detectSheetLayout(chosen.rows)!;
      const rawRows = extractRawRows(chosen.rows, layout).map((r) => ({ ...r, rowNumber: r.rowNumber + chosen!.startRow }));
      if (rawRows.length === 0) {
        setParseError('The sheet has headers but no enquiry rows below them.');
        return;
      }
      if (rawRows.length > MAX_IMPORT_ROWS) {
        setParseError(`The sheet has ${rawRows.length} rows. Up to ${MAX_IMPORT_ROWS} rows can be uploaded at a time, so please split the file.`);
        return;
      }

      const today = todayInIndia();
      const rows = rawRows.map((r) => normalizeImportRow(r, { date1904, today }));
      const notes: string[] = [];
      const found = new Set(Object.keys(layout.columns));
      const notFound = IMPORT_COLUMNS.filter((c) => c.key !== 'enq_no' && !found.has(c.key)).map((c) => c.label);
      if (notFound.length > 0) notes.push(`Columns not found (left empty): ${notFound.join(', ')}`);
      if (layout.duplicateHeaders.length > 0) {
        notes.push(`Repeated columns ignored (the first one is used): ${layout.duplicateHeaders.join(', ')}`);
      }
      if (rawRows.some((r) => r.cells.enq_no !== undefined)) {
        notes.push('Enq No values in the file are ignored. Enquiry numbers are generated automatically.');
      }

      setParsed({
        fileName: file.name,
        sheetName: chosen.name,
        date1904,
        rawRows,
        rows,
        repeats: findInFileDuplicates(rows),
        notes,
      });
      setStep('preview');
    } catch (e) {
      console.error('Excel read failed', e);
      setParseError('This file could not be opened. Check it is not password-protected or damaged, then try again.');
    } finally {
      setIsReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleImport() {
    if (!parsed) return;
    startTransition(async () => {
      const res = await importEnquiries({ rows: parsed.rawRows, date1904: parsed.date1904, fileName: parsed.fileName });
      setResult(res);
      setStep('result');
      if (res.imported && res.imported > 0) {
        toast.success(`${res.imported} enquir${res.imported === 1 ? 'y' : 'ies'} imported`);
        onSuccess();
      }
    });
  }

  /** Skipped rows with the reason, so they can be fixed and uploaded again. */
  async function downloadSkipped() {
    if (!parsed || !result) return;
    const reasons = new Map<number, string>();
    [...(result.failed ?? []), ...(result.duplicates ?? [])].forEach((r) => reasons.set(r.rowNumber, r.messages.join('; ')));
    if (reasons.size === 0) return;
    try {
      const XLSX = await import('xlsx');
      const header = [...IMPORT_COLUMNS.map((c) => c.label), 'Row in file', 'Why it was skipped'];
      const body = parsed.rawRows
        .filter((r) => reasons.has(r.rowNumber))
        .map((r) => [...IMPORT_COLUMNS.map((c) => r.cells[c.key] ?? ''), r.rowNumber, reasons.get(r.rowNumber)]);
      const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
      ws['!cols'] = header.map((h) => ({ wch: Math.max(14, h.length + 4) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Skipped rows');
      XLSX.writeFile(wb, `skipped_${parsed.fileName.replace(/\.(xlsx|xls|csv)$/i, '')}.xlsx`);
    } catch {
      toast.error('Could not create the file.');
    }
  }

  const skippedCount = (result?.failed?.length ?? 0) + (result?.duplicates?.length ?? 0);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
        <div className="card flex max-h-[90vh] w-full max-w-5xl flex-col shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-semibold text-ink-900">Upload enquiries from Excel</h2>
            </div>
            <button
              onClick={onClose}
              disabled={isPending}
              className="cursor-pointer rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === 'upload' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ink-500">
                    Upload a <code>.xlsx</code>, <code>.xls</code> or <code>.csv</code> file, up to {MAX_IMPORT_ROWS} rows.
                  </p>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-100"
                  >
                    <Download className="h-3.5 w-3.5 text-brand-700" /> Download template
                  </button>
                </div>

                <div className="space-y-1.5 rounded-xl border border-ink-100 bg-ink-50/60 p-3.5 text-xs text-ink-600">
                  <p className="font-semibold text-ink-800">Columns</p>
                  <p className="leading-relaxed">{IMPORT_COLUMNS.map((c) => c.label).join(' · ')}</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-ink-500">
                    <li><b>Customer Name</b> and <b>Contact Number</b> are required. Everything else is optional.</li>
                    <li><b>Enq No</b> is generated automatically, so any value in that column is ignored.</li>
                    <li>Dates are read as DD/MM/YYYY. An empty <b>Enq Date</b> becomes today.</li>
                    <li>Numbers without a country code are treated as Indian (+91).</li>
                    <li>Rows already in Enquiries (same number, Enq Date and package) are skipped.</li>
                  </ul>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3.5 py-2 text-xs text-sky-900">
                  <span>Every uploaded enquiry starts as</span>
                  <span className="rounded border border-sky-200 bg-sky-100 px-1.5 py-0.5 font-semibold">New lead</span>
                  <span>
                    with a priority from its travel date
                    {isAdmin ? ', unassigned.' : ', assigned to you.'}
                  </span>
                </div>

                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && !isReading) handleFile(file);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => !isReading && fileRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-ink-200 bg-ink-50 p-10 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
                >
                  {isReading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                  ) : (
                    <Upload className="h-8 w-8 text-ink-300" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-ink-700">
                      {isReading ? 'Reading file…' : 'Click or drag & drop your file here'}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">.xlsx, .xls or .csv · max {MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </div>

                {parseError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <p className="leading-relaxed">{parseError}</p>
                  </div>
                )}
              </div>
            )}

            {step === 'preview' && parsed && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ink-500">
                    <span className="font-medium text-ink-800">{parsed.fileName}</span>
                    {parsed.sheetName && <> · sheet “{parsed.sheetName}”</>} · {parsed.rows.length} rows
                  </p>
                  <button onClick={() => setStep('upload')} className="btn-outline cursor-pointer px-3 py-1.5 text-xs">
                    Choose another file
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SummaryTile label="Ready to import" value={summary.ready} tone="emerald" />
                  <SummaryTile label="Imported with notes" value={summary.withWarnings} tone="amber" />
                  <SummaryTile label="Have errors (skipped)" value={summary.invalid} tone="red" />
                  <SummaryTile label="Repeated in file (skipped)" value={summary.repeats} tone="ink" />
                </div>

                {parsed.notes.length > 0 && (
                  <ul className="space-y-1 rounded-lg border border-ink-100 bg-ink-50/60 px-3.5 py-2 text-xs text-ink-600">
                    {parsed.notes.map((n) => (
                      <li key={n}>• {n}</li>
                    ))}
                  </ul>
                )}

                <div className="overflow-x-auto rounded-lg border border-ink-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50 text-left uppercase tracking-wide text-ink-400">
                        {['Row', 'Enq Date', 'Customer', 'Contact', 'Package', 'Travel', 'Pax', 'Budget', 'Check'].map((h) => (
                          <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {parsed.rows.slice(0, PREVIEW_LIMIT).map((row) => {
                        const raw = parsed.rawRows.find((r) => r.rowNumber === row.rowNumber)?.cells ?? {};
                        const rec = row.record;
                        const repeatOf = parsed.repeats.get(row.rowNumber);
                        return (
                          <tr key={row.rowNumber} className={!rec ? 'bg-red-50/40' : repeatOf ? 'bg-ink-50/60' : ''}>
                            <td className="px-3 py-2 text-ink-400">{row.rowNumber}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-ink-600">{rec ? formatDate(rec.enquiry_date) : String(raw.enquiry_date ?? '—')}</td>
                            <td className="px-3 py-2 font-medium text-ink-800">{rec?.customer_name ?? String(raw.customer_name ?? '—')}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-ink-600">{rec?.phone ?? String(raw.contact_number ?? '—')}</td>
                            <td className="px-3 py-2 text-ink-600">{rec ? rec.destination ?? '—' : String(raw.package ?? '—')}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-ink-600">
                              {rec?.travel_date ? formatDate(rec.travel_date) : '—'}
                              {rec?.return_date && <> → {formatDate(rec.return_date)}</>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-ink-600">
                              {rec ? `${rec.number_of_adults}A ${rec.number_of_children}K ${rec.number_of_infants}I` : '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-ink-600">
                              {rec?.budget != null ? `₹${rec.budget.toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="min-w-[220px] px-3 py-2">
                              {!rec ? (
                                <IssueList tone="red" messages={row.errors} />
                              ) : repeatOf ? (
                                <span className="text-ink-500">Repeat of row {repeatOf}, skipped</span>
                              ) : row.warnings.length > 0 ? (
                                <IssueList tone="amber" messages={row.warnings} />
                              ) : (
                                <span className="font-medium text-emerald-700">OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {parsed.rows.length > PREVIEW_LIMIT && (
                    <p className="border-t border-ink-100 px-3 py-2 text-xs text-ink-400">
                      Showing the first {PREVIEW_LIMIT} of {parsed.rows.length} rows. All rows are checked and imported.
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 'result' && result && (
              <div className="space-y-4">
                {result.error ? (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div>
                      <p className="font-semibold">Import failed</p>
                      <p className="mt-0.5 text-xs text-red-700">{result.error}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <div>
                      <p className="font-semibold">
                        {result.imported
                          ? `${result.imported} enquir${result.imported === 1 ? 'y' : 'ies'} imported as New lead`
                          : 'No new enquiries were imported'}
                      </p>
                      {skippedCount > 0 && (
                        <p className="mt-0.5 text-xs text-green-800">
                          {skippedCount} row{skippedCount === 1 ? ' was' : 's were'} skipped. You can download them, fix them and upload again.
                        </p>
                      )}
                      {result.enquiryNumbers && result.enquiryNumbers.length > 0 && (
                        <p className="mt-1 text-xs text-green-800">
                          {result.enquiryNumbers.length === 1
                            ? result.enquiryNumbers[0]
                            : `${result.enquiryNumbers[0]} … ${result.enquiryNumbers[result.enquiryNumbers.length - 1]}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <IssueSection title="Skipped: errors" tone="red" issues={result.failed} />
                <IssueSection title="Skipped: already exists or repeated" tone="ink" issues={result.duplicates} />
                <IssueSection title="Imported with notes" tone="amber" issues={result.warnings} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink-100 px-6 py-4">
            {step === 'upload' && (
              <button onClick={onClose} className="btn-outline cursor-pointer">Cancel</button>
            )}
            {step === 'preview' && (
              <>
                <button onClick={onClose} disabled={isPending} className="btn-outline cursor-pointer">Cancel</button>
                <button
                  onClick={handleImport}
                  disabled={isPending || summary.ready === 0}
                  className="btn-primary flex cursor-pointer items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {summary.ready === 0 ? 'Nothing to import' : `Import ${summary.ready} enquir${summary.ready === 1 ? 'y' : 'ies'}`}
                </button>
              </>
            )}
            {step === 'result' && (
              <>
                {skippedCount > 0 && (
                  <button onClick={downloadSkipped} className="btn-outline flex cursor-pointer items-center gap-2">
                    <Download className="h-4 w-4" /> Download skipped rows
                  </button>
                )}
                {result?.error && (
                  <button onClick={() => setStep('preview')} className="btn-outline cursor-pointer">Back</button>
                )}
                <button onClick={onClose} className="btn-primary cursor-pointer">Done</button>
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

const TONES = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-800',
  ink: 'border-ink-200 bg-ink-50 text-ink-700',
} as const;

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: keyof typeof TONES }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${TONES[tone]}`}>
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-[11px]">{label}</p>
    </div>
  );
}

function IssueList({ messages, tone }: { messages: string[]; tone: 'red' | 'amber' }) {
  return (
    <ul className={`space-y-0.5 ${tone === 'red' ? 'text-red-700' : 'text-amber-800'}`}>
      {messages.map((m) => (
        <li key={m} className="flex items-start gap-1">
          {tone === 'red' ? <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />}
          <span>{m}</span>
        </li>
      ))}
    </ul>
  );
}

function IssueSection({ title, tone, issues }: { title: string; tone: keyof typeof TONES; issues?: ImportRowIssue[] }) {
  if (!issues || issues.length === 0) return null;
  return (
    <div className={`rounded-xl border p-4 ${TONES[tone]}`}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide">
        {title} ({issues.length})
      </p>
      <ul className="max-h-48 space-y-1 overflow-y-auto pr-1 text-xs">
        {issues.slice(0, 200).map((i) => (
          <li key={i.rowNumber}>
            <span className="font-semibold">Row {i.rowNumber}:</span> {i.messages.join('; ')}
          </li>
        ))}
      </ul>
      {issues.length > 200 && <p className="mt-2 text-[11px]">Showing the first 200. Download the skipped rows for the full list.</p>}
    </div>
  );
}
