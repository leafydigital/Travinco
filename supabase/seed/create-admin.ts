/**
 * Creates (or promotes) the first super_admin account for local testing.
 *
 * Run with: npx tsx supabase/seed/create-admin.ts you@example.com yourpassword
 *
 * Uses the service-role client — never run this against production without
 * understanding it creates a real login with full access.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: npx tsx supabase/seed/create-admin.ts <email> <password>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Admin' },
  });

  if (createError) {
    console.error('Could not create user:', createError.message);
    process.exit(1);
  }

  // The handle_new_user() trigger (migration 009) already created a
  // profiles row defaulting to 'sales_staff' — promote it to super_admin.
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('id', created.user.id);

  if (updateError) {
    console.error('User created but could not set role:', updateError.message);
    process.exit(1);
  }

  console.log(`Created super_admin account: ${email}`);
  console.log('Sign in at /login with this email and the password you provided.');
}

main();
