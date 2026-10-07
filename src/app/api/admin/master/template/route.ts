import { NextResponse } from 'next/server';
import { requireProfile, assertRole } from '@/lib/supabase/auth-helpers';
import { generateSampleExcelBuffer } from '@/lib/excel/master-parser';

export async function GET() {
  try {
    const profile = await requireProfile();
    assertRole(profile, ['admin', 'super_admin']);

    const buffer = generateSampleExcelBuffer();

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="master_rates_template.xlsx"',
      },
    });
  } catch (err: unknown) {
    console.error('Template download error:', err);
    return NextResponse.json({ error: 'Unauthorized or failed to generate template.' }, { status: 403 });
  }
}
