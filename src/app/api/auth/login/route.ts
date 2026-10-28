import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  checkLoginLockout,
  recordFailedLoginAttempt,
  clearLoginAttempts,
  MAX_LOGIN_ATTEMPTS,
} from '@/lib/auth/login-limiter';
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

    // 1. Check if account is locked
    const lockoutStatus = await checkLoginLockout(parsed.data.email, 'customer');
    if (lockoutStatus.limitReached || lockoutStatus.isLocked) {
      const mins = lockoutStatus.minutesRemaining || 15;
      return NextResponse.json(
        {
          error: lockoutStatus.limitReached
            ? 'You have reached your login limit. Please reset your password.'
            : `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
          isLocked: lockoutStatus.isLocked,
          limitReached: lockoutStatus.limitReached,
          remainingAttempts: 0,
        },
        { status: 429 }
      );
    }

    const supabase = await createClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !authData?.session || !authData?.user) {
      const attemptStatus = await recordFailedLoginAttempt(parsed.data.email, 'customer');
      if (attemptStatus.isLocked) {
        return NextResponse.json(
          {
            error: `Too many failed login attempts (${MAX_LOGIN_ATTEMPTS}/${MAX_LOGIN_ATTEMPTS}). Your account is locked for 15 minutes.`,
            isLocked: true,
            remainingAttempts: 0,
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          error: `Incorrect email or password. You have ${attemptStatus.remainingAttempts} attempt(s) remaining before account lockout.`,
          remainingAttempts: attemptStatus.remainingAttempts,
        },
        { status: 401 }
      );
    }

    // Login succeeded: clear attempts
    await clearLoginAttempts(parsed.data.email, 'customer');

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
