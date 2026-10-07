import * as XLSX from 'xlsx';

export interface MasterHotelRateItem {
  id?: string;
  location?: string | null;
  hotelName?: string | null;
  hotelCategory?: string | null;
  season?: string | null;
  dateRange?: string | null;
  roomCategory?: string | null;
  cpCost?: number | null;
  mapCost?: number | null;
  extraAdultCP?: number | null;
  extraAdultMAP?: number | null;
  childBedCost?: number | null;
  childNoBedCost?: number | null;
  infantPolicy?: string | null;
  mandatorySurcharges?: string | null;
  notes?: string | null;
}

export interface ParseResult {
  success: boolean;
  data: MasterHotelRateItem[];
  errors: string[];
  totalRows: number;
  detectedHeaders: { key: string; label: string }[];
  sheetName?: string;
  allSheetsFound?: string[];
}

/**
 * Standard default headers for reference & sample template generation.
 */
export const DEFAULT_TEMPLATE_HEADERS = [
  'Location',
  'Hotel Name',
  'Hotel Category',
  'Season',
  'Date Range',
  'Room Category',
  'CP Cost',
  'MAP Cost',
  'Extra Adult CP',
  'Extra Adult MAP',
  'Child Bed Cost',
  'Child No Bed Cost',
  'Infant Policy',
  'Mandatory Surcharges',
  'Notes',
] as const;

/**
 * Flexible aliases for recognizing common hotel tariff headers across different Excel styles.
 */
const CANONICAL_FIELD_ALIASES: Record<string, string[]> = {
  extraAdultMAP: [
    'extra adult map', 'extra adult (map)', 'ex adult map', 'eapb (map)', 'eapb map',
    'adult map', 'extra bed map', 'extra bed (map)', 'ext adult map', 'extra adult with map',
    'extra_adult_map', 'extra bed with map', 'extra person map', 'ex bed map',
    'extra bed map rate', 'adult with map', 'extra person (map)',
  ],
  extraAdultCP: [
    'extra adult cp', 'extra adult (cp)', 'ex adult cp', 'eapb (cp)', 'eapb cp',
    'adult cp', 'extra bed cp', 'extra bed (cp)', 'ext adult cp', 'extra adult with cp',
    'extra_adult_cp', 'eapb', 'extra adult', 'extra bed', 'extra person cp',
    'extra adult rate', 'ex bed cp', 'extra bed cp rate', 'extra person',
  ],
  childNoBedCost: [
    'child no bed cost', 'child no bed', 'child without bed', 'cnb', 'child without bed (cp)',
    'cnb rate', 'cnb cost', 'child without bed cost', 'child without bed rate',
    'cnb (cp)', 'child_no_bed_cost', 'child w/o bed', 'child wo bed', 'child without extra bed',
    'cnb (map)', 'child no bed map',
  ],
  childBedCost: [
    'child bed cost', 'child bed', 'child with bed', 'cwb', 'child with bed (cp)',
    'child with bed cost', 'child bed rate', 'cwb rate', 'cwb cost', 'child with bed rate',
    'cwb (cp)', 'child_bed_cost', 'child w bed', 'child with extra bed', 'cwb (map)',
    'child bed map',
  ],
  cpCost: [
    'cp cost', 'cp rate', 'cp', 'continental plan', 'room with breakfast',
    'bb', 'b&b', 'bed & breakfast', 'breakfast rate', 'cp single', 'cp double',
    'cpcost', 'cp_cost', 'cp_rate', 'cp tariff', 'cp per room', 'room + breakfast',
    'cp basis', 'bb rate', 'cp per night', 'cp plan', 'breakfast cost',
  ],
  mapCost: [
    'map cost', 'map rate', 'map', 'modified american plan', 'half board', 'hb',
    'dinner rate', 'room with dinner', 'mapcost', 'map_cost', 'map_rate',
    'map tariff', 'map per room', 'room + dinner', 'map basis', 'hb rate',
    'map per night', 'map plan', 'dinner cost',
  ],
  mandatorySurcharges: [
    'mandatory surcharges', 'surcharges', 'surcharge', 'gala dinner', 'peak surcharge',
    'mandatory charges', 'taxes / surcharges', 'peak season surcharge', 'supplements',
    'mandatory_surcharges', 'gala_dinner', 'gala dinner charges', 'supplement charges',
    'festive surcharge', 'peak period surcharge',
  ],
  infantPolicy: [
    'infant policy', 'infant', 'infants', 'child policy', 'baby policy', 'infant terms',
    'infant_policy', 'children policy', 'kids policy', 'kid policy', 'infant rate',
  ],
  roomCategory: [
    'room category', 'room type', 'room', 'room cat', 'category of room',
    'room name', 'occupancy', 'roomtype', 'room_type', 'room_category',
    'type of room', 'room / category', 'room description',
  ],
  hotelCategory: [
    'hotel category', 'hotel cat', 'star', 'stars', 'star rating',
    'hotel rating', 'hotel star', 'classification', 'hotel standard',
  ],
  dateRange: [
    'date range', 'dates', 'date', 'validity', 'valid from to', 'travel dates',
    'period dates', 'validity dates', 'valid from', 'valid till', 'stay dates',
    'validity period', 'from - to', 'date_range', 'travel period', 'validity date',
    'travel date', 'duration',
  ],
  season: [
    'season', 'seasonality', 'period', 'season type', 'season name', 'season_name',
    'season name / period', 'tariff season', 'season period',
  ],
  location: [
    'location', 'city', 'destination', 'dest', 'place', 'state', 'region', 'area',
    'town', 'city name', 'location name', 'station', 'district', 'dist', 'zone',
  ],
  hotelName: [
    'hotel name', 'hotel', 'property', 'property name', 'resort', 'resort name',
    'accommodation', 'hotel / resort', 'hotelname', 'hotel_name', 'hotel / property',
    'hotel property', 'hotels', 'stay', 'hotel / resort name', 'hotel & resort',
  ],
  notes: [
    'notes', 'note', 'remarks', 'remark', 'comments', 'comment', 'special conditions',
    'inclusions', 'terms', 'policies', 'extra notes', 'note / remarks', 'description',
    'hotel notes', 'general remarks', 'special inclusions',
  ],
};

const FIELD_MATCH_PRIORITY: string[] = [
  'extraAdultMAP',
  'extraAdultCP',
  'childNoBedCost',
  'childBedCost',
  'cpCost',
  'mapCost',
  'mandatorySurcharges',
  'infantPolicy',
  'roomCategory',
  'hotelCategory',
  'dateRange',
  'season',
  'location',
  'hotelName',
  'notes',
];

const NUMERIC_FIELDS = new Set([
  'cpCost',
  'mapCost',
  'extraAdultCP',
  'extraAdultMAP',
  'childBedCost',
  'childNoBedCost',
]);

/**
 * Normalizes header string for comparison: removes punctuation, lowercases, single spaces.
 */
function cleanHeaderString(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[_\-/().]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Converts any arbitrary header string into clean camelCase.
 */
function toCamelCaseKey(raw: string, colIndex: number): string {
  const cleaned = raw.trim().replace(/[_\-/().]+/g, ' ').trim();
  if (!cleaned) return `column${colIndex + 1}`;

  const words = cleaned.split(/\s+/);
  if (words.length === 0 || !words[0]) return `column${colIndex + 1}`;

  const first = words[0].toLowerCase();
  const rest = words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const res = (first + rest.join('')).replace(/[^a-zA-Z0-9]/g, '');
  return res || `column${colIndex + 1}`;
}

/**
 * Matches a raw header against known canonical hotel fields.
 * Returns { key, label } if matched, or null to discard non-canonical columns.
 */
function resolveHeaderKey(rawHeader: string | null | undefined): {
  key: keyof Omit<MasterHotelRateItem, 'id'>;
  label: string;
} | null {
  if (!rawHeader || typeof rawHeader !== 'string' || !rawHeader.trim()) {
    return null;
  }

  const cleaned = cleanHeaderString(rawHeader);

  // Pass 1: Exact alias match
  for (const field of FIELD_MATCH_PRIORITY) {
    const aliases = CANONICAL_FIELD_ALIASES[field];
    if (aliases && aliases.some((alias) => cleaned === alias)) {
      return {
        key: field as keyof Omit<MasterHotelRateItem, 'id'>,
        label: rawHeader.trim(),
      };
    }
  }

  // Pass 2: Fuzzy / Substring match in priority order with guards
  for (const field of FIELD_MATCH_PRIORITY) {
    // Conflict guards:
    // If field is CP, cleaned cannot contain 'map'
    if ((field === 'cpCost' || field === 'extraAdultCP') && cleaned.includes('map')) continue;
    // If field is MAP, cleaned cannot contain 'cp'
    if ((field === 'mapCost' || field === 'extraAdultMAP') && cleaned.includes('cp')) continue;
    // If field is hotelCategory, cleaned cannot contain 'room'
    if (field === 'hotelCategory' && cleaned.includes('room')) continue;
    // If field is hotelName, cleaned cannot contain 'room'
    if (field === 'hotelName' && cleaned.includes('room')) continue;

    const aliases = CANONICAL_FIELD_ALIASES[field];
    if (
      aliases &&
      aliases.some((alias) => {
        if (alias.length < 3) return cleaned === alias;
        return cleaned.includes(alias);
      })
    ) {
      return {
        key: field as keyof Omit<MasterHotelRateItem, 'id'>,
        label: rawHeader.trim(),
      };
    }
  }

  // Not a canonical field - discard
  return null;
}

/**
 * Safely parses numeric value. Handles strings with currency symbols and commas.
 */
function parseNumericValue(val: unknown, fieldName: string, rowNum: number, errors: string[]): number | null {
  if (val === null || val === undefined || val === '') return null;

  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (
      trimmed === '' ||
      trimmed === '-' ||
      trimmed.toLowerCase() === 'nil' ||
      trimmed.toLowerCase() === 'na' ||
      trimmed.toLowerCase() === 'n/a'
    ) {
      return null;
    }

    // Strip currency symbols (₹, $, €, £) and commas
    const cleaned = trimmed.replace(/[₹$€£,]/g, '').trim();
    const parsed = Number(cleaned);

    if (isNaN(parsed)) {
      errors.push(`Row ${rowNum}: "${fieldName}" has non-numeric value "${val.trim()}".`);
      return null;
    }
    return parsed;
  }

  return null;
}

/**
 * Parses generic cell value (string, number, boolean, or Date).
 */
function parseGenericValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    const d = val.getDate().toString().padStart(2, '0');
    const m = (val.getMonth() + 1).toString().padStart(2, '0');
    const y = val.getFullYear();
    return `${d}-${m}-${y}`;
  }
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

/**
 * Finds the sheet corresponding to "Rate Master" from a workbook's sheet names.
 * Resilient to casing, spacing, underscores, hyphens, and common variations.
 */
export function findRateMasterSheetName(sheetNames: string[]): string | null {
  if (!sheetNames || sheetNames.length === 0) return null;

  // 1. Exact case-insensitive match (trimmed): "rate master", "rate masters", "rates master"
  const exact = sheetNames.find((s) => {
    const norm = s.trim().toLowerCase();
    return (
      norm === 'rate master' ||
      norm === 'rate masters' ||
      norm === 'rates master' ||
      norm === 'master rates' ||
      norm === 'master rate'
    );
  });
  if (exact) return exact;

  // 2. Exact match after removing all whitespace, underscores, hyphens
  const compactMatch = sheetNames.find((s) => {
    const compact = s.toLowerCase().replace(/[\s_\-]+/g, '');
    return (
      compact === 'ratemaster' ||
      compact === 'ratemasters' ||
      compact === 'ratesmaster' ||
      compact === 'masterrates' ||
      compact === 'masterrate'
    );
  });
  if (compactMatch) return compactMatch;

  // 3. Substring match: Contains both "rate" and "master" (e.g. "Hotel Rate Master", "Rate Master 2026")
  const bothMatch = sheetNames.find((s) => {
    const lower = s.toLowerCase();
    return lower.includes('rate') && lower.includes('master');
  });
  if (bothMatch) return bothMatch;

  // 4. Fallback: If the workbook only has 1 sheet in total, use that single sheet
  if (sheetNames.length === 1 && sheetNames[0]) {
    return sheetNames[0];
  }

  return null;
}

/**
 * Scans the first 15 rows of the sheet to determine the actual header row.
 * Scores by text column count and weighted presence of hotel/tariff keywords.
 */
function detectHeaderRowIndex(rawRows: unknown[][]): number {
  if (rawRows.length === 0) return 0;

  let bestIndex = 0;
  let bestScore = -1;
  const maxScan = Math.min(15, rawRows.length);

  for (let r = 0; r < maxScan; r++) {
    const row = rawRows[r] || [];
    if (!Array.isArray(row)) continue;

    const textCells = row.filter(
      (c) => c !== null && c !== undefined && String(c).trim().length > 0
    );
    const count = textCells.length;
    if (count === 0) continue;

    let keywordScore = 0;
    for (const cell of textCells) {
      const s = String(cell).toLowerCase().trim();
      if (
        s.includes('hotel') ||
        s.includes('location') ||
        s.includes('city') ||
        s.includes('dest') ||
        s.includes('place') ||
        s.includes('room') ||
        s.includes('cat') ||
        s.includes('rate') ||
        s.includes('cost') ||
        s.includes('cp') ||
        s.includes('map') ||
        s.includes('adult') ||
        s.includes('child') ||
        s.includes('season') ||
        s.includes('valid') ||
        s.includes('date') ||
        s.includes('plan') ||
        s.includes('bed') ||
        s.includes('cwb') ||
        s.includes('cnb') ||
        s.includes('note') ||
        s.includes('remark') ||
        s.includes('surcharge')
      ) {
        keywordScore += 4;
      }
    }

    const totalScore = count + keywordScore;
    if (totalScore > bestScore && count >= 2) {
      bestScore = totalScore;
      bestIndex = r;
    }
  }

  return bestIndex;
}

/**
 * Parses any Excel file buffer without requiring exact predefined headers.
 * Specifically extracts data ONLY from the "Rate Master" tab when multiple sheets exist.
 * Extracts data dynamically, mapping recognized hotel fields while preserving
 * any custom headers the user provides in their spreadsheet.
 */
export function parseMasterExcel(buffer: ArrayBuffer | Uint8Array | Buffer): ParseResult {
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      raw: true,
    });
  } catch (err: unknown) {
    return {
      success: false,
      data: [],
      errors: ['Failed to read Excel file. Please ensure it is a valid .xlsx or .xls file.'],
      totalRows: 0,
      detectedHeaders: [],
    };
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      success: false,
      data: [],
      errors: ['The uploaded Excel workbook contains no sheets.'],
      totalRows: 0,
      detectedHeaders: [],
    };
  }

  // Find the "Rate Master" tab specifically
  const targetSheetName = findRateMasterSheetName(workbook.SheetNames);
  if (!targetSheetName) {
    const sheetList = workbook.SheetNames.map((s) => `"${s}"`).join(', ');
    return {
      success: false,
      data: [],
      errors: [
        `Could not find the "Rate Master" tab in this Excel workbook. Found ${workbook.SheetNames.length} tab(s): [${sheetList}]. Please ensure your rates sheet tab is named "Rate Master".`,
      ],
      totalRows: 0,
      detectedHeaders: [],
      allSheetsFound: workbook.SheetNames,
    };
  }

  const worksheet = workbook.Sheets[targetSheetName];
  if (!worksheet) {
    return {
      success: false,
      data: [],
      errors: [`Could not read the worksheet "${targetSheetName}".`],
      totalRows: 0,
      detectedHeaders: [],
      sheetName: targetSheetName,
      allSheetsFound: workbook.SheetNames,
    };
  }

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  if (!rawRows || rawRows.length === 0) {
    return {
      success: false,
      data: [],
      errors: [`The "${targetSheetName}" worksheet is empty.`],
      totalRows: 0,
      detectedHeaders: [],
      sheetName: targetSheetName,
      allSheetsFound: workbook.SheetNames,
    };
  }

  // Determine header row dynamically (supports banners/title rows above headers)
  const headerRowIndex = detectHeaderRowIndex(rawRows);
  const headerRow = (rawRows[headerRowIndex] as unknown[]) || [];
  const prevRow = headerRowIndex > 0 ? (rawRows[headerRowIndex - 1] as unknown[]) : null;

  // Track parent headers across merged horizontal spans in row directly above
  let currentParent = '';
  const parentHeaders: string[] = [];
  if (prevRow) {
    for (let c = 0; c < Math.max(headerRow.length, prevRow.length); c++) {
      const val = prevRow[c] !== null && prevRow[c] !== undefined ? String(prevRow[c]).trim() : '';
      if (val) {
        currentParent = val;
      }
      parentHeaders[c] = currentParent;
    }
  }

  const columnMappings: { colIdx: number; key: keyof Omit<MasterHotelRateItem, 'id'>; label: string }[] = [];
  const seenKeys = new Set<string>();

  headerRow.forEach((cell, colIdx) => {
    const rawCellStr = cell !== null && cell !== undefined ? String(cell).trim() : '';
    const parentStr = parentHeaders[colIdx] || '';

    let headerStr = rawCellStr;
    // If parent header exists and adds meaningful context (e.g. "Extra Adult" + "CP" -> "Extra Adult CP")
    if (parentStr && rawCellStr && !parentStr.toLowerCase().includes(rawCellStr.toLowerCase())) {
      const combined = `${parentStr} ${rawCellStr}`;
      const resolvedCombined = resolveHeaderKey(combined);
      if (resolvedCombined && resolvedCombined.key in CANONICAL_FIELD_ALIASES) {
        headerStr = combined;
      }
    } else if (!headerStr && parentStr) {
      headerStr = parentStr;
    }

    const resolved = resolveHeaderKey(headerStr);
    if (!resolved) {
      // Discard any non-canonical or auxiliary calculation column
      return;
    }

    // Discard duplicate occurrences of canonical fields (only keep primary)
    if (seenKeys.has(resolved.key)) {
      return;
    }
    seenKeys.add(resolved.key);

    columnMappings.push({ colIdx, key: resolved.key, label: resolved.label });
  });

  const detectedHeaders = columnMappings.map((m) => ({ key: m.key, label: m.label }));

  // Extract data rows strictly mapping only to the 15 canonical fields
  const items: MasterHotelRateItem[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = (rawRows[r] as unknown[]) || [];
    const excelRowNum = r + 1;

    // Check if row has any non-empty content
    const hasAnyContent = row.some((c) => c !== null && c !== undefined && String(c).trim() !== '');
    if (!hasAnyContent) continue;

    const rowObj: MasterHotelRateItem = {
      location: null,
      hotelName: null,
      hotelCategory: null,
      season: null,
      dateRange: null,
      roomCategory: null,
      cpCost: null,
      mapCost: null,
      extraAdultCP: null,
      extraAdultMAP: null,
      childBedCost: null,
      childNoBedCost: null,
      infantPolicy: null,
      mandatorySurcharges: null,
      notes: null,
    };

    columnMappings.forEach(({ colIdx, key, label }) => {
      const rawVal = colIdx < row.length ? row[colIdx] : null;

      if (NUMERIC_FIELDS.has(key)) {
        (rowObj as Record<string, unknown>)[key] = parseNumericValue(rawVal, label, excelRowNum, errors);
      } else {
        const gen = parseGenericValue(rawVal);
        (rowObj as Record<string, unknown>)[key] = gen !== null && gen !== undefined ? String(gen) : null;
      }
    });

    // Check if row has meaningful hotel/tariff content (avoid trailing empty rows)
    const isMeaningfulRow = Boolean(
      (rowObj.hotelName && rowObj.hotelName.trim()) ||
      (rowObj.roomCategory && rowObj.roomCategory.trim()) ||
      (rowObj.cpCost !== null && rowObj.cpCost !== undefined) ||
      (rowObj.mapCost !== null && rowObj.mapCost !== undefined)
    );
    if (!isMeaningfulRow) continue;

    items.push(rowObj);
  }

  if (items.length === 0) {
    errors.push(`No data rows could be extracted from sheet "${targetSheetName}".`);
  }

  return {
    success: errors.length === 0,
    data: items,
    errors,
    totalRows: items.length,
    detectedHeaders,
    sheetName: targetSheetName,
    allSheetsFound: workbook.SheetNames,
  };
}

/**
 * Creates a sample Excel workbook buffer that admins can download as a template.
 */
export function generateSampleExcelBuffer(): Buffer {
  const sampleData = [
    {
      'Location': 'Kerala',
      'Hotel Name': 'Example Hotel',
      'Hotel Category': '5 Star',
      'Season': 'Peak',
      'Date Range': '01-12-2026 to 31-01-2027',
      'Room Category': 'Deluxe',
      'CP Cost': 5000,
      'MAP Cost': 6500,
      'Extra Adult CP': 1500,
      'Extra Adult MAP': 2000,
      'Child Bed Cost': 1000,
      'Child No Bed Cost': 500,
      'Infant Policy': 'Free up to 5 yrs',
      'Mandatory Surcharges': 'Xmas & New Year Gala Dinner extra',
      'Notes': 'Subject to availability at time of booking',
    },
    {
      'Location': 'Munnar',
      'Hotel Name': 'Tea Valley Resort',
      'Hotel Category': '4 Star',
      'Season': 'Regular',
      'Date Range': '01-02-2027 to 31-03-2027',
      'Room Category': 'Executive Valley View',
      'CP Cost': 4200,
      'MAP Cost': 5400,
      'Extra Adult CP': 1200,
      'Extra Adult MAP': 1600,
      'Child Bed Cost': 800,
      'Child No Bed Cost': 400,
      'Infant Policy': 'Complimentary',
      'Mandatory Surcharges': 'None',
      'Notes': 'Includes breakfast and Wi-Fi',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, {
    header: [...DEFAULT_TEMPLATE_HEADERS],
  });

  worksheet['!cols'] = [
    { wch: 15 },
    { wch: 25 },
    { wch: 16 },
    { wch: 12 },
    { wch: 28 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 16 },
    { wch: 15 },
    { wch: 18 },
    { wch: 20 },
    { wch: 30 },
    { wch: 35 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rate Master');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
