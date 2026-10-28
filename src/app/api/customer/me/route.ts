import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/supabase/customer-auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * Returns the signed-in customer's display name for the public site header.
 * Kept out of the public layout so every content page can be served from cache;
 * the header asks for the name in the browser instead.
 */
export async function GET() {
  try {
    const customer = await getCustomer();
    const name = customer?.full_name ?? customer?.email ?? null;
    return NextResponse.json(
      { name },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json({ name: null }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
}
