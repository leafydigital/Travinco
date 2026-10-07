import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { parseMasterExcel, type MasterHotelRateItem } from '@/lib/excel/master-parser';
import { parseDateRange } from '@/lib/excel/date-range-parser';

export interface ImportRateMasterOptions {
  fileBuffer: Buffer;
  fileName: string;
  tariffYear?: string;
  userId?: string | null;
  notes?: string | null;
  allowDuplicate?: boolean;
  supabaseClient?: any;
}

export interface ImportRateMasterResult {
  success: boolean;
  batchId?: number;
  totalRows: number;
  importedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  warningCount: number;
  errorCount: number;
  errors: string[];
  warnings: string[];
  sheetName?: string;
  isDuplicate?: boolean;
}

function areValuesEqual(a: number | string | null | undefined, b: number | string | null | undefined): boolean {
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) {
    return true;
  }
  if (typeof a === 'number' || typeof b === 'number') {
    const numA = a === null || a === undefined ? null : Number(a);
    const numB = b === null || b === undefined ? null : Number(b);
    return numA === numB;
  }
  return String(a || '').trim() === String(b || '').trim();
}

/**
 * Full transactional Rate Master import service with Smart Diff & Upsert
 */
export async function importRateMasterBatch(
  options: ImportRateMasterOptions
): Promise<ImportRateMasterResult> {
  const {
    fileBuffer,
    fileName,
    tariffYear = '2026-27',
    userId,
    allowDuplicate = true,
    supabaseClient,
  } = options;

  let supabase = supabaseClient;
  if (!supabase) {
    try {
      supabase = createServiceClient();
    } catch {
      // Fallback
    }
  }

  // 1. Calculate SHA-256 Hash
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // Check if an identical spreadsheet file was already imported and published
  const { data: existingBatch } = await supabase
    .from('import_batches')
    .select('id, file_name, uploaded_at, status, rows_total, rows_ok')
    .eq('file_hash', fileHash)
    .in('status', ['PUBLISHED', 'COMPLETED'])
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingBatch) {
    const total = existingBatch.rows_total || existingBatch.rows_ok || 0;
    return {
      success: true,
      batchId: existingBatch.id,
      totalRows: total,
      importedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: total,
      warningCount: 0,
      errorCount: 0,
      errors: [],
      warnings: [],
      sheetName: 'Rate Master',
      isDuplicate: true,
    };
  }

  // 2. Parse Excel buffer
  const parseResult = parseMasterExcel(fileBuffer);
  if (!parseResult.success && parseResult.data.length === 0) {
    return {
      success: false,
      totalRows: 0,
      importedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      warningCount: 0,
      errorCount: parseResult.errors.length || 1,
      errors: parseResult.errors.length ? parseResult.errors : ['Failed to parse Excel sheet.'],
      warnings: [],
      sheetName: parseResult.sheetName,
    };
  }

  const rawItems = parseResult.data;
  const totalRows = rawItems.length;

  // 3. Create initial batch record in STAGED status
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      file_name: fileName,
      file_hash: fileHash,
      tariff_year: tariffYear,
      status: 'STAGED',
      uploaded_by: userId || null,
      rows_total: totalRows,
      rows_ok: 0,
      rows_failed: 0,
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    console.error('Failed to create import batch:', batchError);
    return {
      success: false,
      totalRows,
      importedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      warningCount: 0,
      errorCount: 1,
      errors: [`Database error: could not create import batch (${batchError?.message || 'Unknown'})`],
      warnings: [],
    };
  }

  const batchId = batch.id as number;
  const batchErrors: string[] = [...parseResult.errors];
  const batchWarnings: string[] = [];

  try {
    // 4. Staging validation & insertion
    const stagingRows = [];
    const validRowsToProcess: {
      index: number;
      item: MasterHotelRateItem;
      parsedDates: ReturnType<typeof parseDateRange>;
    }[] = [];

    let lastSeenLocation = 'Kerala';

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      if (!item) continue;
      const rowNum = i + 2; // header is row 1
      const rowErrors: string[] = [];

      const hasHotel = item.hotelName && item.hotelName.trim();
      const hasRoom = item.roomCategory && item.roomCategory.trim();
      const hasCost = item.cpCost !== null || item.mapCost !== null;

      if (!hasHotel && !hasRoom && !hasCost) {
        // Skip empty row
        continue;
      }

      if (item.location && item.location.trim()) {
        lastSeenLocation = item.location.trim();
      } else {
        item.location = lastSeenLocation;
      }

      if (!hasHotel) {
        rowErrors.push('Missing hotel name');
      }

      if (!hasRoom) {
        item.roomCategory = 'Standard Room';
      }

      const parsedDates = parseDateRange(item.dateRange);
      if (!parsedDates.isValid && item.dateRange) {
        batchWarnings.push(`Row ${rowNum} (${item.hotelName || 'Unknown'}): ${parsedDates.error || 'Date parsing warning'}`);
      }

      const status = rowErrors.length > 0 ? 'ERROR' : parsedDates.isValid ? 'OK' : 'WARNING';
      if (rowErrors.length > 0) {
        batchErrors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
      }

      stagingRows.push({
        batch_id: batchId,
        excel_row_no: rowNum,
        location: item.location || lastSeenLocation,
        hotel_name: item.hotelName || null,
        hotel_category: item.hotelCategory || null,
        season: item.season || null,
        date_range: item.dateRange || null,
        room_category: item.roomCategory || 'Standard Room',
        cp_cost: item.cpCost !== null && item.cpCost !== undefined ? item.cpCost : null,
        map_cost: item.mapCost !== null && item.mapCost !== undefined ? item.mapCost : null,
        extra_adult_cp: item.extraAdultCP !== null && item.extraAdultCP !== undefined ? item.extraAdultCP : null,
        extra_adult_map: item.extraAdultMAP !== null && item.extraAdultMAP !== undefined ? item.extraAdultMAP : null,
        child_bed_cost: item.childBedCost !== null && item.childBedCost !== undefined ? item.childBedCost : null,
        child_no_bed_cost: item.childNoBedCost !== null && item.childNoBedCost !== undefined ? item.childNoBedCost : null,
        infant_policy: item.infantPolicy || null,
        mandatory_surcharges: item.mandatorySurcharges || null,
        notes: item.notes || null,
        row_status: status,
        row_message: rowErrors.length > 0 ? rowErrors.join('; ') : parsedDates.error || null,
      });

      if (status !== 'ERROR') {
        validRowsToProcess.push({
          index: i,
          item,
          parsedDates,
        });
      }
    }

    // Insert staging rows in chunks of 500
    for (let c = 0; c < stagingRows.length; c += 500) {
      const chunk = stagingRows.slice(c, c + 500);
      const { error: stagingErr } = await supabase.from('rate_master_staging').insert(chunk);
      if (stagingErr) {
        console.error('Staging insert error:', stagingErr);
      }
    }

    if (validRowsToProcess.length === 0) {
      await supabase
        .from('import_batches')
        .update({ status: 'FAILED', rows_failed: totalRows })
        .eq('id', batchId);

      return {
        success: false,
        batchId,
        totalRows,
        importedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        warningCount: batchWarnings.length,
        errorCount: batchErrors.length,
        errors: batchErrors,
        warnings: batchWarnings,
        sheetName: parseResult.sheetName,
      };
    }

    // 5. Upsert Dimension Tables

    // A. Locations
    const locationNames = Array.from(
      new Set(validRowsToProcess.map((r) => r.item.location?.trim()).filter(Boolean) as string[])
    );
    const locationMap = new Map<string, number>();

    const { data: existingLocs } = await supabase.from('locations').select('id, name');
    (existingLocs || []).forEach((l: { id: number; name: string }) => {
      locationMap.set(l.name.toLowerCase(), l.id);
    });

    const newLocs = locationNames.filter((name) => !locationMap.has(name.toLowerCase()));
    if (newLocs.length > 0) {
      const { data: insertedLocs, error: locErr } = await supabase
        .from('locations')
        .insert(newLocs.map((name) => ({ name })))
        .select('id, name');

      if (locErr) {
        console.error('Error inserting locations:', locErr);
      } else {
        (insertedLocs || []).forEach((l: { id: number; name: string }) => {
          locationMap.set(l.name.toLowerCase(), l.id);
        });
      }
    }

    // B. Hotel Categories
    const categoryNames = Array.from(
      new Set(validRowsToProcess.map((r) => r.item.hotelCategory?.trim()).filter(Boolean) as string[])
    );
    const categoryMap = new Map<string, number>();

    const { data: existingCats } = await supabase.from('hotel_categories').select('id, name');
    (existingCats || []).forEach((c: { id: number; name: string }) => {
      categoryMap.set(c.name.toLowerCase(), c.id);
    });

    const newCats = categoryNames.filter((name) => !categoryMap.has(name.toLowerCase()));
    if (newCats.length > 0) {
      const { data: insertedCats, error: catErr } = await supabase
        .from('hotel_categories')
        .insert(
          newCats.map((name, idx) => ({
            name,
            sort_order: idx + 1,
          }))
        )
        .select('id, name');

      if (catErr) {
        console.error('Error inserting categories:', catErr);
      } else {
        (insertedCats || []).forEach((c: { id: number; name: string }) => {
          categoryMap.set(c.name.toLowerCase(), c.id);
        });
      }
    }

    // C. Seasons
    const seasonMap = new Map<string, number>();
    const { data: existingSeasons } = await supabase.from('seasons').select('id, code, name');
    (existingSeasons || []).forEach((s: { id: number; code: string; name: string }) => {
      seasonMap.set(s.name.toLowerCase(), s.id);
      seasonMap.set(s.code.toLowerCase(), s.id);
    });

    const rawSeasons = Array.from(
      new Set(validRowsToProcess.map((r) => r.item.season?.trim()).filter(Boolean) as string[])
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
      seasonMap.get('lean / off-peak season') ||
      seasonMap.get('lean') ||
      (existingSeasons?.[0]?.id as number) ||
      1;

    // D. Hotels
    const hotelMap = new Map<string, number>();
    const { data: existingHotels } = await supabase.from('hotels').select('id, location_id, name');
    (existingHotels || []).forEach((h: { id: number; location_id: number; name: string }) => {
      hotelMap.set(`${h.location_id}::${h.name.toLowerCase()}`, h.id);
    });

    const distinctHotels = new Map<
      string,
      {
        location_id: number;
        default_category_id: number | null;
        name: string;
      }
    >();

    for (const r of validRowsToProcess) {
      const locId = locationMap.get((r.item.location || '').toLowerCase()) || locationMap.get('kerala') || 1;
      const hotelName = r.item.hotelName!.trim();
      const key = `${locId}::${hotelName.toLowerCase()}`;

      if (!hotelMap.has(key) && !distinctHotels.has(key)) {
        const catId = r.item.hotelCategory
          ? categoryMap.get(r.item.hotelCategory.toLowerCase()) || null
          : null;

        distinctHotels.set(key, {
          location_id: locId,
          default_category_id: catId,
          name: hotelName,
        });
      }
    }

    if (distinctHotels.size > 0) {
      const hotelInsertRows = Array.from(distinctHotels.values());
      for (let c = 0; c < hotelInsertRows.length; c += 200) {
        const chunk = hotelInsertRows.slice(c, c + 200);
        const { data: insertedHotels, error: hotelErr } = await supabase
          .from('hotels')
          .insert(chunk)
          .select('id, location_id, name');

        if (hotelErr) {
          console.error('Error inserting hotels:', hotelErr);
        } else {
          (insertedHotels || []).forEach((h: { id: number; location_id: number; name: string }) => {
            hotelMap.set(`${h.location_id}::${h.name.toLowerCase()}`, h.id);
          });
        }
      }
    }

    // E. Room Types
    const roomTypeMap = new Map<string, number>();
    const { data: existingRooms } = await supabase.from('room_types').select('id, hotel_id, name');
    (existingRooms || []).forEach((rt: { id: number; hotel_id: number; name: string }) => {
      roomTypeMap.set(`${rt.hotel_id}::${rt.name.toLowerCase()}`, rt.id);
    });

    const distinctRooms = new Map<
      string,
      {
        hotel_id: number;
        name: string;
        category_id: number | null;
      }
    >();

    for (const r of validRowsToProcess) {
      const locId = locationMap.get((r.item.location || '').toLowerCase()) || locationMap.get('kerala') || 1;
      const hotelId = hotelMap.get(`${locId}::${r.item.hotelName!.trim().toLowerCase()}`);
      if (!hotelId) continue;

      const roomName = (r.item.roomCategory || 'Standard Room').trim();
      const roomKey = `${hotelId}::${roomName.toLowerCase()}`;

      if (!roomTypeMap.has(roomKey) && !distinctRooms.has(roomKey)) {
        const catId = r.item.hotelCategory
          ? categoryMap.get(r.item.hotelCategory.toLowerCase()) || null
          : null;

        distinctRooms.set(roomKey, {
          hotel_id: hotelId,
          name: roomName,
          category_id: catId,
        });
      }
    }

    if (distinctRooms.size > 0) {
      const roomInsertRows = Array.from(distinctRooms.values());
      for (let c = 0; c < roomInsertRows.length; c += 200) {
        const chunk = roomInsertRows.slice(c, c + 200);
        const { data: insertedRooms, error: roomErr } = await supabase
          .from('room_types')
          .insert(chunk)
          .select('id, hotel_id, name');

        if (roomErr) {
          console.error('Error inserting room types:', roomErr);
        } else {
          (insertedRooms || []).forEach((rt: { id: number; hotel_id: number; name: string }) => {
            roomTypeMap.set(`${rt.hotel_id}::${rt.name.toLowerCase()}`, rt.id);
          });
        }
      }
    }

    // F. Rate Periods & Period Dates
    // Query existing rate periods across these hotels to reuse existing periods where matching
    const ratePeriodMap = new Map<string, number>();

    // Fetch existing active rate periods for known hotels
    const hotelIdList = Array.from(new Set(Array.from(hotelMap.values())));
    if (hotelIdList.length > 0) {
      for (let h = 0; h < hotelIdList.length; h += 200) {
        const chunk = hotelIdList.slice(h, h + 200);
        const { data: existingPeriods } = await supabase
          .from('rate_periods')
          .select('id, hotel_id, season_id, date_range_label')
          .in('hotel_id', chunk);

        (existingPeriods || []).forEach((p: { id: number; hotel_id: number; season_id: number; date_range_label: string }) => {
          const key = `${p.hotel_id}::${p.season_id}::${(p.date_range_label || '').toLowerCase()}`;
          ratePeriodMap.set(key, p.id);
        });
      }
    }

    const distinctRatePeriodsToInsert = new Map<
      string,
      {
        hotel_id: number;
        season_id: number;
        date_range_label: string;
        infant_policy: string | null;
        mandatory_surcharges: string | null;
        is_active: boolean;
        import_batch_id: number;
        parsedDates: ReturnType<typeof parseDateRange>;
      }
    >();

    for (const r of validRowsToProcess) {
      const locId = locationMap.get((r.item.location || '').toLowerCase()) || locationMap.get('kerala') || 1;
      const hotelId = hotelMap.get(`${locId}::${r.item.hotelName!.trim().toLowerCase()}`);
      if (!hotelId) continue;

      const seasonId = r.item.season
        ? seasonMap.get(r.item.season.toLowerCase()) || defaultSeasonId
        : defaultSeasonId;

      const rawRange = r.item.dateRange?.trim() || 'Standard Validity';
      const periodKey = `${hotelId}::${seasonId}::${rawRange.toLowerCase()}`;

      if (!ratePeriodMap.has(periodKey) && !distinctRatePeriodsToInsert.has(periodKey)) {
        distinctRatePeriodsToInsert.set(periodKey, {
          hotel_id: hotelId,
          season_id: seasonId,
          date_range_label: rawRange,
          infant_policy: r.item.infantPolicy || null,
          mandatory_surcharges: r.item.mandatorySurcharges || null,
          is_active: true,
          import_batch_id: batchId,
          parsedDates: r.parsedDates,
        });
      }
    }

    if (distinctRatePeriodsToInsert.size > 0) {
      const ratePeriodInsertRows = Array.from(distinctRatePeriodsToInsert.entries()).map(([key, rp]) => ({
        key,
        hotel_id: rp.hotel_id,
        season_id: rp.season_id,
        date_range_label: rp.date_range_label,
        infant_policy: rp.infant_policy,
        mandatory_surcharges: rp.mandatory_surcharges,
        is_active: true,
        import_batch_id: batchId,
        parsedDates: rp.parsedDates,
      }));

      for (let c = 0; c < ratePeriodInsertRows.length; c += 200) {
        const chunk = ratePeriodInsertRows.slice(c, c + 200);
        const dbChunk = chunk.map((item) => ({
          hotel_id: item.hotel_id,
          season_id: item.season_id,
          date_range_label: item.date_range_label,
          infant_policy: item.infant_policy,
          mandatory_surcharges: item.mandatory_surcharges,
          is_active: item.is_active,
          import_batch_id: item.import_batch_id,
        }));

        const { data: insertedPeriods, error: periodErr } = await supabase
          .from('rate_periods')
          .insert(dbChunk)
          .select('id, hotel_id, season_id, date_range_label');

        if (periodErr) {
          console.error('Error inserting rate periods:', periodErr);
        } else {
          (insertedPeriods || []).forEach(
            (p: { id: number; hotel_id: number; season_id: number; date_range_label: string }, idx: number) => {
              const original = chunk[idx];
              if (original) {
                ratePeriodMap.set(original.key, p.id);

                const periodDateRows: {
                  rate_period_id: number;
                  valid_from: string;
                  valid_to: string;
                  is_exclusion: boolean;
                }[] = [];

                original.parsedDates.ranges.forEach((rng) => {
                  periodDateRows.push({
                    rate_period_id: p.id,
                    valid_from: rng.startDate,
                    valid_to: rng.endDate,
                    is_exclusion: false,
                  });
                });

                original.parsedDates.exclusions.forEach((excl) => {
                  periodDateRows.push({
                    rate_period_id: p.id,
                    valid_from: excl.startDate,
                    valid_to: excl.endDate,
                    is_exclusion: true,
                  });
                });

                if (periodDateRows.length > 0) {
                  supabase.from('rate_period_dates').insert(periodDateRows).then();
                }
              }
            }
          );
        }
      }
    }

    // G. Smart Diff & Upsert for Room Rates
    // 1. Fetch all existing room rates for the resolved rate_period_ids
    const allRatePeriodIds = Array.from(new Set(Array.from(ratePeriodMap.values())));
    const existingRateMap = new Map<
      string,
      {
        id: number;
        rate_period_id: number;
        room_type_id: number;
        cp_cost: number | null;
        map_cost: number | null;
        extra_adult_cp: number | null;
        extra_adult_map: number | null;
        child_bed_cost: number | null;
        child_no_bed_cost: number | null;
        notes: string | null;
      }
    >();

    for (let p = 0; p < allRatePeriodIds.length; p += 200) {
      const chunk = allRatePeriodIds.slice(p, p + 200);
      const { data: dbRates } = await supabase
        .from('room_rates')
        .select('id, rate_period_id, room_type_id, cp_cost, map_cost, extra_adult_cp, extra_adult_map, child_bed_cost, child_no_bed_cost, notes')
        .in('rate_period_id', chunk);

      (dbRates || []).forEach((r: any) => {
        existingRateMap.set(`${r.rate_period_id}::${r.room_type_id}`, r);
      });
    }

    // 2. Classify rows into: Skip (unchanged), Update (diff found), Insert (brand new)
    const ratesToInsert = new Map<string, any>();
    const ratesToUpdate: { id: number; payload: any }[] = [];
    let skippedCount = 0;

    for (const r of validRowsToProcess) {
      const locId = locationMap.get((r.item.location || '').toLowerCase()) || locationMap.get('kerala') || 1;
      const hotelId = hotelMap.get(`${locId}::${r.item.hotelName!.trim().toLowerCase()}`);
      if (!hotelId) continue;
      const roomTypeId = roomTypeMap.get(`${hotelId}::${(r.item.roomCategory || 'Standard Room').trim().toLowerCase()}`);
      if (!roomTypeId) continue;

      const seasonId = r.item.season
        ? seasonMap.get(r.item.season.toLowerCase()) || defaultSeasonId
        : defaultSeasonId;

      const rawRange = r.item.dateRange?.trim() || 'Standard Validity';
      const periodKey = `${hotelId}::${seasonId}::${rawRange.toLowerCase()}`;
      const ratePeriodId = ratePeriodMap.get(periodKey);
      if (!ratePeriodId) continue;

      const rateKey = `${ratePeriodId}::${roomTypeId}`;
      const newPayload = {
        room_type_id: roomTypeId,
        rate_period_id: ratePeriodId,
        cp_cost: r.item.cpCost !== null && r.item.cpCost !== undefined ? r.item.cpCost : null,
        map_cost: r.item.mapCost !== null && r.item.mapCost !== undefined ? r.item.mapCost : null,
        extra_adult_cp: r.item.extraAdultCP !== null && r.item.extraAdultCP !== undefined ? r.item.extraAdultCP : null,
        extra_adult_map: r.item.extraAdultMAP !== null && r.item.extraAdultMAP !== undefined ? r.item.extraAdultMAP : null,
        child_bed_cost: r.item.childBedCost !== null && r.item.childBedCost !== undefined ? r.item.childBedCost : null,
        child_no_bed_cost: r.item.childNoBedCost !== null && r.item.childNoBedCost !== undefined ? r.item.childNoBedCost : null,
        notes: r.item.notes || null,
      };

      const existing = existingRateMap.get(rateKey);

      if (existing) {
        // Compare values to see if any price or detail changed
        const isIdentical =
          areValuesEqual(existing.cp_cost, newPayload.cp_cost) &&
          areValuesEqual(existing.map_cost, newPayload.map_cost) &&
          areValuesEqual(existing.extra_adult_cp, newPayload.extra_adult_cp) &&
          areValuesEqual(existing.extra_adult_map, newPayload.extra_adult_map) &&
          areValuesEqual(existing.child_bed_cost, newPayload.child_bed_cost) &&
          areValuesEqual(existing.child_no_bed_cost, newPayload.child_no_bed_cost) &&
          areValuesEqual(existing.notes, newPayload.notes);

        if (isIdentical) {
          skippedCount++;
        } else {
          ratesToUpdate.push({ id: existing.id, payload: newPayload });
        }
      } else {
        ratesToInsert.set(rateKey, newPayload);
      }
    }

    // 3. Execute Inserts
    let insertedCount = 0;
    const insertList = Array.from(ratesToInsert.values());
    for (let c = 0; c < insertList.length; c += 200) {
      const chunk = insertList.slice(c, c + 200);
      const { data: inserted, error: insErr } = await supabase
        .from('room_rates')
        .insert(chunk)
        .select('id');

      if (insErr) {
        console.error('Error inserting new room rates:', insErr);
        batchErrors.push(`Insert batch error: ${insErr.message}`);
      } else {
        insertedCount += inserted?.length || chunk.length;
      }
    }

    // 4. Execute Updates
    let updatedCount = 0;
    for (const item of ratesToUpdate) {
      const { error: updErr } = await supabase
        .from('room_rates')
        .update(item.payload)
        .eq('id', item.id);

      if (updErr) {
        console.error('Error updating room rate #', item.id, updErr);
      } else {
        updatedCount++;
      }
    }

    // 6. Update Batch Status
    const totalProcessed = insertedCount + updatedCount;
    await supabase
      .from('import_batches')
      .update({
        status: 'PUBLISHED',
        rows_ok: totalProcessed,
        rows_failed: batchErrors.length,
      })
      .eq('id', batchId);

    return {
      success: true,
      batchId,
      totalRows: validRowsToProcess.length,
      importedCount: totalProcessed,
      insertedCount,
      updatedCount,
      skippedCount,
      warningCount: batchWarnings.length,
      errorCount: batchErrors.length,
      errors: batchErrors.slice(0, 10),
      warnings: batchWarnings.slice(0, 10),
      sheetName: parseResult.sheetName,
    };
  } catch (err: unknown) {
    console.error('Fatal error during rate master import:', err);
    await supabase
      .from('import_batches')
      .update({ status: 'FAILED', rows_failed: totalRows })
      .eq('id', batchId);

    return {
      success: false,
      batchId,
      totalRows,
      importedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      warningCount: batchWarnings.length,
      errorCount: batchErrors.length + 1,
      errors: [...batchErrors, `Fatal error: ${err instanceof Error ? err.message : String(err)}`],
      warnings: batchWarnings,
      sheetName: parseResult.sheetName,
    };
  }
}
