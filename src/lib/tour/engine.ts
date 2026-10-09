/**
 * Quotation engine — the pricing and itinerary logic of the Travinco
 * Itinerary Builder, ported to TypeScript and to the relational Rate Master.
 *
 * Pure functions only (no Supabase, no React): the builder runs it in the
 * browser for the live preview, and saveQuotation() runs the same code on
 * the server so the stored totals never depend on the client.
 */
import type {
  DayPlan,
  DayEdit,
  HotelPick,
  PlanItem,
  QuoteInputs,
  QuoteSnapshot,
  RateRow,
  StayInput,
  TourLocation,
  TourMasters,
} from './types';

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
/** Indian digit grouping (12,34,567) without relying on the runtime's locale data, so server and browser render identically. */
export const inr = (n: number) => {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v));
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (v < 0 ? '-' : '') + (rest ? `${rest},${last3}` : last3);
};
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dayNo = (iso: string) => {
  const [y = 1970, m = 1, d = 1] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 864e5;
};
export const addDays = (iso: string, n: number) => new Date((dayNo(iso) + n) * 864e5).toISOString().slice(0, 10);
const asDate = (iso: string) => new Date(dayNo(iso) * 864e5);
export const fmtDay = (iso: string) => {
  const d = asDate(iso);
  return `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
};
export const fmtNumDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
};
export const fmtLong = (iso: string) => {
  const d = asDate(iso);
  return `${d.getUTCDate()} ${MO[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export const uid = () => Math.random().toString(36).slice(2, 9);

export const totalNights = (inputs: Pick<QuoteInputs, 'stays'>) =>
  inputs.stays.reduce((a, s) => a + Math.max(0, s.nights | 0), 0);

export const emptyPick = (): HotelPick => ({ hotel_id: null, room_type_id: null, manual_rate: null });
export const newStay = (location_id: number, nights = 1): StayInput => ({
  uid: uid(),
  location_id,
  nights,
  opt1: emptyPick(),
  opt2: emptyPick(),
});

// ---------------------------------------------------------------------
// Context: indexes built once from masters + rates
// ---------------------------------------------------------------------

export type HotelIdx = {
  id: number;
  name: string;
  location_id: number;
  cats: Set<number>;
  rooms: Map<number, { id: number; name: string; category_id: number | null; rows: RateRow[] }>;
};

export type EngineCtx = {
  m: TourMasters;
  loc: Map<number, TourLocation>;
  hotels: Map<number, HotelIdx>;
  role: { canOverrideMarkup: boolean };
};

export function buildCtx(m: TourMasters, rates: RateRow[], canOverrideMarkup: boolean): EngineCtx {
  const loc = new Map(m.locations.map((l) => [l.id, l]));
  const hotels = new Map<number, HotelIdx>();
  for (const r of rates) {
    let H = hotels.get(r.hotel_id);
    if (!H) {
      H = { id: r.hotel_id, name: r.hotel_name, location_id: r.location_id, cats: new Set(), rooms: new Map() };
      hotels.set(r.hotel_id, H);
    }
    if (r.category_id != null) H.cats.add(r.category_id);
    let room = H.rooms.get(r.room_type_id);
    if (!room) {
      room = { id: r.room_type_id, name: r.room_name, category_id: r.category_id, rows: [] };
      H.rooms.set(r.room_type_id, room);
    }
    room.rows.push(r);
  }
  return { m, loc, hotels, role: { canOverrideMarkup } };
}

export const locName = (ctx: EngineCtx, id: number | null | undefined) => {
  if (id == null) return '';
  const l = ctx.loc.get(id);
  return l ? l.display_name || l.name : '';
};
const isHB = (ctx: EngineCtx, id: number | null | undefined) => (id != null ? !!ctx.loc.get(id)?.is_houseboat : false);
const baseOf = (ctx: EngineCtx, id: number) => ctx.loc.get(id)?.parent_id ?? id;
const childrenOf = (ctx: EngineCtx, id: number) =>
  ctx.m.locations.filter((l) => l.parent_id === id).map((l) => l.id);

/** The location itself, then its parent, then its children (for houseboat ↔ town fallbacks). */
function candidates(ctx: EngineCtx, id: number): number[] {
  const out = [id];
  const p = ctx.loc.get(id)?.parent_id;
  if (p != null) out.push(p);
  for (const c of childrenOf(ctx, id)) out.push(c);
  if (p != null) for (const c of childrenOf(ctx, p)) out.push(c);
  return Array.from(new Set(out));
}

/** Locations whose hotels are offered for a stay in `id`. */
export function hotelLocations(ctx: EngineCtx, id: number): number[] {
  const hb = isHB(ctx, id);
  return [id, ...ctx.m.locations.filter((l) => l.parent_id === id && l.is_houseboat === hb).map((l) => l.id)];
}

export function hotelsIn(ctx: EngineCtx, locationId: number): HotelIdx[] {
  const set = new Set(hotelLocations(ctx, locationId));
  return Array.from(ctx.hotels.values())
    .filter((h) => set.has(h.location_id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** All location ids whose rates the builder needs for these stays. */
export function rateLocationIds(m: TourMasters, stayLocationIds: number[]): number[] {
  const out = new Set<number>();
  for (const id of stayLocationIds) {
    out.add(id);
    const hb = !!m.locations.find((l) => l.id === id)?.is_houseboat;
    for (const l of m.locations) if (l.parent_id === id && l.is_houseboat === hb) out.add(l.id);
  }
  return Array.from(out);
}

// ---------------------------------------------------------------------
// Distances
// ---------------------------------------------------------------------

export function distanceKm(ctx: EngineCtx, a: number | null, b: number | null): { km: number; text: string } | null {
  if (a == null || b == null) return null;
  if (a === b || baseOf(ctx, a) === baseOf(ctx, b)) return { km: 0, text: '' };
  for (const x of candidates(ctx, a)) {
    for (const y of candidates(ctx, b)) {
      if (x === y) continue;
      const [lo, hi] = x < y ? [x, y] : [y, x];
      const d = ctx.m.distances.find((r) => r.from_location_id === lo && r.to_location_id === hi);
      if (d) {
        const km = num(d.distance_km);
        return { km, text: `~${inr(km)} km${d.duration_text ? ' | ' + d.duration_text : ''}` };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// Hotel pricing (Rate Master)
// ---------------------------------------------------------------------

const SEASON_GUESS = (iso: string) => {
  const d = asDate(iso);
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if ((m === 11 && day >= 20) || (m === 0 && day <= 5)) return 3; // Peak Surge Window
  if (m >= 5 && m <= 8) return 1; // Lean / Off-Peak
  return 2; // On-Peak
};

function covers(row: RateRow, n: number): boolean {
  let hit = false;
  for (const [f, t, excl] of row.windows || []) {
    const inside = n >= dayNo(f) && n <= dayNo(t);
    if (inside && excl) return false;
    if (inside) hit = true;
  }
  return hit;
}

export type RowPick = { row: RateRow; exact: boolean };

/** The rate row for a night: a period whose dates cover it (highest season wins), else a guessed season. */
export function rowFor(rows: RateRow[], iso: string): RowPick | null {
  if (!rows.length) return null;
  const n = dayNo(iso);
  const hit = rows.filter((r) => covers(r, n)).sort((a, b) => b.season_priority - a.season_priority);
  if (hit[0]) return { row: hit[0], exact: true };
  const g = SEASON_GUESS(iso);
  return { row: rows.find((r) => r.season_priority === g) || rows[0]!, exact: false };
}

const bedrooms = (room: string) => {
  const m = String(room).match(/(\d+)\s*(bed|br)/i);
  return m ? Number(m[1]) : 1;
};

export type NightCost = {
  date: string;
  row: RateRow | null;
  exact: boolean;
  base: number | null;
  units: number;
  extraAdults: number;
  extras: number;
  total: number | null;
  manual?: number;
  warn: string[];
};

type Party = Pick<QuoteInputs, 'adults' | 'rooms' | 'cwb' | 'cnb' | 'meal'>;

export function nightCost(rows: RateRow[], roomName: string, iso: string, houseboat: boolean, p: Party): NightCost {
  const f = rowFor(rows, iso);
  if (!f) return { date: iso, row: null, exact: false, base: null, units: 0, extraAdults: 0, extras: 0, total: null, warn: ['no rate rows'] };
  const r = f.row;
  const warn: string[] = [];
  let base: number | null;
  const cp = r.cp_cost != null ? num(r.cp_cost) : null;
  const map = r.map_cost != null ? num(r.map_cost) : null;
  if (houseboat) base = map ?? cp;
  else if (p.meal === 'MAP') {
    base = map;
    if (base == null && cp != null) {
      base = cp;
      warn.push('MAP not quoted – CP used');
    }
  } else {
    base = cp;
    if (base == null && map != null) {
      base = map;
      warn.push('CP not quoted – MAP used');
    }
  }
  if (base == null) return { date: iso, row: r, exact: f.exact, base: null, units: 0, extraAdults: 0, extras: 0, total: null, warn: ['no price for this room'] };
  const units = houseboat ? 1 : Math.max(1, p.rooms | 0);
  const cap = houseboat ? 2 * bedrooms(roomName) : 2 * units;
  const xa = Math.max(0, p.adults - cap);
  const xacp = r.extra_adult_cp != null ? num(r.extra_adult_cp) : null;
  const xamap = r.extra_adult_map != null ? num(r.extra_adult_map) : null;
  const xrate = houseboat || p.meal === 'MAP' ? xamap ?? xacp : xacp ?? xamap;
  if (xa && xrate == null) warn.push(`${xa} extra adult rate not quoted`);
  const cwb = p.cwb | 0;
  const cnb = p.cnb | 0;
  const cb = r.child_bed_cost != null ? num(r.child_bed_cost) : null;
  const cn = r.child_no_bed_cost != null ? num(r.child_no_bed_cost) : null;
  if (cwb && cb == null) warn.push('child-with-bed rate not quoted');
  if (cnb && cn == null && !houseboat) warn.push('child-no-bed rate not quoted');
  const extras = xa * (xrate || 0) + cwb * (cb || 0) + cnb * (cn || 0);
  return { date: iso, row: r, exact: f.exact, base, units, extraAdults: xa, extras, total: base * units + extras, warn };
}

const score = (c: NightCost) => (c.total ?? Infinity) + (c.exact ? 0 : 1e9);

export function cheapestRoom(H: HotelIdx, iso: string, houseboat: boolean, p: Party, categoryId: number | null) {
  const want = houseboat ? Math.max(1, Math.ceil(p.adults / 2)) : 0;
  const rooms = Array.from(H.rooms.values());
  const inCat = categoryId != null ? rooms.filter((r) => r.category_id === categoryId) : [];
  const pool = inCat.length ? inCat : rooms;
  let best: { room: (typeof rooms)[number]; c: NightCost } | null = null;
  const consider = (strict: boolean) => {
    for (const room of pool) {
      if (strict && want && bedrooms(room.name) < want) continue;
      const c = nightCost(room.rows, room.name, iso, houseboat, p);
      if (c.total != null && (!best || score(c) < score(best.c))) best = { room, c };
    }
  };
  consider(true);
  if (!best && want) consider(false);
  return best as { room: (typeof rooms)[number]; c: NightCost } | null;
}

export function defaultHotel(ctx: EngineCtx, locationId: number, categoryId: number | null, iso: string, p: Party) {
  if (categoryId == null) return null;
  const hb = isHB(ctx, locationId);
  let best: { H: HotelIdx; roomId: number; c: NightCost } | null = null;
  for (const H of hotelsIn(ctx, locationId)) {
    if (!H.cats.has(categoryId)) continue;
    const b = cheapestRoom(H, iso, hb, p, categoryId);
    if (b && (!best || score(b.c) < score(best.c))) best = { H, roomId: b.room.id, c: b.c };
  }
  return best;
}

export const stayDates = (inputs: QuoteInputs, si: number) => {
  let n = 0;
  for (let i = 0; i < si; i++) n += inputs.stays[i]!.nights;
  return Array.from({ length: inputs.stays[si]?.nights ?? 0 }, (_, k) => addDays(inputs.start_date, n + k));
};

export type StayChoice = {
  H: HotelIdx | null;
  roomId: number | null;
  roomName: string;
  auto: boolean;
  manual: boolean;
  none?: boolean;
};

export function stayChoice(ctx: EngineCtx, inputs: QuoteInputs, si: number, which: 1 | 2): StayChoice {
  const st = inputs.stays[si]!;
  const pick = which === 2 ? st.opt2 : st.opt1;
  const cat = which === 2 ? inputs.category2_id : inputs.category_id;
  if (pick.hotel_id === 'tbc') return { H: null, roomId: null, roomName: '', auto: false, manual: true };
  const dt = stayDates(inputs, si)[0] ?? inputs.start_date;
  if (pick.hotel_id != null && ctx.hotels.has(pick.hotel_id)) {
    const H = ctx.hotels.get(pick.hotel_id)!;
    let roomId = pick.room_type_id != null && H.rooms.has(pick.room_type_id) ? pick.room_type_id : null;
    if (roomId == null) {
      const b = cheapestRoom(H, dt, isHB(ctx, st.location_id), inputs, cat);
      roomId = b ? b.room.id : Array.from(H.rooms.keys())[0] ?? null;
    }
    return { H, roomId, roomName: roomId != null ? H.rooms.get(roomId)!.name : '', auto: false, manual: false };
  }
  const d = defaultHotel(ctx, st.location_id, cat, dt, inputs);
  if (d) return { H: d.H, roomId: d.roomId, roomName: d.H.rooms.get(d.roomId)!.name, auto: true, manual: false };
  return { H: null, roomId: null, roomName: '', auto: false, manual: true, none: true };
}

export type StayPrice = { choice: StayChoice; nights: NightCost[]; total: number; warn: string[] };

export function priceStay(ctx: EngineCtx, inputs: QuoteInputs, si: number, which: 1 | 2): StayPrice {
  const st = inputs.stays[si]!;
  const choice = stayChoice(ctx, inputs, si, which);
  const dates = stayDates(inputs, si);
  const label = locName(ctx, st.location_id);
  const hb = isHB(ctx, st.location_id);
  const out: StayPrice = { choice, nights: [], total: 0, warn: [] };
  const catId = which === 2 ? inputs.category2_id : inputs.category_id;
  if (!choice.H) {
    const pick = which === 2 ? st.opt2 : st.opt1;
    const m = num(pick.manual_rate);
    const units = hb ? 1 : Math.max(1, inputs.rooms | 0);
    for (const dt of dates) {
      out.nights.push({ date: dt, row: null, exact: true, base: m, units, extraAdults: 0, extras: 0, total: m * units, manual: m, warn: [] });
      out.total += m * units;
    }
    if (!m) {
      const catName = ctx.m.categories.find((c) => c.id === catId)?.name;
      out.warn.push(
        `${label}: no hotel in the Rate Master${choice.none && catName ? ' for ' + catName : ''} – pick a hotel or enter a manual rate.`
      );
    }
    return out;
  }
  const room = choice.roomId != null ? choice.H.rooms.get(choice.roomId) : undefined;
  for (const dt of dates) {
    const c = room ? nightCost(room.rows, room.name, dt, hb, inputs) : null;
    if (!c || c.total == null) {
      out.nights.push(c ?? { date: dt, row: null, exact: false, base: null, units: 0, extraAdults: 0, extras: 0, total: null, warn: [] });
      out.warn.push(`${label} ${fmtDay(dt)}: ${choice.H.name} – ${choice.roomName} has no price.`);
      continue;
    }
    out.nights.push(c);
    out.total += c.total;
    if (!c.exact && c.row)
      out.warn.push(`${label} ${fmtDay(dt)}: no rate row covers this date – used ${c.row.season} (${c.row.date_range_label}). Please confirm.`);
    for (const w of c.warn) out.warn.push(`${label} ${fmtDay(dt)}: ${w}.`);
  }
  return out;
}

// ---------------------------------------------------------------------
// Vehicle
// ---------------------------------------------------------------------

export type VehicleCalc = {
  vehicleLabel: string;
  days: number;
  kmEstimated: number;
  km: number;
  freeKm: number;
  extraKm: number;
  base: number;
  extraKmCost: number;
  bata: number;
  extra: number;
  total: number;
  legs: { from: string; to: string; km: number | null }[];
  warn: string[];
};

export function estimateKm(ctx: EngineCtx, inputs: QuoteInputs) {
  const legs: VehicleCalc['legs'] = [];
  const warn: string[] = [];
  const pick = ctx.m.points.find((p) => p.id === inputs.pickup_point_id) || null;
  const drop = ctx.m.points.find((p) => p.id === inputs.drop_point_id) || null;
  let km = 0;
  if (pick) km += num(pick.km_from_location);
  if (drop) km += num(drop.km_from_location);
  const chain: (number | null)[] = [pick?.location_id ?? null, ...inputs.stays.map((s) => s.location_id), drop?.location_id ?? null];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    if (a == null || b == null) continue;
    const d = distanceKm(ctx, a, b);
    if (d && d.km === 0) continue;
    legs.push({ from: locName(ctx, a), to: locName(ctx, b), km: d ? d.km : null });
    if (d) km += d.km;
    else warn.push(`Distance ${locName(ctx, a)} → ${locName(ctx, b)} is missing – add it under Locations & Activities › Distances, or enter the total km.`);
  }
  km += num(ctx.m.settings.sightseeing_km_per_day) * totalNights(inputs);
  return { km: Math.round(km), legs, warn };
}

export function vehicleCost(ctx: EngineCtx, inputs: QuoteInputs): VehicleCalc {
  const V = ctx.m.vehicles.find((v) => v.id === inputs.vehicle_id) || null;
  const est = estimateKm(ctx, inputs);
  const days = inputs.vehicle_days != null && inputs.vehicle_days > 0 ? inputs.vehicle_days : totalNights(inputs) + 1;
  const km = inputs.vehicle_km != null && inputs.vehicle_km > 0 ? inputs.vehicle_km : est.km;
  const extra = num(inputs.vehicle_extra);
  if (!V) {
    return {
      vehicleLabel: '', days, kmEstimated: est.km, km, freeKm: 0, extraKm: 0, base: 0, extraKmCost: 0, bata: 0, extra,
      total: extra, legs: est.legs, warn: ['Vehicle not selected – choose one under Transport.'],
    };
  }
  const perDay = V.rate_basis === 'per_day';
  const base = perDay ? num(V.amount) * days : num(V.amount);
  const freeKm = perDay ? num(V.free_km) * days : num(V.free_km);
  const extraKm = Math.max(0, km - freeKm);
  const extraKmCost = extraKm * num(V.extra_per_km);
  const bata = num(V.driver_bata_per_day) * days;
  const warn = inputs.vehicle_km != null && inputs.vehicle_km > 0 ? [] : est.warn;
  return {
    vehicleLabel: `${V.vehicle_type}${V.is_ac ? '' : ' (Non A/C)'}`,
    days, kmEstimated: est.km, km, freeKm, extraKm, base, extraKmCost, bata, extra,
    total: base + extraKmCost + bata + extra, legs: est.legs, warn,
  };
}

// ---------------------------------------------------------------------
// Quote totals
// ---------------------------------------------------------------------

export type QuoteCalc = {
  which: 1 | 2;
  stays: StayPrice[];
  hotels: number;
  vehicle: VehicleCalc;
  other: number;
  net: number;
  markupPct: number;
  markup: number;
  gstPct: number;
  gst: number;
  total: number;
  perPerson: number;
  warn: string[];
};

export function markupPct(ctx: EngineCtx, inputs: QuoteInputs) {
  if (!ctx.role.canOverrideMarkup || inputs.markup_pct == null) return num(ctx.m.settings.markup_pct);
  return num(inputs.markup_pct);
}

export function quote(ctx: EngineCtx, inputs: QuoteInputs, which: 1 | 2): QuoteCalc {
  const stays = inputs.stays.map((_, i) => priceStay(ctx, inputs, i, which));
  const hotels = stays.reduce((a, s) => a + s.total, 0);
  const vehicle = vehicleCost(ctx, inputs);
  const other = (inputs.others || []).reduce((a, o) => a + num(o.amount), 0);
  const net = hotels + vehicle.total + other;
  const mp = markupPct(ctx, inputs);
  const markup = (net * mp) / 100;
  const gstPct = inputs.gst_enabled === false ? 0 : num(ctx.m.settings.gst_pct);
  const gst = ((net + markup) * gstPct) / 100;
  const rnd = num(ctx.m.settings.round_to) || 1;
  const total = Math.round((net + markup + gst) / rnd) * rnd;
  const warn = [...vehicle.warn, ...stays.flatMap((s) => s.warn)];
  if (!vehicle.total) warn.unshift('Vehicle cost is zero – select a vehicle or check its amount.');
  return {
    which, stays, hotels, vehicle, other, net, markupPct: mp, markup, gstPct, gst, total,
    perPerson: total / Math.max(1, inputs.adults), warn,
  };
}

export function deriveMarkupPctFromTotal(net: number, targetTotal: number, gstPct: number): number {
  if (!(net > 0) || !(targetTotal > 0)) return 0;
  const targetTaxable = gstPct > 0 ? targetTotal / (1 + gstPct / 100) : targetTotal;
  const targetMarkupAmount = targetTaxable - net;
  const pct = (targetMarkupAmount / net) * 100;
  return Math.round(pct * 100) / 100;
}

// ---------------------------------------------------------------------
// Day-wise itinerary
// ---------------------------------------------------------------------

export type DayLine = { kind: 'text'; text: string } | { kind: 'sight'; name: string; desc: string; ix?: number; off?: boolean; added?: boolean };

export type DayKind = 'arrival' | 'transfer' | 'stay' | 'departure';

export type DayOut = {
  i: number;
  date: string;
  kind: DayKind;
  key: string;
  ak: string;
  from: number | null;
  to: number | null;
  city: number | null;
  stayIdx: number | null;
  stayN: number;
  prevHB: boolean;
  variants: DayPlan[];
  plan: DayPlan;
  generic: boolean;
  title: string;
  lines: DayLine[];
  tip: string;
  note: string;
  custom: string;
  stale: boolean;
  meals: string;
};

const GENERIC_ID = -1;

function findPlans(ctx: EngineCtx, type: DayKind, from: number | null, to: number): DayPlan[] {
  const plans = ctx.m.plans.filter((p) => p.is_active && p.plan_type === type);
  const byOrder = (a: DayPlan, b: DayPlan) => a.sort_order - b.sort_order || a.id - b.id;
  if (type === 'arrival' || type === 'stay') {
    for (const y of candidates(ctx, to)) {
      const r = plans.filter((p) => p.to_location_id === y);
      if (r.length) return r.sort(byOrder);
    }
    return [];
  }
  if (from == null) return [];
  for (const x of candidates(ctx, from)) {
    for (const y of candidates(ctx, to)) {
      const r = plans.filter((p) => p.from_location_id === x && p.to_location_id === y);
      if (r.length) return r.sort(byOrder);
    }
  }
  return [];
}

function topSights(ctx: EngineCtx, locationId: number | null, n: number): PlanItem[] {
  if (locationId == null) return [];
  const ids = candidates(ctx, locationId);
  return ctx.m.activities
    .filter((a) => a.is_active && !a.is_optional_paid && ids.includes(a.location_id))
    .sort((a, b) => ids.indexOf(a.location_id) - ids.indexOf(b.location_id) || a.sort_order - b.sort_order)
    .slice(0, n)
    .map((a) => ({ kind: 'sight', name: a.name }));
}

function genericPlan(ctx: EngineCtx, kind: DayKind, a: number | null, b: number): DayPlan {
  const A = locName(ctx, a);
  const B = locName(ctx, b);
  const d = distanceKm(ctx, a, b);
  const dt = d && d.text ? ` (${d.text})` : '';
  const base = { id: GENERIC_ID, plan_type: kind as DayPlan['plan_type'], from_location_id: a, to_location_id: b, first_day_title: null, tip: null, no_opener: false, source: null, sort_order: 0, is_active: true };
  if (kind === 'stay')
    return { ...base, label: 'Day at leisure', title: `${B} – Day at Leisure`, items: [{ kind: 'text', text: 'Day at leisure – relax at the resort or explore at your own pace.' }, ...topSights(ctx, b, 2)] };
  if (kind === 'departure')
    return { ...base, label: 'Transfer', title: a === b ? `${A} Departure` : `${A} → ${B} Departure`, items: [{ kind: 'text', text: a === b ? 'Check out and transfer to the drop point.' : `Drive to ${B}${dt}.` }] };
  return { ...base, label: 'Transfer + highlights', title: `${A} → ${B}`, items: [{ kind: 'text', text: `Drive to ${B}${dt}.` }, ...topSights(ctx, b, 3), { kind: 'text', text: `Check in at your ${B} hotel.` }] };
}

export function sightDesc(ctx: EngineCtx, name: string, preferLoc: number | null): string {
  const ids = preferLoc != null ? candidates(ctx, preferLoc) : [];
  const all = ctx.m.activities.filter((a) => a.name === name);
  const best = all.find((a) => ids.includes(a.location_id)) || all[0];
  return best?.description || '';
}

function editFor(inputs: QuoteInputs, ak: string, key: string): DayEdit & { stale?: boolean } {
  const raw = inputs.days?.[ak];
  if (!raw) return { k: key };
  if (raw.k === key) return raw;
  return {
    k: key, note: raw.note, custom: raw.custom,
    stale: !!(raw.title || raw.custom || (raw.off && raw.off.length) || (raw.add && raw.add.length) || raw.plan_id),
  };
}

export function computeDays(ctx: EngineCtx, inputs: QuoteInputs): DayOut[] {
  const pick = ctx.m.points.find((p) => p.id === inputs.pickup_point_id) || null;
  const drop = ctx.m.points.find((p) => p.id === inputs.drop_point_id) || null;
  const pickHub = pick?.location_id ?? inputs.stays[0]?.location_id ?? null;
  const dropHub = drop?.location_id ?? inputs.stays[inputs.stays.length - 1]?.location_id ?? pickHub;
  const company = ctx.m.settings.company_name || 'Travinco';
  const raw: Omit<DayOut, 'variants' | 'plan' | 'generic' | 'title' | 'lines' | 'tip' | 'note' | 'custom' | 'stale' | 'meals'>[] = [];
  const variantsFor: DayPlan[][] = [];
  const push = (o: (typeof raw)[number], v: DayPlan[]) => {
    raw.push(o);
    variantsFor.push(v);
  };
  let prev: number | null = pickHub;
  let prevStay: number | null = null;
  inputs.stays.forEach((st, si) => {
    for (let n = 0; n < st.nights; n++) {
      const i = raw.length;
      const date = addDays(inputs.start_date, i);
      const common = { i, date, city: st.location_id, stayIdx: si, stayN: n, prevHB: isHB(ctx, prevStay) && n === 0 && prevStay !== st.location_id, ak: `${st.uid}:${n}` };
      if (n === 0 && !(si > 0 && prev === st.location_id)) {
        let kind: DayKind;
        let key: string;
        let v: DayPlan[];
        if (si === 0 && prev != null && (prev === st.location_id)) {
          kind = 'arrival';
          key = `arrival:>${st.location_id}:p${inputs.pickup_point_id ?? ''}`;
          v = findPlans(ctx, 'arrival', null, st.location_id);
        } else {
          kind = si === 0 ? 'arrival' : 'transfer';
          key = `${kind}:${prev ?? ''}>${st.location_id}${si === 0 ? `:p${inputs.pickup_point_id ?? ''}` : ''}`;
          v = findPlans(ctx, 'transfer', prev, st.location_id);
          if (!v.length && si === 0) v = findPlans(ctx, 'arrival', null, st.location_id);
        }
        if (!v.length) v = [genericPlan(ctx, 'transfer', prev, st.location_id)];
        push({ ...common, kind, key, from: prev, to: st.location_id }, v);
      } else {
        const v = findPlans(ctx, 'stay', null, st.location_id);
        push({ ...common, kind: 'stay', key: `stay:>${st.location_id}`, from: st.location_id, to: st.location_id }, v.length ? v : [genericPlan(ctx, 'stay', st.location_id, st.location_id)]);
      }
      prev = st.location_id;
      prevStay = st.location_id;
    }
  });
  const last = inputs.stays.length ? inputs.stays[inputs.stays.length - 1]!.location_id : pickHub;
  if (dropHub != null) {
    let v = last != null ? findPlans(ctx, 'departure', last, dropHub) : [];
    if (!v.length) v = [genericPlan(ctx, 'departure', last, dropHub)];
    const i = raw.length;
    push({ i, date: addDays(inputs.start_date, i), kind: 'departure', key: `departure:${last ?? ''}>${dropHub}:d${inputs.drop_point_id ?? ''}`, ak: 'dep', from: last, to: dropHub, city: null, stayIdx: null, stayN: 0, prevHB: isHB(ctx, last) }, v);
  }

  const picks = new Set(inputs.plan_picks || []);
  const computed = raw.map((d, idx) => {
    const variants = variantsFor[idx]!;
    const ed = editFor(inputs, d.ak, d.key);
    let v = 0;
    if (d.kind === 'stay') v = variants.length ? (d.stayN - 1 + variants.length) % variants.length : 0;
    else {
      const pi = variants.findIndex((p) => picks.has(p.id));
      if (pi >= 0) v = pi;
    }
    if (ed.plan_id != null) {
      const ix = variants.findIndex((p) => p.id === ed.plan_id);
      if (ix >= 0) v = ix;
    }
    const plan = variants[v] ?? variants[0]!;
    const off = new Set(ed.off || []);
    const fromName = locName(ctx, d.from);
    const toName = locName(ctx, d.to);

    let title = ed.title;
    if (!title) {
      if (d.kind === 'arrival') {
        if (pick?.name && d.from !== d.to && d.to != null) {
          title = `Arrival at ${pick.name} – Transfer to ${toName}`;
        } else if (pick?.name) {
          title = `Arrival at ${pick.name}`;
        } else if (plan.first_day_title) {
          title = plan.first_day_title;
        } else if (d.from != null && d.from !== d.to && plan.plan_type !== 'arrival') {
          title = `Arrival in ${fromName} – Transfer to ${toName}`;
        } else {
          title = plan.title;
        }
      } else if (d.kind === 'departure') {
        if (drop?.name && d.from != null && d.from !== d.to) {
          title = `Transfer from ${fromName} to ${drop.name} – Departure`;
        } else if (drop?.name) {
          title = `Transfer to ${drop.name} – Departure`;
        } else {
          title = plan.title;
        }
      } else {
        title = plan.title;
      }
    }

    const lines: DayLine[] = [];
    if (!plan.no_opener) {
      if (d.kind === 'arrival') {
        lines.push({
          kind: 'text',
          text: `Arrive at ${pick?.name || fromName || 'destination'}. Meet & greet by your ${company} representative${
            d.from !== d.to && d.to != null ? ` and transfer to ${toName}` : ''
          }.`,
        });
      } else if (d.prevHB) {
        lines.push({ kind: 'text', text: 'Breakfast on board; check out of the houseboat by 9:00 AM.' });
      } else if (d.kind === 'stay') {
        lines.push({ kind: 'text', text: 'Breakfast at the hotel.' });
      } else {
        lines.push({ kind: 'text', text: 'Breakfast at the hotel and check out.' });
      }
    }
    plan.items.forEach((it, ix) => {
      if (it.kind === 'sight') lines.push({ kind: 'sight', name: it.name, desc: it.desc ?? sightDesc(ctx, it.name, d.to), ix, off: off.has(ix) });
      else lines.push({ kind: 'text', text: it.text });
    });
    for (const name of ed.add || []) lines.push({ kind: 'sight', name, desc: sightDesc(ctx, name, d.to), added: true });
    if (d.kind === 'departure') {
      lines.push({
        kind: 'text',
        text: `Check out from hotel and transfer to ${drop?.name || toName || 'departure point'} for your onward journey / departure.`,
      });
    }

    const hb = isHB(ctx, d.city);
    const meals =
      d.kind === 'departure' ? 'Breakfast'
      : d.i === 0 ? (hb ? 'Lunch + Dinner' : inputs.meal === 'MAP' ? 'Dinner' : 'NIL')
      : hb ? 'Breakfast + Lunch + Dinner'
      : inputs.meal === 'MAP' ? 'Breakfast + Dinner' : 'Breakfast';

    return {
      ...d, variants, plan, generic: plan.id === GENERIC_ID, title, lines, tip: plan.tip || '',
      note: (ed.note || '').trim(), custom: (ed.custom || '').trim(), stale: !!ed.stale, meals,
    };
  });

  const dayOrder: string[] = inputs.day_order ?? [];
  if (dayOrder.length > 0) {
    const map = new Map(computed.map((d) => [d.ak, d]));
    const ordered: DayOut[] = [];
    for (const ak of dayOrder) {
      const item = map.get(ak);
      if (item) {
        ordered.push(item);
        map.delete(ak);
      }
    }
    for (const item of map.values()) {
      ordered.push(item);
    }
    return ordered.map((d, index) => ({
      ...d,
      i: index,
      date: addDays(inputs.start_date, index),
    }));
  }

  return computed;
}

export const dayOutputLines = (d: DayOut): string[] =>
  d.custom
    ? d.custom.split('\n').map((s) => s.trim()).filter(Boolean)
    : d.lines
        .filter((l) => !(l.kind === 'sight' && l.off))
        .map((l) => (l.kind === 'sight' ? l.name + (l.desc ? ' – ' + l.desc : '') : l.text));

// ---------------------------------------------------------------------
// Document snapshot
// ---------------------------------------------------------------------

export function durationLabel(nights: number) {
  return `${nights + 1} Days / ${nights} Night${nights === 1 ? '' : 's'}`;
}

export function buildSnapshot(ctx: EngineCtx, inputs: QuoteInputs, q1: QuoteCalc, q2: QuoteCalc | null): QuoteSnapshot {
  const S = ctx.m.settings;
  const days = computeDays(ctx, inputs);
  const nights = totalNights(inputs);
  const pick = ctx.m.points.find((p) => p.id === inputs.pickup_point_id);
  const drop = ctx.m.points.find((p) => p.id === inputs.drop_point_id);
  const cat1 = ctx.m.categories.find((c) => c.id === inputs.category_id)?.name ?? 'Similar category';
  const cat2 = q2 ? ctx.m.categories.find((c) => c.id === inputs.category2_id)?.name ?? 'Option 2' : '';
  const tn = inputs.stays.some((s) => /tamil/i.test(ctx.loc.get(s.location_id)?.state || ''));
  const honey = /honeymoon/i.test(inputs.trip_type);
  const docTitle =
    inputs.title.trim() ||
    `${tn ? 'KERALA & TAMIL NADU' : 'KERALA'} ${honey ? 'HONEYMOON' : 'TOUR'} PACKAGE`;
  const route: string[] = [];
  for (const s of inputs.stays) {
    const l = ctx.loc.get(s.location_id);
    const n = l?.is_houseboat && l.parent_id != null ? locName(ctx, l.parent_id) : locName(ctx, s.location_id);
    if (route[route.length - 1] !== n) route.push(n);
  }
  const kids = (inputs.cwb | 0) + (inputs.cnb | 0);
  const guestsLine =
    `${inputs.adults} Adult${inputs.adults > 1 ? 's' : ''}` +
    (kids ? ` + ${kids} Child${kids > 1 ? 'ren' : ''}${inputs.child_ages ? ` (ages ${inputs.child_ages})` : ''}` : '') +
    `  |  ${inputs.rooms} Room${inputs.rooms > 1 ? 's' : ''}`;
  const hasHB = inputs.stays.some((s) => isHB(ctx, s.location_id));
  const vehicle = q1.vehicle.vehicleLabel || 'as per itinerary';

  const hotelRows = (q: QuoteCalc): SnapshotRow[] => {
    const rows: SnapshotRow[] = [];
    q.stays.forEach((sp, si) => {
      const st = inputs.stays[si]!;
      const hb = isHB(ctx, st.location_id);
      stayDates(inputs, si).forEach((dt) => {
        rows.push([
          sp.choice.H ? sp.choice.H.name : 'Similar category (TBC)',
          sp.choice.H ? sp.choice.roomName : '—',
          locName(ctx, sp.choice.H ? sp.choice.H.location_id : st.location_id),
          fmtNumDate(dt),
          hb ? 'L + D + B' : inputs.meal === 'MAP' ? 'B + D' : 'B',
        ]);
      });
    });
    return rows;
  };

  const counts: [string, number][] = [];
  for (const s of inputs.stays) {
    const n = isHB(ctx, s.location_id) ? 'Private Houseboat' : locName(ctx, s.location_id);
    const c = counts.find((x) => x[0] === n);
    if (c) c[1] += s.nights;
    else counts.push([n, s.nights]);
  }
  const inclusions = [
    `Accommodation: ${nights} nights – ${counts.map((c) => `${c[1]}N ${c[0]}`).join(', ')} (${cat1}${q2 ? ' / ' + cat2 : ''}), ${inputs.rooms} room${inputs.rooms > 1 ? 's' : ''}.`,
    `Meals: daily breakfast at hotels${inputs.meal === 'MAP' ? ' and dinner' : ''}${hasHB ? '; houseboat – lunch, dinner and next-morning breakfast' : ''}.`,
    `Private A/C vehicle (${vehicle}) for all transfers and sightseeing as per the itinerary${pick ? `, from ${pick.name} pick-up` : ''}${drop ? ` to ${drop.name} drop` : ''}.`,
    `All toll taxes, parking fees and driver bata${tn ? ', including Tamil Nadu interstate permit' : ''}.`,
    '1 litre water bottle per person every day.',
    'Meet & greet assistance at arrival and departure points.',
    '24-hour on-call assistance during your stay.',
    ...(inputs.gst_enabled !== false ? [`${num(S.gst_pct)}% GST included in the package.`] : []),
    ...inputs.extra_inclusions.split('\n').map((s) => s.trim()).filter(Boolean),
  ];

  const stayLocIds = new Set(inputs.stays.flatMap((s) => candidates(ctx, s.location_id)));
  const optional = ctx.m.activities
    .filter((a) => a.is_active && a.is_optional_paid && stayLocIds.has(a.location_id))
    .map((a) => [a.name, locName(ctx, a.location_id), a.approx_cost_text || 'On request'] as [string, string, string]);

  const options = [q1, q2].filter(Boolean).map((q, ix) => ({
    label: q2 ? `Package total – Option ${ix + 1} (${ix === 0 ? cat1 : cat2})` : 'Package total',
    category: ix === 0 ? cat1 : cat2,
    total: q!.total,
    per_person: Math.round(q!.perPerson),
    hotels: hotelRows(q!),
  }));

  return {
    doc_title: docTitle.toUpperCase(),
    duration: durationLabel(nights),
    route,
    guest: inputs.guest_name,
    dates: days.length ? `${fmtLong(days[0]!.date)} – ${fmtLong(days[days.length - 1]!.date)}` : '',
    guests_line: guestsLine,
    pickup: pick?.name ?? '',
    drop: drop?.name ?? '',
    vehicle: `Private A/C vehicle (${vehicle})`,
    meal_plan:
      (inputs.meal === 'MAP' ? 'Breakfast + Dinner daily' : 'Daily breakfast') + (hasHB ? '  |  Houseboat: Lunch + Dinner + Breakfast' : ''),
    options,
    days: days.map((d) => {
      const ch = d.stayIdx != null ? q1.stays[d.stayIdx]?.choice : null;
      return {
        n: d.i + 1,
        date: d.date,
        title: d.title,
        lines: dayOutputLines(d),
        tip: d.custom ? '' : d.tip,
        note: d.note,
        meals: d.meals,
        stay: d.kind === 'departure' ? 'Check-out' : ch?.H ? ch.H.name : d.city != null ? `${locName(ctx, d.city)} hotel` : '',
        location: d.city != null ? locName(ctx, d.city) : drop?.name ?? '',
      };
    }),
    inclusions,
    exclusions: S.exclusions || [],
    optional,
    cancellation: S.cancellation || [],
    notes: S.important_notes || [],
    company: {
      name: S.company_name || 'Travinco',
      phone: S.company_phone || '',
      email: S.company_email || '',
      website: S.company_website || '',
      address: S.company_address || '',
    },
    warnings: Array.from(new Set([...q1.warn, ...(q2 ? q2.warn : [])])),
    generated_at: new Date().toISOString(),
  };
}

type SnapshotRow = [string, string, string, string, string];

export function whatsappText(s: QuoteSnapshot): string {
  const L: string[] = [];
  L.push(`*🌴 ${s.doc_title}*`);
  L.push(`*${s.duration}*  |  ${s.route.join(' • ')}`);
  L.push('');
  if (s.guest) L.push(`👤 ${s.guest}`);
  L.push(`📅 ${s.dates}  |  ${s.guests_line}`);
  L.push(`🚗 ${s.vehicle}`);
  if (s.pickup) L.push(`📍 Pick-up: ${s.pickup}`);
  if (s.drop) L.push(`📍 Drop: ${s.drop}`);
  s.options.forEach((o, i) =>
    L.push(`💰 ${s.options.length > 1 ? `Option ${i + 1} (${o.category}): ` : ''}INR ${inr(o.total)}  /  Per person: INR ${inr(o.per_person)}`)
  );
  L.push('');
  s.options.forEach((o, i) => {
    L.push(`*🏨 Hotels${s.options.length > 1 ? ` – Option ${i + 1}` : ''} (${o.category})*`);
    const seen = new Set<string>();
    o.hotels.forEach((h) => {
      const k = h[0] + h[1] + h[2];
      if (seen.has(k)) return;
      seen.add(k);
      const n = o.hotels.filter((x) => x[0] + x[1] + x[2] === k).length;
      L.push(`• ${h[2]} (${n}N): ${h[0]}${h[1] && h[1] !== '—' ? ' – ' + h[1] : ''}`);
    });
    L.push('');
  });
  s.days.forEach((d) => {
    L.push(`*Day ${d.n} – ${fmtDay(d.date)}: ${d.title}*`);
    d.lines.forEach((x) => L.push(`• ${x}`));
    if (d.note) L.push(`_${d.note}_`);
    L.push('');
  });
  L.push('*✅ Inclusions*');
  s.inclusions.forEach((x) => L.push(`• ${x}`));
  L.push('');
  L.push([s.company.phone && `📞 ${s.company.phone}`, s.company.email && `✉ ${s.company.email}`, s.company.website].filter(Boolean).join('  |  '));
  return L.join('\n');
}

// ---------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------

export function blankInputs(m: TourMasters): QuoteInputs {
  const start = addDays(new Date().toISOString().slice(0, 10), 30);
  return {
    customer_id: null, enquiry_id: null, guest_name: '', guest_phone: '', guest_email: '', title: '', trip_type: 'Tour',
    start_date: start, adults: 2, cwb: 0, cnb: 0, child_ages: '', rooms: 1, meal: 'CP',
    category_id: m.categories[1]?.id ?? m.categories[0]?.id ?? null, category2_id: null,
    pickup_point_id: m.points.find((p) => p.use_for_pickup)?.id ?? null,
    drop_point_id: m.points.find((p) => p.use_for_drop)?.id ?? null,
    vehicle_id: null, vehicle_days: null, vehicle_km: null, vehicle_extra: 0, others: [], markup_pct: null,
    gst_enabled: true,
    extra_inclusions: '', stays: [], days: {}, day_order: undefined, plan_picks: [], template_id: null, valid_until: null, notes: '',
  };
}

export function inputsFromTemplate(m: TourMasters, t: QuoteInputs | null, tpl: TourMasters['templates'][number]): QuoteInputs {
  const base = t ?? blankInputs(m);
  const vehicle = tpl.vehicle_type ? m.vehicles.find((v) => v.is_active && v.vehicle_type === tpl.vehicle_type) : undefined;
  return {
    ...base,
    template_id: tpl.id,
    trip_type: tpl.trip_type || 'Tour',
    adults: tpl.adults || 2,
    rooms: Math.max(1, Math.ceil((tpl.adults || 2) / 2)),
    pickup_point_id: tpl.pickup_point_id ?? base.pickup_point_id,
    drop_point_id: tpl.drop_point_id ?? base.drop_point_id,
    category_id: tpl.category_id ?? base.category_id,
    category2_id: null,
    vehicle_id: vehicle?.id ?? base.vehicle_id,
    extra_inclusions: tpl.extra_inclusions || '',
    stays: tpl.stays.filter((s) => m.locations.some((l) => l.id === s.location_id)).map((s) => newStay(s.location_id, s.nights)),
    plan_picks: tpl.plan_picks || [],
    days: {},
    day_order: undefined,
  };
}

/** Defensive normalisation for inputs coming from the client or old rows. */
export function normalizeInputs(raw: Partial<QuoteInputs>, m: TourMasters): QuoteInputs {
  const b = blankInputs(m);
  const i = { ...b, ...raw } as QuoteInputs;
  const int = (v: unknown, min: number, d: number) => {
    const n = Math.floor(num(v));
    return Number.isFinite(n) && n >= min ? n : d;
  };
  const idOrNull = (v: unknown) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  i.adults = int(i.adults, 1, 2);
  i.rooms = int(i.rooms, 1, 1);
  i.cwb = int(i.cwb, 0, 0);
  i.cnb = int(i.cnb, 0, 0);
  i.meal = i.meal === 'MAP' ? 'MAP' : 'CP';
  i.start_date = /^\d{4}-\d{2}-\d{2}$/.test(String(i.start_date)) ? i.start_date : b.start_date;
  i.category_id = idOrNull(i.category_id);
  i.category2_id = idOrNull(i.category2_id);
  i.pickup_point_id = idOrNull(i.pickup_point_id);
  i.drop_point_id = idOrNull(i.drop_point_id);
  i.vehicle_id = idOrNull(i.vehicle_id);
  i.vehicle_days = i.vehicle_days == null || (i.vehicle_days as unknown) === '' ? null : int(i.vehicle_days, 1, 1);
  i.vehicle_km = i.vehicle_km == null || (i.vehicle_km as unknown) === '' ? null : Math.max(0, num(i.vehicle_km));
  i.vehicle_extra = Math.max(0, num(i.vehicle_extra));
  i.markup_pct = i.markup_pct == null || (i.markup_pct as unknown) === '' ? null : Math.min(100, Math.max(0, num(i.markup_pct)));
  i.gst_enabled = raw.gst_enabled !== false;
  i.others = (Array.isArray(i.others) ? i.others : []).map((o) => ({ label: String(o?.label ?? '').slice(0, 120), amount: num(o?.amount) })).filter((o) => o.label || o.amount);
  const pickNorm = (p: Partial<HotelPick> | undefined): HotelPick => ({
    hotel_id: p?.hotel_id === 'tbc' ? 'tbc' : idOrNull(p?.hotel_id),
    room_type_id: idOrNull(p?.room_type_id),
    manual_rate: p?.manual_rate == null || (p.manual_rate as unknown) === '' ? null : Math.max(0, num(p.manual_rate)),
  });
  i.stays = (Array.isArray(i.stays) ? i.stays : [])
    .filter((s) => s && m.locations.some((l) => l.id === Number(s.location_id)))
    .map((s) => ({
      uid: String(s.uid || uid()),
      location_id: Number(s.location_id),
      nights: int(s.nights, 1, 1),
      opt1: pickNorm(s.opt1),
      opt2: pickNorm(s.opt2),
    }));
  i.days = i.days && typeof i.days === 'object' ? i.days : {};
  i.day_order = Array.isArray(i.day_order) ? i.day_order.map(String).filter(Boolean) : undefined;
  i.plan_picks = Array.isArray(i.plan_picks) ? i.plan_picks.map(Number).filter(Number.isFinite) : [];
  for (const k of ['guest_name', 'guest_phone', 'guest_email', 'title', 'trip_type', 'child_ages', 'extra_inclusions', 'notes'] as const) {
    i[k] = String(i[k] ?? '');
  }
  i.trip_type = i.trip_type || 'Tour';
  return i;
}
