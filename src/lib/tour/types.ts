// Shapes shared by the Tour Operations modules (Quotations, Invoices,
// Hotels, Transportation, Pickup & Drop, Locations & Activities).
// Row types mirror supabase/migrations/029_tour_operations.sql.

export type TourLocation = {
  id: number;
  name: string;
  display_name: string | null;
  state: string | null;
  description: string | null;
  parent_id: number | null;
  is_houseboat: boolean;
  is_active: boolean;
  sort_order: number;
};

export type HotelCategory = { id: number; name: string; sort_order: number };

export type PickupPoint = {
  id: number;
  code: string | null;
  name: string;
  point_type: 'airport' | 'railway' | 'bus' | 'hotel' | 'port' | 'other';
  location_id: number | null;
  km_from_location: number;
  address: string | null;
  google_maps_url: string | null;
  contact_phone: string | null;
  use_for_pickup: boolean;
  use_for_drop: boolean;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
};

export type TransportVehicle = {
  id: number;
  vehicle_type: string;
  company_name: string;
  contact_person: string | null;
  contact_number: string;
  alt_contact_number: string | null;
  seats: number | null;
  is_ac: boolean;
  rate_basis: 'per_day' | 'per_trip';
  amount: number;
  free_km: number;
  extra_per_km: number;
  driver_bata_per_day: number;
  notes: string | null;
  is_active: boolean;
};

export type LocationActivity = {
  id: number;
  location_id: number;
  name: string;
  kind: 'sightseeing' | 'activity' | 'experience' | 'temple' | 'shopping';
  description: string | null;
  duration: string | null;
  timings: string | null;
  closed_on: string | null;
  entry_fee_adult: number | null;
  entry_fee_child: number | null;
  is_optional_paid: boolean;
  approx_cost_text: string | null;
  sort_order: number;
  is_active: boolean;
};

export type LocationDistance = {
  id: number;
  from_location_id: number;
  to_location_id: number;
  distance_km: number;
  duration_text: string | null;
  notes: string | null;
};

export type PlanItem = { kind: 'text'; text: string } | { kind: 'sight'; name: string; desc?: string };

export type DayPlanType = 'arrival' | 'transfer' | 'stay' | 'departure';

export type DayPlan = {
  id: number;
  plan_type: DayPlanType;
  from_location_id: number | null;
  to_location_id: number;
  label: string;
  title: string;
  first_day_title: string | null;
  items: PlanItem[];
  tip: string | null;
  no_opener: boolean;
  source: string | null;
  sort_order: number;
  is_active: boolean;
};

export type QuotationTemplate = {
  id: number;
  name: string;
  trip_type: string;
  pickup_point_id: number | null;
  drop_point_id: number | null;
  category_id: number | null;
  vehicle_type: string | null;
  adults: number;
  stays: { location_id: number; nights: number }[];
  plan_picks: number[];
  extra_inclusions: string | null;
  sort_order: number;
  is_active: boolean;
};

export type TourSettings = {
  markup_pct: number;
  gst_pct: number;
  round_to: number;
  quote_valid_days: number;
  sightseeing_km_per_day: number;
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website: string | null;
  company_gstin: string | null;
  company_state: string | null;
  sac_code: string | null;
  bank_details: string | null;
  invoice_due_days: number;
  invoice_terms: string | null;
  exclusions: string[];
  cancellation: [string, string][];
  important_notes: string[];
};

/** One active room rate with its season's date windows ([from, to, isExclusion]). */
export type RateRow = {
  rate_id: number;
  hotel_id: number;
  hotel_name: string;
  location_id: number;
  category_id: number | null;
  room_type_id: number;
  room_name: string;
  season: string;
  season_priority: number;
  rate_period_id: number;
  date_range_label: string;
  cp_cost: number | null;
  map_cost: number | null;
  extra_adult_cp: number | null;
  extra_adult_map: number | null;
  child_bed_cost: number | null;
  child_no_bed_cost: number | null;
  windows: [string, string, boolean][];
};

/** Everything the quotation engine needs apart from hotel rates. */
export type TourMasters = {
  locations: TourLocation[];
  categories: HotelCategory[];
  points: PickupPoint[];
  vehicles: TransportVehicle[];
  activities: LocationActivity[];
  distances: LocationDistance[];
  plans: DayPlan[];
  templates: QuotationTemplate[];
  settings: TourSettings;
};

// ---------------------------------------------------------------------
// Quotation builder inputs (stored in quotations.inputs)
// ---------------------------------------------------------------------

export type HotelPick = {
  /** null = automatic (cheapest in category), 'tbc' = similar category, enter a manual rate */
  hotel_id: number | 'tbc' | null;
  room_type_id: number | null;
  /** Manual per-night rate per room, used when no Rate Master hotel is picked */
  manual_rate: number | null;
};

export type StayInput = {
  uid: string;
  location_id: number;
  nights: number;
  opt1: HotelPick;
  opt2: HotelPick;
};

export type DayEdit = {
  /** route key the edit was made on; plan choice / ticks / title only apply while it matches */
  k: string;
  plan_id?: number;
  title?: string;
  off?: number[];
  add?: string[];
  custom?: string;
  note?: string;
};

export type OtherCost = { label: string; amount: number };

export type QuoteInputs = {
  customer_id: string | null;
  enquiry_id: string | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  title: string;
  trip_type: string;
  start_date: string; // YYYY-MM-DD
  adults: number;
  cwb: number;
  cnb: number;
  child_ages: string;
  rooms: number;
  meal: 'CP' | 'MAP';
  category_id: number | null;
  category2_id: number | null;
  pickup_point_id: number | null;
  drop_point_id: number | null;
  vehicle_id: number | null;
  vehicle_days: number | null; // null = nights + 1
  vehicle_km: number | null; // null = estimated from distances
  vehicle_extra: number; // tolls, parking, permits
  others: OtherCost[];
  markup_pct: number | null; // null = standard (admin only may override)
  gst_enabled?: boolean; // false = GST disabled / 0%
  extra_inclusions: string;
  stays: StayInput[];
  days: Record<string, DayEdit>;
  day_order?: string[];
  plan_picks: number[];
  template_id: number | null;
  valid_until: string | null;
  notes: string;
};

// ---------------------------------------------------------------------
// Rendered quotation (stored in quotations.snapshot)
// ---------------------------------------------------------------------

export type SnapshotOption = {
  label: string;
  category: string;
  total: number;
  per_person: number;
  /** rows: hotel, room, location, date, meals */
  hotels: [string, string, string, string, string][];
};

export type SnapshotDay = {
  n: number;
  date: string;
  title: string;
  lines: string[];
  tip: string;
  note: string;
  meals: string;
  stay: string;
  location: string;
};

export type QuoteSnapshot = {
  doc_title: string;
  duration: string;
  route: string[];
  guest: string;
  dates: string;
  guests_line: string;
  pickup: string;
  drop: string;
  vehicle: string;
  meal_plan: string;
  options: SnapshotOption[];
  days: SnapshotDay[];
  inclusions: string[];
  exclusions: string[];
  optional: [string, string, string][];
  cancellation: [string, string][];
  notes: string[];
  company: { name: string; phone: string; email: string; website: string; address: string };
  warnings: string[];
  generated_at: string;
};
