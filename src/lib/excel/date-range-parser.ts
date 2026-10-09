/**
 * Date Range Parser for Hotel Rate Master
 * Handles date formats commonly found in hotel rate master sheets:
 * 1. Single range with shared month & year: "16 – 24 Oct 2026"
 * 2. Single range with shared year: "15 Mar – 30 Sep 2026"
 * 3. Multi-range split with '&' or 'and': "01 Oct – 19 Dec 2026 & 06 Jan – 31 Mar 2027"
 * 4. Named event prefixes: "Xmas/NY: 20 Dec 2026 – 05 Jan 2027", "Pooja: 16 – 24 Oct 2026", "Diwali: 06 – 20 Nov 2026"
 * 5. Range with exclusions: "01 Oct 2026 – 31 Mar 2027 (excl. peak dates 20 Dec - 05 Jan)"
 * 6. Year rollover: "15 Dec – 15 Jan 2027" -> 2026-12-15 to 2027-01-15
 * 7. Text validity: "Round the year", "All year", "On request"
 * 8. Various delimiters: en-dash (–), em-dash (—), hyphen (-), 'to'
 */

import { parseSeasonDates } from './season-dates';

export interface ParsedDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isExclusion?: boolean;
}

export interface DateRangeParseResult {
  raw: string;
  ranges: ParsedDateRange[];
  exclusions: ParsedDateRange[];
  notes?: string;
  isValid: boolean;
  error?: string;
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatDateString(year: number, month: number, day: number): string {
  return `${year}-${padZero(month)}-${padZero(day)}`;
}

interface PartialDate {
  day: number;
  month?: number;
  year?: number;
}

/**
 * Parses expressions like "15 Mar 2026", "15 Mar", "01-10-2026", "15/03/2026", or just day "16"
 */
function parseDateToken(token: string): PartialDate | null {
  const clean = token.trim();
  if (!clean) return null;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { day, month, year };
    }
  }

  // DD Month YYYY or DD Month
  const nameMatch = clean.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
  if (nameMatch && nameMatch[1] && nameMatch[2]) {
    const day = parseInt(nameMatch[1], 10);
    const monthKey = nameMatch[2].toLowerCase();
    const month = MONTH_MAP[monthKey];
    const year = nameMatch[3] ? parseInt(nameMatch[3], 10) : undefined;
    if (day >= 1 && day <= 31 && month !== undefined) {
      return { day, month, year };
    }
  }

  // Month DD, YYYY or Month DD
  const nameMatchRev = clean.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (nameMatchRev && nameMatchRev[1] && nameMatchRev[2]) {
    const monthKey = nameMatchRev[1].toLowerCase();
    const month = MONTH_MAP[monthKey];
    const day = parseInt(nameMatchRev[2], 10);
    const year = nameMatchRev[3] ? parseInt(nameMatchRev[3], 10) : undefined;
    if (day >= 1 && day <= 31 && month !== undefined) {
      return { day, month, year };
    }
  }

  // Just day number (e.g. "16" in "16 - 24 Oct 2026")
  const justDayMatch = clean.match(/^(\d{1,2})$/);
  if (justDayMatch && justDayMatch[1]) {
    const day = parseInt(justDayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return { day };
    }
  }

  return null;
}

/**
 * Parses a single sub-range string like "15 Mar – 30 Sep 2026", "16 – 24 Oct 2026", or "15 Dec – 15 Jan 2027"
 */
function parseSingleRange(rangeStr: string, fallbackYear?: number): ParsedDateRange | null {
  // Strip any leading prefix before a colon, e.g. "Xmas/NY: ", "Pooja: ", "Diwali: ", "Peak: "
  let cleanRange = rangeStr.replace(/^[A-Za-z0-9/\s&_\-().]+:\s*/, '').trim();

  // Normalize delimiters (en-dash, em-dash, 'to', hyphens between words)
  const normalized = cleanRange
    .replace(/[–—]/g, '-')
    .replace(/\s+to\s+/gi, ' - ')
    .trim();

  // Split on hyphen
  let parts: string[] = [];
  if (normalized.includes(' - ')) {
    parts = normalized.split(' - ');
  } else if (normalized.includes('-')) {
    const idx = normalized.indexOf('-');
    parts = [normalized.slice(0, idx), normalized.slice(idx + 1)];
  }

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const startPart = parseDateToken(parts[0]);
  const endPart = parseDateToken(parts[1]);

  if (!startPart || !endPart) {
    return null;
  }

  // If startPart only has day (e.g. "16" in "16 - 24 Oct 2026"), inherit month from endPart
  if (!startPart.month && endPart.month) {
    startPart.month = endPart.month;
  }
  if (!startPart.month) {
    startPart.month = 1;
  }
  if (!endPart.month) {
    endPart.month = startPart.month;
  }

  // Determine years
  let startYear = startPart.year;
  let endYear = endPart.year;

  if (!startYear && !endYear) {
    const baseYear = fallbackYear || 2026;
    if (startPart.month > endPart.month) {
      // e.g. Dec to Jan across new year
      startYear = baseYear;
      endYear = baseYear + 1;
    } else {
      startYear = baseYear;
      endYear = baseYear;
    }
  } else if (!startYear && endYear) {
    if (startPart.month > endPart.month) {
      startYear = endYear - 1;
    } else {
      startYear = endYear;
    }
  } else if (startYear && !endYear) {
    if (endPart.month < startPart.month) {
      endYear = startYear + 1;
    } else {
      endYear = startYear;
    }
  }

  const finalStartYear = startYear || fallbackYear || 2026;
  const finalEndYear = endYear || fallbackYear || 2026;

  return {
    startDate: formatDateString(finalStartYear, startPart.month, startPart.day),
    endDate: formatDateString(finalEndYear, endPart.month, endPart.day),
  };
}

/**
 * Main parser for date ranges
 */
export function parseDateRange(input: string | null | undefined, defaultYear: number = 2026): DateRangeParseResult {
  if (!input || !input.trim()) {
    // Default standard season dates if empty
    return {
      raw: '',
      ranges: [{ startDate: `${defaultYear}-04-01`, endDate: `${defaultYear + 1}-03-31` }],
      exclusions: [],
      isValid: true,
    };
  }

  const raw = input.trim();
  let notes: string | undefined;

  // Delegates to the season parser (src/lib/excel/season-dates.ts). The
  // previous implementation fell back to the whole tariff year whenever it
  // could not read a label (e.g. "Oct 2026 – Jan 2027", "Mar & Jun – Sep
  // 2026"), which made those rates look valid on every date and priced
  // quotations from the wrong season. Unreadable labels are now reported
  // as warnings with no date windows instead.
  const parsed = parseSeasonDates(raw, defaultYear);
  const exclMatch = raw.match(/\((?:excl\.?|excluding)[^)]*\)/i);
  if (exclMatch) notes = exclMatch[0];
  if (!parsed.ok) {
    return { raw, ranges: [], exclusions: [], notes: raw, isValid: false, error: parsed.error };
  }
  return {
    raw,
    ranges: parsed.ranges.map((r) => ({ startDate: r.from, endDate: r.to })),
    exclusions: parsed.exclusions.map((r) => ({ startDate: r.from, endDate: r.to, isExclusion: true })),
    notes,
    isValid: true,
  };
}
