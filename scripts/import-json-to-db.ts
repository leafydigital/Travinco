/**
 * One-time Data Migration Script: JSON to PostgreSQL/Supabase
 * Reads existing records from src/data/master-rates.json and migrates them
 * into normalized database tables (locations, hotel_categories, seasons, hotels,
 * room_types, rate_periods, room_rates, import_batches).
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { parseDateRange } from '../src/lib/excel/date-range-parser';

// Load environment variables from .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and key must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface MasterItem {
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

async function runMigration() {
  const jsonPath = path.join(process.cwd(), 'src', 'data', 'master-rates.json');
  if (!fs.existsSync(jsonPath)) {
    console.log(`No master-rates.json found at ${jsonPath}. Nothing to migrate.`);
    return;
  }

  const rawJson = fs.readFileSync(jsonPath, 'utf8');
  const items: MasterItem[] = JSON.parse(rawJson);
  console.log(`Loaded ${items.length} records from master-rates.json.`);

  if (items.length === 0) {
    console.log('JSON file is empty. Exiting.');
    return;
  }

  // 1. Create Migration Batch
  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      file_name: 'master-rates.json (initial migration)',
      file_hash: 'legacy_json_import',
      tariff_year: '2026-27',
      status: 'STAGED',
      rows_total: items.length,
      rows_ok: 0,
      rows_failed: 0,
    })
    .select('id')
    .single();

  if (batchErr || !batch) {
    console.error('Failed to create batch:', batchErr);
    return;
  }
  const batchId = batch.id as number;
  console.log(`Created batch #${batchId}.`);

  // 2. Locations
  const locationNames = Array.from(
    new Set(items.map((i) => i.location?.trim()).filter(Boolean) as string[])
  );
  const locationMap = new Map<string, number>();

  const { data: existingLocs } = await supabase.from('locations').select('id, name');
  (existingLocs || []).forEach((l: { id: number; name: string }) => {
    locationMap.set(l.name.toLowerCase(), l.id);
  });

  const missingLocs = locationNames.filter((n) => !locationMap.has(n.toLowerCase()));
  if (missingLocs.length > 0) {
    console.log(`Inserting ${missingLocs.length} new locations...`);
    const { data: ins } = await supabase
      .from('locations')
      .insert(missingLocs.map((name) => ({ name })))
      .select('id, name');
    (ins || []).forEach((l: { id: number; name: string }) => {
      locationMap.set(l.name.toLowerCase(), l.id);
    });
  }

  // 3. Hotel Categories
  const categoryNames = Array.from(
    new Set(items.map((i) => i.hotelCategory?.trim()).filter(Boolean) as string[])
  );
  const categoryMap = new Map<string, number>();

  const { data: existingCats } = await supabase.from('hotel_categories').select('id, name');
  (existingCats || []).forEach((c: { id: number; name: string }) => {
    categoryMap.set(c.name.toLowerCase(), c.id);
  });

  const missingCats = categoryNames.filter((n) => !categoryMap.has(n.toLowerCase()));
  if (missingCats.length > 0) {
    console.log(`Inserting ${missingCats.length} new categories...`);
    const { data: ins } = await supabase
      .from('hotel_categories')
      .insert(missingCats.map((name, idx) => ({ name, sort_order: idx + 1 })))
      .select('id, name');
    (ins || []).forEach((c: { id: number; name: string }) => {
      categoryMap.set(c.name.toLowerCase(), c.id);
    });
  }

  // 4. Seasons
  const seasonMap = new Map<string, number>();
  const { data: existingSeasons } = await supabase.from('seasons').select('id, code, name');
  (existingSeasons || []).forEach((s: { id: number; code: string; name: string }) => {
    seasonMap.set(s.name.toLowerCase(), s.id);
    seasonMap.set(s.code.toLowerCase(), s.id);
  });

  const rawSeasons = Array.from(
    new Set(items.map((i) => i.season?.trim()).filter(Boolean) as string[])
  );
  for (const sName of rawSeasons) {
    if (!seasonMap.has(sName.toLowerCase())) {
      const code = sName.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '_');
      const { data: newSeason } = await supabase
        .from('seasons')
        .insert({ code, name: sName, priority: 1 })
        .select('id, name')
        .single();
      if (newSeason) {
        seasonMap.set(sName.toLowerCase(), newSeason.id);
      }
    }
  }

  const defaultSeasonId =
    seasonMap.get('lean / off-peak season') || seasonMap.get('lean') || (existingSeasons?.[0]?.id as number) || 1;

  // 5. Hotels
  const hotelMap = new Map<string, number>();
  const { data: existingHotels } = await supabase.from('hotels').select('id, location_id, name');
  (existingHotels || []).forEach((h: { id: number; location_id: number; name: string }) => {
    hotelMap.set(`${h.location_id}::${h.name.toLowerCase()}`, h.id);
  });

  const distinctHotels = new Map<string, any>();
  for (const item of items) {
    if (!item.location || !item.hotelName) continue;
    const locId = locationMap.get(item.location.trim().toLowerCase());
    if (!locId) continue;
    const hName = item.hotelName.trim();
    const key = `${locId}::${hName.toLowerCase()}`;
    if (!hotelMap.has(key) && !distinctHotels.has(key)) {
      const catId = item.hotelCategory
        ? categoryMap.get(item.hotelCategory.trim().toLowerCase()) || null
        : null;
      distinctHotels.set(key, {
        location_id: locId,
        default_category_id: catId,
        name: hName,
      });
    }
  }

  if (distinctHotels.size > 0) {
    console.log(`Inserting ${distinctHotels.size} new hotels...`);
    const hotelRows = Array.from(distinctHotels.values());
    for (let i = 0; i < hotelRows.length; i += 200) {
      const chunk = hotelRows.slice(i, i + 200);
      const { data: ins } = await supabase
        .from('hotels')
        .insert(chunk)
        .select('id, location_id, name');
      (ins || []).forEach((h: { id: number; location_id: number; name: string }) => {
        hotelMap.set(`${h.location_id}::${h.name.toLowerCase()}`, h.id);
      });
    }
  }

  // 6. Room Types
  const roomTypeMap = new Map<string, number>();
  const { data: existingRooms } = await supabase.from('room_types').select('id, hotel_id, name');
  (existingRooms || []).forEach((rt: { id: number; hotel_id: number; name: string }) => {
    roomTypeMap.set(`${rt.hotel_id}::${rt.name.toLowerCase()}`, rt.id);
  });

  const distinctRooms = new Map<string, any>();
  for (const item of items) {
    if (!item.location || !item.hotelName || !item.roomCategory) continue;
    const locId = locationMap.get(item.location.trim().toLowerCase());
    if (!locId) continue;
    const hotelId = hotelMap.get(`${locId}::${item.hotelName.trim().toLowerCase()}`);
    if (!hotelId) continue;
    const rName = item.roomCategory.trim();
    const key = `${hotelId}::${rName.toLowerCase()}`;
    if (!roomTypeMap.has(key) && !distinctRooms.has(key)) {
      const catId = item.hotelCategory
        ? categoryMap.get(item.hotelCategory.trim().toLowerCase()) || null
        : null;
      distinctRooms.set(key, {
        hotel_id: hotelId,
        name: rName,
        category_id: catId,
      });
    }
  }

  if (distinctRooms.size > 0) {
    console.log(`Inserting ${distinctRooms.size} new room types...`);
    const roomRows = Array.from(distinctRooms.values());
    for (let i = 0; i < roomRows.length; i += 200) {
      const chunk = roomRows.slice(i, i + 200);
      const { data: ins } = await supabase
        .from('room_types')
        .insert(chunk)
        .select('id, hotel_id, name');
      (ins || []).forEach((rt: { id: number; hotel_id: number; name: string }) => {
        roomTypeMap.set(`${rt.hotel_id}::${rt.name.toLowerCase()}`, rt.id);
      });
    }
  }

  // 7. Rate Periods
  const ratePeriodMap = new Map<string, number>();
  const distinctRatePeriods = new Map<string, any>();

  for (const item of items) {
    if (!item.location || !item.hotelName) continue;
    const locId = locationMap.get(item.location.trim().toLowerCase());
    if (!locId) continue;
    const hotelId = hotelMap.get(`${locId}::${item.hotelName.trim().toLowerCase()}`);
    if (!hotelId) continue;

    const seasonId = item.season
      ? seasonMap.get(item.season.trim().toLowerCase()) || defaultSeasonId
      : defaultSeasonId;

    const rawRange = item.dateRange?.trim() || 'Standard Validity';
    const periodKey = `${hotelId}::${seasonId}::${rawRange.toLowerCase()}`;

    if (!distinctRatePeriods.has(periodKey)) {
      distinctRatePeriods.set(periodKey, {
        hotel_id: hotelId,
        season_id: seasonId,
        date_range_label: rawRange,
        infant_policy: item.infantPolicy || null,
        mandatory_surcharges: item.mandatorySurcharges || null,
        is_active: true,
        import_batch_id: batchId,
      });
    }
  }

  if (distinctRatePeriods.size > 0) {
    console.log(`Inserting ${distinctRatePeriods.size} new rate periods...`);
    const periodRows = Array.from(distinctRatePeriods.entries()).map(([k, v]) => ({ key: k, ...v }));
    for (let i = 0; i < periodRows.length; i += 200) {
      const chunk = periodRows.slice(i, i + 200);
      const dbChunk = chunk.map(({ key, ...rest }) => rest);
      const { data: ins, error: pErr } = await supabase
        .from('rate_periods')
        .insert(dbChunk)
        .select('id, hotel_id, season_id, date_range_label');

      if (pErr) {
        console.error('Error inserting rate periods:', pErr);
      } else {
        (ins || []).forEach((p: any, idx: number) => {
          ratePeriodMap.set(chunk[idx].key, p.id);
        });
      }
    }
  }

  // 8. Room Rates
  const rateRows = [];
  for (const item of items) {
    if (!item.location || !item.hotelName || !item.roomCategory) continue;
    const locId = locationMap.get(item.location.trim().toLowerCase());
    if (!locId) continue;
    const hotelId = hotelMap.get(`${locId}::${item.hotelName.trim().toLowerCase()}`);
    if (!hotelId) continue;
    const roomTypeId = roomTypeMap.get(`${hotelId}::${item.roomCategory.trim().toLowerCase()}`);
    if (!roomTypeId) continue;

    const seasonId = item.season
      ? seasonMap.get(item.season.trim().toLowerCase()) || defaultSeasonId
      : defaultSeasonId;

    const rawRange = item.dateRange?.trim() || 'Standard Validity';
    const periodKey = `${hotelId}::${seasonId}::${rawRange.toLowerCase()}`;
    const ratePeriodId = ratePeriodMap.get(periodKey);
    if (!ratePeriodId) continue;

    rateRows.push({
      room_type_id: roomTypeId,
      rate_period_id: ratePeriodId,
      cp_cost: item.cpCost ?? null,
      map_cost: item.mapCost ?? null,
      extra_adult_cp: item.extraAdultCP ?? null,
      extra_adult_map: item.extraAdultMAP ?? null,
      child_bed_cost: item.childBedCost ?? null,
      child_no_bed_cost: item.childNoBedCost ?? null,
      notes: item.notes || null,
    });
  }

  console.log(`Inserting ${rateRows.length} room rates...`);
  let inserted = 0;
  for (let i = 0; i < rateRows.length; i += 200) {
    const chunk = rateRows.slice(i, i + 200);
    const { data: ins, error: rErr } = await supabase.from('room_rates').insert(chunk).select('id');
    if (rErr) {
      console.error(`Error inserting chunk ${i}:`, rErr);
    } else {
      inserted += ins?.length || chunk.length;
    }
  }

  // 9. Update Batch to PUBLISHED
  await supabase
    .from('import_batches')
    .update({ status: 'PUBLISHED', rows_ok: inserted, rows_failed: 0 })
    .eq('id', batchId);

  console.log(`\n🎉 Migration Complete! Successfully migrated ${inserted} rates into database tables.`);
}

runMigration().catch(console.error);
