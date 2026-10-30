import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { isAllZeroPhone, isFakePhone } from '@/lib/validations/phone';

/**
 * Excel → enquiry import rules, shared by the upload preview (browser) and the
 * server action (which re-runs them, so nothing from the browser is trusted).
 *
 * Expected sheet columns (header text is matched loosely, see COLUMNS):
 *   Enq No (Auto) | Enq Date | Enquiry received from | Customer Name | Contact Number |
 *   Email | Package | Travel Date | To Date (if any) | Number of Days | Budget |
 *   Adults 12 + | Kids 2-11 | Infant <2
 */

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_FILE_PATTERN = /\.(xlsx|xls|csv)$/i;

const MAX_NAME = 120;
const MAX_DESTINATION = 120; // same limit as the enquiry edit form
const MAX_RECEIVED_FROM = 100;
const MAX_PAX = 500;
const MAX_DAYS = 365;
const MAX_BUDGET = 1_000_000_000;

export type ImportColumnKey =
  | 'enq_no'
  | 'enquiry_date'
  | 'received_from'
  | 'customer_name'
  | 'contact_number'
  | 'email'
  | 'package'
  | 'travel_date'
  | 'to_date'
  | 'number_of_days'
  | 'budget'
  | 'adults'
  | 'kids'
  | 'infants';

/** Header text → letters/digits only, e.g. "Adults 12 +" → "adults12". */
export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/ /g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export const IMPORT_COLUMNS: { key: ImportColumnKey; label: string; match: (h: string) => boolean }[] = [
  { key: 'enq_no', label: 'Enq No (Auto)', match: (h) => /^(enq|enquiry|inquiry)(no|number|id)/.test(h) || ['sno', 'slno', 'srno', 'serialno'].includes(h) },
  { key: 'enquiry_date', label: 'Enq Date', match: (h) => ['enqdate', 'enquirydate', 'inquirydate', 'date', 'leaddate', 'receiveddate', 'receivedon', 'enquiredon'].includes(h) },
  { key: 'received_from', label: 'Enquiry received from', match: (h) => /^(enq|enquiry|inquiry)?receivedfrom/.test(h) || ['source', 'leadsource', 'enquirysource', 'channel', 'referredby'].includes(h) },
  { key: 'customer_name', label: 'Customer Name', match: (h) => ['customername', 'name', 'contactname', 'clientname', 'fullname', 'guestname', 'leadname', 'contactperson', 'customer'].includes(h) },
  { key: 'contact_number', label: 'Contact Number', match: (h) => ['contactnumber', 'contactno', 'phone', 'phonenumber', 'phoneno', 'mobile', 'mobilenumber', 'mobileno', 'whatsapp', 'whatsappnumber', 'whatsappno', 'contact', 'cellnumber'].includes(h) },
  { key: 'email', label: 'Email', match: (h) => ['email', 'emailid', 'emailaddress', 'mail', 'mailid'].includes(h) },
  { key: 'package', label: 'Package', match: (h) => ['package', 'packagename', 'tourpackage', 'tour', 'destination', 'destinations', 'pkg'].includes(h) },
  { key: 'travel_date', label: 'Travel Date', match: (h) => ['traveldate', 'dateoftravel', 'fromdate', 'startdate', 'departuredate', 'traveldates', 'checkin'].includes(h) },
  { key: 'to_date', label: 'To Date (if any)', match: (h) => /^todate/.test(h) || ['returndate', 'enddate', 'checkout'].includes(h) },
  { key: 'number_of_days', label: 'Number of Days', match: (h) => ['numberofdays', 'noofdays', 'days', 'duration', 'nights', 'numberofnights'].includes(h) || /^(noof|numberof)?days/.test(h) },
  { key: 'budget', label: 'Budget', match: (h) => /^budget/.test(h) || ['price', 'amount', 'cost'].includes(h) },
  { key: 'adults', label: 'Adults 12 +', match: (h) => /^(noof|numberof)?adults?/.test(h) },
  { key: 'kids', label: 'Kids 2-11', match: (h) => /^(noof|numberof)?(kids?|child|children|childs)/.test(h) },
  { key: 'infants', label: 'Infant <2', match: (h) => /^(noof|numberof)?(infants?|babies|baby)/.test(h) },
];

export const REQUIRED_IMPORT_COLUMNS: ImportColumnKey[] = ['customer_name', 'contact_number'];

export type RawImportCells = Partial<Record<ImportColumnKey, string | number | boolean | null>>;

/** One sheet row as sent to the server: the original cell values, by column. */
export interface RawImportRow {
  rowNumber: number; // row number as seen in Excel (1-based, header included)
  cells: RawImportCells;
}

/** A validated row, ready to insert into `enquiries`. */
export interface EnquiryImportRecord {
  enquiry_date: string;
  enquiry_received_from: string | null;
  customer_name: string;
  phone: string;
  email: string | null;
  destination: string | null;
  travel_date: string | null;
  return_date: string | null;
  number_of_days: number | null;
  budget: number | null;
  number_of_adults: number;
  number_of_children: number;
  number_of_infants: number;
}

export interface NormalizedImportRow {
  rowNumber: number;
  record: EnquiryImportRecord | null; // null when the row has errors
  errors: string[];
  warnings: string[];
}

// ─── Sheet layout ──────────────────────────────────────────────────────────

export interface SheetLayout {
  headerRowIndex: number; // 0-based index into the sheet's rows
  columns: Partial<Record<ImportColumnKey, number>>; // column key → 0-based column index
  duplicateHeaders: string[];
}

/**
 * Finds the header row (it does not have to be the first row — sheets often
 * start with a title or a blank line) and maps each known column to its index.
 * Picks the row in the first 20 that recognises the most columns and includes
 * the required ones.
 */
export function detectSheetLayout(rows: unknown[][]): SheetLayout | null {
  let best: SheetLayout | null = null;
  let bestScore = 0;

  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r] ?? [];
    const columns: Partial<Record<ImportColumnKey, number>> = {};
    const duplicateHeaders: string[] = [];

    row.forEach((cell, c) => {
      const h = normalizeHeader(cell);
      if (!h) return;
      const col = IMPORT_COLUMNS.find((def) => def.match(h));
      if (!col) return;
      if (columns[col.key] === undefined) columns[col.key] = c;
      else duplicateHeaders.push(String(cell).trim());
    });

    const score = Object.keys(columns).length;
    const hasRequired = REQUIRED_IMPORT_COLUMNS.every((k) => columns[k] !== undefined);
    if (hasRequired && score > bestScore) {
      best = { headerRowIndex: r, columns, duplicateHeaders };
      bestScore = score;
    }
  }
  return best;
}

/** Best guess of which required columns are missing, for the error message. */
export function missingRequiredColumns(rows: unknown[][]): string[] {
  const seen = new Set<ImportColumnKey>();
  for (const row of rows.slice(0, 20)) {
    for (const cell of row ?? []) {
      const h = normalizeHeader(cell);
      const col = h ? IMPORT_COLUMNS.find((def) => def.match(h)) : undefined;
      if (col) seen.add(col.key);
    }
  }
  return REQUIRED_IMPORT_COLUMNS.filter((k) => !seen.has(k)).map(
    (k) => IMPORT_COLUMNS.find((c) => c.key === k)!.label
  );
}

/** Turns sheet rows (arrays) into per-column cell maps, skipping fully blank rows. */
export function extractRawRows(rows: unknown[][], layout: SheetLayout): RawImportRow[] {
  const out: RawImportRow[] = [];
  for (let r = layout.headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const cells: RawImportCells = {};
    let hasContent = false;
    for (const [key, idx] of Object.entries(layout.columns) as [ImportColumnKey, number][]) {
      const v = row[idx];
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) continue;
      cells[key] = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : String(v);
      if (key !== 'enq_no') hasContent = true;
    }
    // A row with only an Enq No / serial number is an unused template line
    if (hasContent) out.push({ rowNumber: r + 1, cells });
  }
  return out;
}

// ─── Cell parsing ──────────────────────────────────────────────────────────

const BLANK_TOKENS = new Set([
  '', '-', '--', '---', '.', 'na', 'n/a', 'n.a', 'n.a.', 'nil', 'none', 'null', 'nan', 'tbd', 'tba',
  'not decided', 'notdecided', 'not yet decided', 'not known', 'unknown', 'not mentioned', 'pending', 'later',
]);

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/ /g, ' ').replace(/^'+/, '').replace(/\s+/g, ' ').trim();
}

function isBlank(v: unknown): boolean {
  return BLANK_TOKENS.has(cellText(v).toLowerCase());
}

/** Today in India time as YYYY-MM-DD (server and browser agree regardless of their timezone). */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isoFromParts(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Rejects 31/02, 31/04 etc. (Date would roll them into the next month)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

function diffDaysIso(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function monthFromName(name: string): number | undefined {
  return MONTHS[name.toLowerCase().slice(0, name.toLowerCase().startsWith('sept') ? 4 : 3)];
}

function expandYear(y: string): number {
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

/** Excel stores dates as day counts from 1899-12-30 (or 1904-01-01 in the Mac 1904 system). */
function isoFromSerial(serial: number, date1904: boolean): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  const dt = new Date(Date.UTC(1899, 11, 30) + days * 86_400_000);
  return dt.toISOString().slice(0, 10);
}

type DateResult = { iso: string | null; error?: string; warning?: string };

/**
 * Accepts Excel date cells and common typed formats. Day-first (Indian) order is
 * assumed for numeric dates like 05/11/2026; when the second number cannot be a
 * month (e.g. 11/25/2026) it is read month-first and a warning is shown.
 */
export function parseImportDate(v: unknown, label: string, date1904 = false): DateResult {
  if (isBlank(v)) return { iso: null };
  if (typeof v === 'number') {
    const iso = isoFromSerial(v, date1904);
    return iso ? { iso } : { iso: null, error: `${label} "${v}" is not a valid date` };
  }

  const raw = cellText(v);
  const s = raw.replace(/(\d)(st|nd|rd|th)\b/gi, '$1').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  let m: RegExpMatchArray | null;

  // A bare number typed as text, e.g. "46000"
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const iso = isoFromSerial(Number(s), date1904);
    if (iso) return { iso };
  }

  // 2026-11-15, 2026/11/15, 2026.11.15 (optionally followed by a time)
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/))) {
    const iso = isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));
    return iso ? { iso } : { iso: null, error: `${label} "${raw}" is not a real date` };
  }

  // 15/11/2026, 15-11-26, 15.11.2026 (optionally followed by a time)
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[ T].*)?$/))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = expandYear(m[3]!);
    if (b > 12 && a <= 12) {
      const iso = isoFromParts(y, a, b);
      return iso
        ? { iso, warning: `${label} "${raw}" was read as month/day (${iso})` }
        : { iso: null, error: `${label} "${raw}" is not a real date` };
    }
    const iso = isoFromParts(y, b, a);
    return iso ? { iso } : { iso: null, error: `${label} "${raw}" is not a real date` };
  }

  // 15 Nov 2026, 15-Nov-26, 15 November 2026
  if ((m = s.match(/^(\d{1,2})[ \-/.]?([a-z]{3,9})[ \-/.]?(\d{2}|\d{4})$/i))) {
    const month = monthFromName(m[2]!);
    const iso = month ? isoFromParts(expandYear(m[3]!), month, Number(m[1])) : null;
    return iso ? { iso } : { iso: null, error: `${label} "${raw}" is not a real date` };
  }

  // Nov 15 2026, November 15 2026
  if ((m = s.match(/^([a-z]{3,9})[ \-/.]?(\d{1,2})[ \-/.]?(\d{2}|\d{4})$/i))) {
    const month = monthFromName(m[1]!);
    const iso = month ? isoFromParts(expandYear(m[3]!), month, Number(m[2])) : null;
    return iso ? { iso } : { iso: null, error: `${label} "${raw}" is not a real date` };
  }

  return { iso: null, error: `${label} "${raw}" is not a date we can read (use DD/MM/YYYY)` };
}

/** "15/11/2026 - 20/11/2026" or "15 Nov to 20 Nov 2026" typed into the Travel Date cell. */
function splitDateRange(v: unknown): [string, string] | null {
  if (typeof v !== 'string') return null;
  const parts = cellText(v).split(/\s+(?:to|till|until|-|–|—)\s+/i);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

type NumberResult = { value: number | null; error?: string; warning?: string };

function parseWholeNumber(v: unknown, label: string, min: number, max: number): NumberResult {
  if (isBlank(v)) return { value: null };
  let n: number;
  if (typeof v === 'number') n = v;
  else {
    const s = cellText(v);
    const m = s.match(/-?\d+(\.\d+)?/);
    if (!m) return { value: null, error: `${label} "${s}" is not a number` };
    n = Number(m[0]);
  }
  if (!Number.isFinite(n)) return { value: null, error: `${label} is not a number` };
  if (!Number.isInteger(n)) return { value: null, error: `${label} must be a whole number (got ${n})` };
  if (n < min) return { value: null, error: `${label} cannot be less than ${min}` };
  if (n > max) return { value: null, error: `${label} cannot be more than ${max}` };
  return { value: n };
}

/** "5", "5 days", "5D/4N", "4N/5D", "4 nights" → days. */
function parseDays(v: unknown): NumberResult {
  if (isBlank(v)) return { value: null };
  if (typeof v === 'number') return parseWholeNumber(v, 'Number of Days', 1, MAX_DAYS);
  const s = cellText(v).toLowerCase();
  const days = s.match(/(\d+)\s*d/);
  if (days) return parseWholeNumber(Number(days[1]), 'Number of Days', 1, MAX_DAYS);
  const nights = s.match(/(\d+)\s*n/);
  if (nights) {
    const res = parseWholeNumber(Number(nights[1]) + 1, 'Number of Days', 1, MAX_DAYS);
    return res.error ? res : { ...res, warning: `Number of Days "${cellText(v)}" read as ${res.value} days` };
  }
  return parseWholeNumber(s, 'Number of Days', 1, MAX_DAYS);
}

function budgetAmount(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(k|thousand|l|lac|lacs|lakh|lakhs|cr|crore|crores)?\b/i);
  if (!m) return null;
  const base = Number(m[1]);
  const unit = (m[2] ?? '').toLowerCase();
  if (unit === 'k' || unit === 'thousand') return base * 1_000;
  if (unit.startsWith('l')) return base * 100_000;
  if (unit.startsWith('cr')) return base * 10_000_000;
  return base;
}

/** "₹25,000", "Rs. 25000/-", "25k", "1.5 lakh", "20000-30000" (upper end is kept). */
function parseBudget(v: unknown): NumberResult {
  if (isBlank(v)) return { value: null };
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) return { value: null, error: 'Budget cannot be negative' };
    if (v > MAX_BUDGET) return { value: null, error: 'Budget is too large' };
    return { value: Math.round(v * 100) / 100 };
  }
  const raw = cellText(v);
  if (/^-\s*\d/.test(raw)) return { value: null, error: 'Budget cannot be negative' };
  const s = raw
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/₹|inr|rs\.?|rupees?|\/-|per\s*person|pp|approx\.?|around|upto|up to|max|min/g, ' ');
  const parts = s.split(/\s*(?:-|–|to)\s*/).map((p) => budgetAmount(p)).filter((n): n is number => n !== null);
  if (parts.length === 0) {
    return { value: null, warning: `Budget "${raw}" could not be read and was left empty` };
  }
  const value = Math.max(...parts);
  if (value > MAX_BUDGET) return { value: null, error: 'Budget is too large' };
  const rounded = Math.round(value * 100) / 100;
  const plain = /^\d+(\.\d+)?$/.test(s.trim());
  return plain ? { value: rounded } : { value: rounded, warning: `Budget "${raw}" saved as ${rounded}` };
}

type PhoneResult = { phone: string | null; error?: string; warning?: string };

/**
 * Filler numbers typed into sheets, on top of isAllZeroPhone / isFakePhone:
 * one digit 6+ times in a row (9000000000, 6000000001, 7777777770) or only
 * one or two different digits (9999900000, 9898989898, 9999999998).
 */
function isPlaceholderNumber(national: string): boolean {
  const digits = national.replace(/\D/g, '');
  if (/(\d)\1{5,}/.test(digits)) return true;
  return new Set(digits).size <= 2;
}

/** Normalises to +<country><number>, the format website enquiries use. India (+91) is assumed when no code is given. */
export function parseImportPhone(v: unknown): PhoneResult {
  if (isBlank(v)) return { phone: null, error: 'Contact Number is required' };
  const raw = typeof v === 'number' ? String(Math.trunc(v)) : cellText(v);

  if (/\d(\.\d+)?e\+?\d+/i.test(raw)) {
    return { phone: null, error: `Contact Number "${raw}" was shortened by Excel. Format the column as Text and re-enter it` };
  }

  // Several numbers in one cell — keep the first
  const candidates = raw.split(/\s*(?:\/|,|;|\||\bor\b|&)\s*/i).filter((p) => /\d{5,}/.test(p.replace(/\D/g, '')));
  const first = candidates[0] ?? raw;
  const warning = candidates.length > 1 ? `More than one Contact Number found, only ${first.trim()} was saved` : undefined;

  let s = first.replace(/(?:ext|extn|x)\.?\s*\d+$/i, '').replace(/[^\d+]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  const digits = s.replace(/\D/g, '');
  if (!s.startsWith('+')) {
    if (digits.length === 10) s = `+91${digits}`;
    else if (digits.length === 11 && digits.startsWith('0')) s = `+91${digits.slice(1)}`;
    else if (digits.length === 12 && digits.startsWith('91')) s = `+${digits}`;
    else s = `+${digits}`;
  }

  const parsed = parsePhoneNumberFromString(s);
  if (!parsed || !parsed.isPossible()) {
    return { phone: null, error: `Contact Number "${raw}" is not a valid phone number` };
  }
  const e164 = parsed.number;
  if (isAllZeroPhone(e164) || isFakePhone(e164) || isPlaceholderNumber(String(parsed.nationalNumber))) {
    return { phone: null, error: `Contact Number "${raw}" does not look like a real number` };
  }
  return { phone: e164, warning };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ─── Row validation ────────────────────────────────────────────────────────

export interface NormalizeOptions {
  date1904?: boolean;
  today?: string; // YYYY-MM-DD, India time
}

export function normalizeImportRow(row: RawImportRow, opts: NormalizeOptions = {}): NormalizedImportRow {
  const today = opts.today ?? todayInIndia();
  const date1904 = Boolean(opts.date1904);
  const c = row.cells;
  const errors: string[] = [];
  const warnings: string[] = [];
  const note = (res: { error?: string; warning?: string }) => {
    if (res.error) errors.push(res.error);
    if (res.warning) warnings.push(res.warning);
  };

  // Customer name
  const name = cellText(c.customer_name);
  if (isBlank(c.customer_name)) errors.push('Customer Name is required');
  else if (name.length < 2) errors.push('Customer Name must be at least 2 characters');
  else if (!/[a-zÀ-￿]/i.test(name)) errors.push(`Customer Name "${name}" must contain letters`);
  else if (name.length > MAX_NAME) errors.push(`Customer Name must be ${MAX_NAME} characters or fewer`);

  // Phone
  const phone = parseImportPhone(c.contact_number);
  note(phone);

  // Email (optional — a bad one is dropped rather than losing the whole enquiry)
  let email: string | null = null;
  if (!isBlank(c.email)) {
    const first = cellText(c.email).split(/[\s,;/]+/).filter(Boolean)[0]?.toLowerCase() ?? '';
    if (EMAIL_RE.test(first) && first.length <= 254) email = first;
    else warnings.push(`Email "${cellText(c.email)}" is not valid and was left empty`);
  }

  // Enq Date — blank means today; cannot be in the future
  const enq = parseImportDate(c.enquiry_date, 'Enq Date', date1904);
  note(enq);
  let enquiryDate = enq.iso;
  if (!enq.error && !enquiryDate) {
    enquiryDate = today;
    warnings.push('Enq Date is empty, today was used');
  }
  if (enquiryDate && enquiryDate > today) errors.push(`Enq Date ${enquiryDate} is in the future`);
  if (enquiryDate && enquiryDate < '2000-01-01') errors.push(`Enq Date ${enquiryDate} is too far in the past`);

  // Travel / To date (a range typed into the Travel Date cell is split)
  let travelCell: unknown = c.travel_date;
  let toCell: unknown = c.to_date;
  const range = splitDateRange(travelCell);
  if (range && isBlank(toCell)) [travelCell, toCell] = range;

  const travel = parseImportDate(travelCell, 'Travel Date', date1904);
  const to = parseImportDate(toCell, 'To Date', date1904);
  note(travel);
  note(to);
  let travelDate = travel.iso;
  let returnDate = to.iso;

  if (travelDate) {
    if (travelDate < '2000-01-01') errors.push(`Travel Date ${travelDate} is too far in the past`);
    if (travelDate > addDaysIso(today, 3 * 365)) errors.push(`Travel Date ${travelDate} is more than 3 years away`);
    if (enquiryDate && !enq.error && travelDate < enquiryDate) {
      errors.push(`Travel Date ${travelDate} is before the Enq Date ${enquiryDate}`);
    }
  }
  if (returnDate) {
    if (!travelDate) {
      if (!travel.error) warnings.push('To Date was ignored because there is no Travel Date');
      returnDate = null;
    } else if (returnDate < travelDate) {
      errors.push(`To Date ${returnDate} is before the Travel Date ${travelDate}`);
    } else if (diffDaysIso(travelDate, returnDate) > MAX_DAYS) {
      errors.push('To Date must be within 1 year of the Travel Date');
    }
  }

  // Number of days — worked out from the dates when left empty
  const daysRes = parseDays(c.number_of_days);
  note(daysRes);
  let numberOfDays = daysRes.value;
  if (travelDate && returnDate && returnDate >= travelDate) {
    const fromDates = diffDaysIso(travelDate, returnDate) + 1;
    if (numberOfDays === null && !daysRes.error) numberOfDays = fromDates;
    else if (numberOfDays !== null && numberOfDays !== fromDates && numberOfDays !== fromDates - 1) {
      warnings.push(`Number of Days (${numberOfDays}) does not match the dates (${fromDates} days)`);
    }
  }
  // Only Number of Days given → work out the To Date
  if (travelDate && !returnDate && numberOfDays && numberOfDays > 1 && !to.error) {
    returnDate = addDaysIso(travelDate, numberOfDays - 1);
  }

  // Budget
  const budget = parseBudget(c.budget);
  note(budget);

  // Travellers
  const adults = parseWholeNumber(c.adults, 'Adults', 0, MAX_PAX);
  const kids = parseWholeNumber(c.kids, 'Kids', 0, MAX_PAX);
  const infants = parseWholeNumber(c.infants, 'Infants', 0, MAX_PAX);
  note(adults);
  note(kids);
  note(infants);
  let numberOfAdults = adults.value ?? 1;
  if (!adults.error && numberOfAdults < 1) {
    warnings.push('Adults was 0, saved as 1 (an enquiry needs at least one adult)');
    numberOfAdults = 1;
  }

  // Text fields
  let receivedFrom = isBlank(c.received_from) ? null : cellText(c.received_from);
  if (receivedFrom && receivedFrom.length > MAX_RECEIVED_FROM) {
    receivedFrom = receivedFrom.slice(0, MAX_RECEIVED_FROM);
    warnings.push(`Enquiry received from was shortened to ${MAX_RECEIVED_FROM} characters`);
  }
  let destination = isBlank(c.package) ? null : cellText(c.package);
  if (destination && destination.length > MAX_DESTINATION) {
    destination = destination.slice(0, MAX_DESTINATION);
    warnings.push(`Package was shortened to ${MAX_DESTINATION} characters`);
  }

  if (errors.length > 0 || !phone.phone || !enquiryDate) {
    return { rowNumber: row.rowNumber, record: null, errors, warnings };
  }

  return {
    rowNumber: row.rowNumber,
    errors,
    warnings,
    record: {
      enquiry_date: enquiryDate,
      enquiry_received_from: receivedFrom,
      customer_name: name,
      phone: phone.phone,
      email,
      destination,
      travel_date: travelDate,
      return_date: returnDate,
      number_of_days: numberOfDays,
      budget: budget.value,
      number_of_adults: numberOfAdults,
      number_of_children: kids.value ?? 0,
      number_of_infants: infants.value ?? 0,
    },
  };
}

/** Same customer, same day, same package → treated as the same enquiry. */
export function importDuplicateKey(r: Pick<EnquiryImportRecord, 'phone' | 'enquiry_date' | 'destination'>): string {
  return `${r.phone}__${r.enquiry_date}__${(r.destination ?? '').trim().toLowerCase()}`;
}

/** Marks repeats of an earlier row in the same file. Returns the row numbers that are repeats. */
export function findInFileDuplicates(rows: NormalizedImportRow[]): Map<number, number> {
  const firstSeen = new Map<string, number>();
  const repeats = new Map<number, number>(); // rowNumber → first rowNumber
  for (const row of rows) {
    if (!row.record) continue;
    const key = importDuplicateKey(row.record);
    const first = firstSeen.get(key);
    if (first !== undefined) repeats.set(row.rowNumber, first);
    else firstSeen.set(key, row.rowNumber);
  }
  return repeats;
}
