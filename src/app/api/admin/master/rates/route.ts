import { NextResponse, type NextRequest } from 'next/server';
import { getProfile, hasPageAccess } from '@/lib/supabase/auth-helpers';
import { getMasterRatesFromDb, type RateMasterQueryParams } from '@/lib/services/master-rates-db';

export const dynamic = 'force-dynamic';

/**
 * Rate Master list endpoint (GET).
 * Used instead of a Server Action because Server Actions are queued with router
 * navigations in Next 14: a slow list reload would block leaving the page.
 * A plain fetch never blocks navigation and the client aborts it on unmount.
 */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await hasPageAccess(profile, 'master'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const str = (key: string) => sp.get(key) || undefined;
  const num = (key: string) => {
    const v = sp.get(key);
    return v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined;
  };

  const sortOrder = sp.get('sortOrder');
  const params: RateMasterQueryParams = {
    search: str('search'),
    location: str('location'),
    hotelName: str('hotelName'),
    hotelCategory: str('hotelCategory'),
    season: str('season'),
    roomCategory: str('roomCategory'),
    dateRange: str('dateRange'),
    page: num('page'),
    pageSize: num('pageSize'),
    sortBy: str('sortBy'),
    sortOrder: sortOrder === 'desc' ? 'desc' : sortOrder === 'asc' ? 'asc' : undefined,
  };

  try {
    const result = await getMasterRatesFromDb(params);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/admin/master/rates failed:', err);
    return NextResponse.json({ error: 'Failed to load rates.' }, { status: 500 });
  }
}
