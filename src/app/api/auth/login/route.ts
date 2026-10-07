import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid credentials payload' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !authData?.session || !authData?.user) {
      return NextResponse.json(
        { error: 'Invalid login credentials' },
        { status: 401 }
      );
    }

    // Determine the user's role from public.profiles or public.customer_accounts
    let role = 'authenticated';

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profile) {
      if (!profile.is_active) {
        await supabase.auth.signOut();
        return NextResponse.json(
          { error: 'This account has been deactivated.' },
          { status: 403 }
        );
      }
      role = profile.role;
    } else {
      const { data: customer } = await supabase
        .from('customer_accounts')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (customer) {
        role = 'customer';
      }
    }

    // Return strictly access_token, refresh_token, and role
    return NextResponse.json(
      {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        role,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error('API login error:', err);
    return NextResponse.json(
      { error: 'An unexpected authentication error occurred.' },
      { status: 500 }
    );
  }
}
