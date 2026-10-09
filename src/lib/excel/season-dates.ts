/**
 * Season date-range parser for the Hotel Rate Master.
 *
 * Turns the free-text "Date Range" column into real date windows, e.g.
 *   "15 Mar – 30 Sep 2026"                          -> 2026-03-15..2026-09-30
 *   "01 Oct – 19 Dec 2026 & 06 Jan – 31 Mar 2027"   -> two windows
 *   "Apr, May, Oct 2026 – Feb 2027"                  -> Apr, May, Oct–Feb
 *   "Oct 2026 – Jan 2027 (excl. 20 Dec – 05 Jan)"    -> window + exclusion window
 *   "Xmas/NY: 20 Dec 2026 – 05 Jan 2027"             -> labelled window
 *   "Pooja 15–21 Oct, Diwali 06–11 Nov, Xmas/NY 20 Dec – 05 Jan" -> three windows
 *   "2026-27" / "Round the year"                     -> 01 Apr 2026 – 31 Mar 2027
 *
 * Text that cannot be read (e.g. "Season (private boats)") returns ok=false
 * with no windows, so the quotation engine falls back to a guessed season
 * and warns, instead of silently treating the rate as valid all year.
 *
 * Months without a year follow the tariff year (Apr–Dec = first year,
 * Jan–Mar = second year).
 */

export type SeasonWindow = { from: string; to: string };
export type SeasonDates = { ok: boolean; ranges: SeasonWindow[]; exclusions: SeasonWindow[]; error?: string };

const MON: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

type End = { y?: number; m?: number; d?: number; yi?: boolean };

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const isMonthWord = (w: string) => w.toLowerCase() in MON;

function parseEnd(s: string): End | null {
  const o: End = {};
  const y = s.match(/\b(20\d\d)\b/);
  if (y) o.y = Number(y[1]);
  for (const w of s.toLowerCase().match(/[a-z]+/g) || []) {
    if (w in MON) {
      o.m = MON[w];
      break;
    }
  }
  const d = s.replace(/\b20\d\d\b/g, '').match(/\b(\d{1,2})\b/);
  const dn = d ? Number(d[1]) : NaN;
  if (dn >= 1 && dn <= 31) o.d = dn;
  return o.m !== undefined || o.d !== undefined ? o : null;
}

function parseCore(text: string, defaultFy: number): SeasonWindow[] | null {
  let t = ` ${text} `.replace(/[–—]/g, '-').replace(/\bto\b/gi, '-');
  t = t.replace(/^[^:\d]*:/, ' '); // "Xmas/NY: ..." label

  // "Till 31 Mar 2027" / "Upto 31 Mar 2027" / "Valid till ..."
  const till = t.match(/\b(?:till|until|upto|up to)\b(.*)$/i);
  if (till) {
    const e = parseEnd(till[1] ?? '');
    if (e && e.m !== undefined) {
      const y = e.y ?? (e.m >= 3 ? defaultFy : defaultFy + 1);
      const fyStart = e.m >= 3 ? y : y - 1;
      return [{ from: iso(fyStart, 3, 1), to: iso(y, e.m, e.d ?? lastDay(y, e.m)) }];
    }
  }

  let fy: number | null = null;
  const fm = t.match(/\b20(\d\d)-(\d\d)\b/);
  if (fm && Number(fm[2]) === Number(fm[1]) + 1) {
    fy = 2000 + Number(fm[1]);
    t = t.replace(fm[0], ' ');
  }
  if (!/\b20\d\d\b/.test(t)) {
    const hasMonth = (t.match(/[A-Za-z]+/g) || []).some(isMonthWord);
    if (!hasMonth) return fm ? [{ from: iso(fy!, 3, 1), to: iso(fy! + 1, 2, 31) }] : null;
    const base = fy ?? defaultFy;
    t = t.replace(/[A-Za-z]+/g, (w) => {
      const m = MON[w.toLowerCase()];
      if (m === undefined) return w;
      return `${w} ${m >= 3 ? base : base + 1}`;
    });
  }

  const segs = t
    .split(/&|,|;|\band\b|\//)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const p = s.split(/\s*-\s*/).filter(Boolean);
      const a = parseEnd(p[0] || '');
      const b = p.length > 1 ? parseEnd(p[p.length - 1] ?? '') : null;
      return a ? { a, b } : null;
    })
    .filter((x): x is { a: End; b: End | null } => !!x);
  if (!segs.length) return null;

  const ends: End[] = [];
  segs.forEach((s) => {
    ends.push(s.a);
    if (s.b) ends.push(s.b);
  });
  for (let i = 0; i < ends.length; i++) {
    const e = ends[i]!;
    if (e.y === undefined) {
      const n = ends.slice(i + 1).find((e) => e.y !== undefined) || ends.slice(0, i).reverse().find((e) => e.y !== undefined);
      if (!n) return null;
      e.y = n.y;
      e.yi = true;
    }
  }

  const out: SeasonWindow[] = [];
  for (const { a, b } of segs) {
    if (b) {
      if (a.m === undefined) a.m = b.m;
      if (b.m === undefined) b.m = a.m;
      if (a.m === undefined || b.m === undefined) continue;
      let ay = a.y!;
      const by = b.y!;
      const startKey = (y: number) => y * 400 + a.m! * 32 + (a.d || 1);
      const endKey = by * 400 + b.m * 32 + (b.d || 31);
      if (startKey(ay) > endKey && (a.yi || ay === by)) ay = by - 1; // "15 Dec – 15 Jan 2027"
      else if (startKey(ay) > endKey && startKey(by) <= endKey) ay = by; // "Feb – Sep 2026-27"
      if (startKey(ay) > endKey) continue;
      out.push({ from: iso(ay, a.m, Math.min(a.d || 1, lastDay(ay, a.m))), to: iso(by, b.m, Math.min(b.d || lastDay(by, b.m), lastDay(by, b.m))) });
    } else {
      if (a.m === undefined) continue;
      const y = a.y!;
      out.push(a.d ? { from: iso(y, a.m, a.d), to: iso(y, a.m, a.d) } : { from: iso(y, a.m, 1), to: iso(y, a.m, lastDay(y, a.m)) });
    }
  }
  return out.length ? out : null;
}

export function parseSeasonDates(input: string | null | undefined, defaultFy = 2026): SeasonDates {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, ranges: [], exclusions: [], error: 'Date range is empty' };
  const lower = raw.toLowerCase();
  if (/round the year|all year|year round|throughout the year/.test(lower)) {
    const y = raw.match(/\b(20\d\d)\b/);
    const fy = y ? Number(y[1]) : defaultFy;
    return { ok: true, ranges: [{ from: iso(fy, 3, 1), to: iso(fy + 1, 2, 31) }], exclusions: [] };
  }

  // Exclusions written in brackets: "(excl. 20 Dec – 05 Jan)", "(excluding peak dates 20 Dec - 05 Jan)"
  const exclusionTexts: string[] = [];
  const main = raw.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    if (/\bexcl/i.test(inner)) exclusionTexts.push(inner.replace(/^.*?\bexcl(?:\.|uding|udes?)?\s*/i, ''));
    return ' ';
  });

  const ranges = parseCore(main, defaultFy);
  if (!ranges) return { ok: false, ranges: [], exclusions: [], error: `Could not read the date range "${raw}"` };

  const exclusions: SeasonWindow[] = [];
  const firstYear = Number(ranges[0]!.from.slice(0, 4));
  for (const ex of exclusionTexts) {
    if (!/\d/.test(ex)) continue; // "(excl. festival dates)" – nothing to parse
    const w = parseCore(ex, firstYear);
    if (w) {
      // Pin each exclusion inside the main ranges (e.g. 20 Dec – 05 Jan of the season's own years)
      for (const x of w) {
        const fits = ranges.some((r) => x.from >= r.from && x.to <= r.to);
        if (fits) exclusions.push(x);
        else {
          const shifted = { from: `${+x.from.slice(0, 4) + 1}${x.from.slice(4)}`, to: `${+x.to.slice(0, 4) + 1}${x.to.slice(4)}` };
          exclusions.push(ranges.some((r) => shifted.from >= r.from && shifted.to <= r.to) ? shifted : x);
        }
      }
    }
  }
  return { ok: true, ranges, exclusions };
}
