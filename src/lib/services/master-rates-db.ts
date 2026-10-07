import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { MasterHotelRateItem } from '@/lib/excel/master-parser';

export interface RateMasterQueryParams {
  search?: string;
  location?: string;
  hotelName?: string;
  hotelCategory?: string;
  season?: string;
  roomCategory?: string;
  dateRange?: string;
  minPrice?: number;
  maxPrice?: number;
  isActiveOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RateMasterQueryResult {
  data: MasterHotelRateItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MasterFilterOptions {
  locations: string[];
  hotelCategories: string[];
  seasons: string[];
  roomCategories: string[];
}

/**
 * Maps raw database view row to the application's MasterHotelRateItem interface.
 */
export function mapDbRowToMasterItem(row: Record<string, any>): MasterHotelRateItem {
  return {
    id: String(row.rate_id ?? row.id),
    location: row.location ?? null,
    hotelName: row.hotel_name ?? null,
    hotelCategory: row.hotel_category ?? null,
    season: row.season ?? null,
    dateRange: row.date_range ?? null,
    roomCategory: row.room_category ?? null,
    cpCost: row.cp_cost !== null && row.cp_cost !== undefined ? Number(row.cp_cost) : null,
    mapCost: row.map_cost !== null && row.map_cost !== undefined ? Number(row.map_cost) : null,
    extraAdultCP: row.extra_adult_cp !== null && row.extra_adult_cp !== undefined ? Number(row.extra_adult_cp) : null,
    extraAdultMAP: row.extra_adult_map !== null && row.extra_adult_map !== undefined ? Number(row.extra_adult_map) : null,
    childBedCost: row.child_bed_cost !== null && row.child_bed_cost !== undefined ? Number(row.child_bed_cost) : null,
    childNoBedCost: row.child_no_bed_cost !== null && row.child_no_bed_cost !== undefined ? Number(row.child_no_bed_cost) : null,
    infantPolicy: row.infant_policy ?? null,
    mandatorySurcharges: row.mandatory_surcharges ?? null,
    notes: row.notes ?? null,
  };
}

/**
 * Fetch paginated, filtered master rates from the Supabase view `v_rate_master`.
 */
export async function getMasterRatesFromDb(
  params: RateMasterQueryParams = {}
): Promise<RateMasterQueryResult> {
  const {
    search,
    location,
    hotelName,
    hotelCategory,
    season,
    roomCategory,
    dateRange,
    minPrice,
    maxPrice,
    page = 1,
    pageSize = 25,
    sortBy = 'location',
    sortOrder = 'asc',
  } = params;

  const supabase = await createClient();
  let query = supabase
    .from('v_rate_master')
    .select('*', { count: 'exact' });

  // Location filter
  if (location && location.trim()) {
    query = query.eq('location', location.trim());
  }

  // Hotel Category filter
  if (hotelCategory && hotelCategory.trim()) {
    query = query.eq('hotel_category', hotelCategory.trim());
  }

  // Season filter
  if (season && season.trim()) {
    query = query.eq('season', season.trim());
  }

  // Room Category filter
  if (roomCategory && roomCategory.trim()) {
    query = query.eq('room_category', roomCategory.trim());
  }

  // Hotel Name filter
  if (hotelName && hotelName.trim()) {
    query = query.ilike('hotel_name', `%${hotelName.trim()}%`);
  }

  // Date range filter
  if (dateRange && dateRange.trim()) {
    query = query.ilike('date_range', `%${dateRange.trim()}%`);
  }

  // Price filters
  if (minPrice !== undefined && !isNaN(minPrice)) {
    query = query.gte('cp_cost', minPrice);
  }
  if (maxPrice !== undefined && !isNaN(maxPrice)) {
    query = query.lte('cp_cost', maxPrice);
  }

  // Full-text / global search across multiple columns
  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(
      `hotel_name.ilike.%${term}%,location.ilike.%${term}%,room_category.ilike.%${term}%,notes.ilike.%${term}%,mandatory_surcharges.ilike.%${term}%`
    );
  }

  // Sort
  const dbSortColumn =
    sortBy === 'hotelName'
      ? 'hotel_name'
      : sortBy === 'hotelCategory'
      ? 'hotel_category'
      : sortBy === 'roomCategory'
      ? 'room_category'
      : sortBy === 'cpCost'
      ? 'cp_cost'
      : sortBy === 'mapCost'
      ? 'map_cost'
      : 'location';

  query = query.order(dbSortColumn, { ascending: sortOrder === 'asc' });

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching master rates from DB:', error);
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    data: (data || []).map(mapDbRowToMasterItem),
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Fetch all distinct filter options directly from database for dropdown menus.
 */
export async function getMasterFilterOptions(): Promise<MasterFilterOptions> {
  const supabase = await createClient();

  const [locsRes, catsRes, seasonsRes] = await Promise.all([
    supabase.from('locations').select('name').order('name'),
    supabase.from('hotel_categories').select('name').order('name'),
    supabase.from('seasons').select('name').order('name'),
  ]);

  return {
    locations: (locsRes.data || []).map((l: { name: string }) => l.name),
    hotelCategories: (catsRes.data || []).map((c: { name: string }) => c.name),
    seasons: (seasonsRes.data || []).map((s: { name: string }) => s.name),
    roomCategories: [],
  };
}

/**
 * Deletes a single room_rate record by ID.
 */
export async function deleteMasterRateFromDb(
  rateId: string | number,
  client?: any
): Promise<boolean> {
  let supabase = client;
  if (!supabase) {
    try {
      supabase = createServiceClient();
    } catch {
      // Fallback
    }
  }

  const idNum = typeof rateId === 'string' ? parseInt(rateId, 10) : rateId;
  if (isNaN(idNum)) return false;

  const { error } = await supabase.from('room_rates').delete().eq('id', idNum);
  if (error) {
    console.error('Error deleting room rate:', error);
    return false;
  }
  return true;
}

/**
 * Completely clears all master rates and related tables from the database.
 */
export async function clearAllMasterRatesFromDb(client?: any): Promise<boolean> {
  const supabase = client || (await createClient());

  try {
    // Cascading deletion in proper reverse-foreign-key dependency order
    const deleteSequence = [
      'period_surcharges',
      'hotel_followups',
      'room_rates',
      'rate_period_dates',
      'rate_periods',
      'rate_master_staging',
      'import_batches',
      'room_types',
      'hotels',
      'hotel_categories',
      'locations',
    ];

    for (const table of deleteSequence) {
      const { error } = await supabase
        .from(table)
        .delete()
        .gte('id', 0);

      if (error) {
        console.warn(`Warning clearing table ${table}:`, error.message);
      }
    }

    return true;
  } catch (err) {
    console.error('Error clearing master rates tables:', err);
    return false;
  }
}
