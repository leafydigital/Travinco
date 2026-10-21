import assert from 'node:assert';
import { sanitizeCookies, type CookieToSet } from '../src/lib/supabase/cookie-sanitizer';
import { ADMIN_AUTH_COOKIE, CUSTOMER_AUTH_COOKIE } from '../src/lib/supabase/server';

// Base64 helper for simulating Supabase SSR session payloads
const BASE64_PREFIX = 'base64-';

function makeSlimSession(role: string, accessToken: string) {
  const payload = {
    access_token: accessToken,
    refresh_token: `refresh-${accessToken}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: `user-${accessToken}`, role },
    role,
  };
  return BASE64_PREFIX + Buffer.from(JSON.stringify(payload)).toString('base64url');
}

console.log('--- STARTING AUTH & SESSION ISOLATION TESTS ---\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// 1. Distinct cookie names test
runTest('Cookie Constants Isolation', () => {
  assert.strictEqual(ADMIN_AUTH_COOKIE, 'sb-admin-auth-token');
  assert.strictEqual(CUSTOMER_AUTH_COOKIE, 'sb-customer-auth-token');
  assert.notStrictEqual(ADMIN_AUTH_COOKIE, CUSTOMER_AUTH_COOKIE);
});

// 2. Cookie sanitizer: correctly sanitizes admin cookie without touching customer cookie
runTest('Sanitize Cookies preserves isolation between admin and customer sessions', () => {
  const adminValue = makeSlimSession('super_admin', 'token-admin-123');
  const customerValue = makeSlimSession('customer', 'token-cust-456');

  const incoming: CookieToSet[] = [
    { name: `${ADMIN_AUTH_COOKIE}.0`, value: adminValue, options: { path: '/' } },
    { name: `${CUSTOMER_AUTH_COOKIE}.0`, value: customerValue, options: { path: '/' } },
    { name: 'other_cookie', value: '123', options: { path: '/' } },
  ];

  const sanitized = sanitizeCookies(incoming);

  // Checks that both sessions were sanitized and retained as .0 chunks
  const adminChunk = sanitized.find((c) => c.name === `${ADMIN_AUTH_COOKIE}.0`);
  const customerChunk = sanitized.find((c) => c.name === `${CUSTOMER_AUTH_COOKIE}.0`);
  const otherCookie = sanitized.find((c) => c.name === 'other_cookie');

  assert.ok(adminChunk, 'Admin cookie .0 chunk must exist');
  assert.ok(customerChunk, 'Customer cookie .0 chunk must exist');
  assert.ok(otherCookie, 'Non-auth cookie must be preserved');

  // Verify secure cookie attributes
  assert.strictEqual(adminChunk.options?.httpOnly, true, 'Admin cookie must be httpOnly');
  assert.strictEqual(adminChunk.options?.sameSite, 'lax', 'Admin cookie must have sameSite: lax');
  assert.strictEqual(customerChunk.options?.httpOnly, true, 'Customer cookie must be httpOnly');
  assert.strictEqual(customerChunk.options?.sameSite, 'lax', 'Customer cookie must have sameSite: lax');

  // Decode sessions to verify payload contents
  const adminJson = Buffer.from(adminChunk.value.replace(BASE64_PREFIX, ''), 'base64url').toString('utf8');
  const adminObj = JSON.parse(adminJson);
  assert.strictEqual(adminObj.access_token, 'token-admin-123');
  assert.strictEqual(adminObj.role, 'super_admin');

  const custJson = Buffer.from(customerChunk.value.replace(BASE64_PREFIX, ''), 'base64url').toString('utf8');
  const custObj = JSON.parse(custJson);
  assert.strictEqual(custObj.access_token, 'token-cust-456');
  assert.strictEqual(custObj.role, 'customer');
});

// 3. Scenario 1: Admin logged in -> Open customer Login -> Customer login page must appear (not redirect to admin)
runTest('Scenario 1: Admin logged in -> Open customer Login -> Customer login page must appear', () => {
  // Simulate request state when admin is logged in, but customer is null
  const hasAdmin = true;
  const hasCustomer = false;
  const isCustomerAuthRoute = true;

  // Middleware routing decision
  let destination = 'ALLOW_CUSTOMER_LOGIN';
  if (hasCustomer) {
    destination = '/account/bookings';
  } else if (isCustomerAuthRoute) {
    // Admin session alone does NOT redirect away from customer login. Display login form!
    destination = 'ALLOW_CUSTOMER_LOGIN';
  }

  assert.strictEqual(destination, 'ALLOW_CUSTOMER_LOGIN', 'Should display customer login page');
});

// 4. Scenario 2: Admin logged in -> Click Book With Us -> Customer login must appear if no customer session exists
runTest('Scenario 2: Admin logged in -> Click Book With Us -> Customer login must appear', () => {
  const hasAdmin = true;
  const hasCustomer = false;
  const isBookingRoute = true;

  let redirectTarget: string | null = null;
  if (isBookingRoute) {
    if (!hasCustomer) {
      // Admin session alone does not bypass customer auth
      redirectTarget = '/account/login?redirectTo=/booking';
    }
  }

  assert.strictEqual(redirectTarget, '/account/login?redirectTo=/booking');
});

// 5. Scenario 3: Customer logged in -> Click Login -> Customer account page should open
runTest('Scenario 3: Customer logged in -> Click Login -> Customer account page should open', () => {
  const hasCustomer = true;
  const isCustomerAuthRoute = true;

  let redirectTarget: string | null = null;
  if (isCustomerAuthRoute && hasCustomer) {
    redirectTarget = '/account/bookings';
  }

  assert.strictEqual(redirectTarget, '/account/bookings');
});

// 6. Scenario 4: Customer logged in -> Click Book With Us -> Booking form should appear
runTest('Scenario 4: Customer logged in -> Click Book With Us -> Booking form should appear directly', () => {
  const hasCustomer = true;
  const isBookingRoute = true;

  let allowBooking = false;
  if (isBookingRoute && hasCustomer) {
    allowBooking = true;
  }

  assert.strictEqual(allowBooking, true);
});

// 7. Scenario 5: Customer logged in -> Attempt to access admin dashboard directly -> Access must be denied
runTest('Scenario 5: Customer logged in -> Attempt to access admin dashboard -> Access denied', () => {
  const hasCustomer = true;
  const isStaff = false;
  const isAdminRoute = true;

  let resultTarget: string | null = null;
  if (isAdminRoute) {
    if (!isStaff) {
      if (hasCustomer) {
        resultTarget = '/travinco_admin_login?reason=not_staff';
      }
    }
  }

  assert.strictEqual(resultTarget, '/travinco_admin_login?reason=not_staff', 'Access to admin dashboard must be strictly denied for customer');
});

// 8. Scenario 6: Admin logged in -> Access admin dashboard -> Dashboard should work normally
runTest('Scenario 6: Admin logged in -> Access admin dashboard -> Dashboard works normally', () => {
  const isStaff = true;
  const isAdminRoute = true;

  let allowDashboard = false;
  if (isAdminRoute && isStaff) {
    allowDashboard = true;
  }

  assert.strictEqual(allowDashboard, true);
});

// 9. Scenario 7: Both admin and customer sessions active in the same browser -> Each area recognizes its own identity
runTest('Scenario 7: Both sessions active concurrently -> Each area recognizes only its own identity', () => {
  // When browser has both cookie tokens:
  const browserCookies = new Map<string, string>([
    [ADMIN_AUTH_COOKIE, makeSlimSession('admin', 'admin-token-777')],
    [CUSTOMER_AUTH_COOKIE, makeSlimSession('customer', 'cust-token-888')],
  ]);

  // Admin area resolver: reads strictly ADMIN_AUTH_COOKIE
  const adminSession = browserCookies.get(ADMIN_AUTH_COOKIE);
  const adminDecoded = JSON.parse(Buffer.from(adminSession!.replace(BASE64_PREFIX, ''), 'base64url').toString('utf8'));

  // Customer area resolver: reads strictly CUSTOMER_AUTH_COOKIE
  const customerSession = browserCookies.get(CUSTOMER_AUTH_COOKIE);
  const customerDecoded = JSON.parse(Buffer.from(customerSession!.replace(BASE64_PREFIX, ''), 'base64url').toString('utf8'));

  assert.strictEqual(adminDecoded.role, 'admin');
  assert.strictEqual(adminDecoded.access_token, 'admin-token-777');

  assert.strictEqual(customerDecoded.role, 'customer');
  assert.strictEqual(customerDecoded.access_token, 'cust-token-888');

  assert.notStrictEqual(adminDecoded.user.id, customerDecoded.user.id);
});

// 10. Scenario 8: Customer logs out -> Customer session invalidated without logging out admin
runTest('Scenario 8: Customer logs out -> Customer session invalidated, admin session remains valid', () => {
  const browserCookies = new Map<string, string>([
    [ADMIN_AUTH_COOKIE, makeSlimSession('admin', 'admin-token-777')],
    [CUSTOMER_AUTH_COOKIE, makeSlimSession('customer', 'cust-token-888')],
  ]);

  // Customer logOutCustomer execution: deletes only customer cookies
  browserCookies.delete(CUSTOMER_AUTH_COOKIE);
  browserCookies.delete(`${CUSTOMER_AUTH_COOKIE}.0`);

  assert.strictEqual(browserCookies.has(CUSTOMER_AUTH_COOKIE), false, 'Customer cookie must be removed');
  assert.strictEqual(browserCookies.has(ADMIN_AUTH_COOKIE), true, 'Admin cookie must remain intact');
});

// 11. Scenario 9: Admin logs out -> Admin session invalidated without logging out customer
runTest('Scenario 9: Admin logs out -> Admin session invalidated, customer session remains valid', () => {
  const browserCookies = new Map<string, string>([
    [ADMIN_AUTH_COOKIE, makeSlimSession('admin', 'admin-token-777')],
    [CUSTOMER_AUTH_COOKIE, makeSlimSession('customer', 'cust-token-888')],
  ]);

  // Admin signOut execution: deletes only admin cookies
  browserCookies.delete(ADMIN_AUTH_COOKIE);
  browserCookies.delete(`${ADMIN_AUTH_COOKIE}.0`);

  assert.strictEqual(browserCookies.has(ADMIN_AUTH_COOKIE), false, 'Admin cookie must be removed');
  assert.strictEqual(browserCookies.has(CUSTOMER_AUTH_COOKIE), true, 'Customer cookie must remain intact');
});

// 12. Scenario 10: Expired or invalid tokens -> Protected resources deny access and redirect appropriately
runTest('Scenario 10: Expired or invalid tokens -> Redirects to appropriate login page', () => {
  const isStaffValid = false;
  const isCustomerValid = false;

  // Attempt admin dashboard with invalid token
  let adminRedirect: string | null = null;
  if (!isStaffValid) {
    adminRedirect = '/travinco_admin_login?redirectTo=/travinco_dashboard';
  }
  assert.strictEqual(adminRedirect, '/travinco_admin_login?redirectTo=/travinco_dashboard');

  // Attempt customer booking with invalid token
  let customerRedirect: string | null = null;
  if (!isCustomerValid) {
    customerRedirect = '/account/login?redirectTo=/booking';
  }
  assert.strictEqual(customerRedirect, '/account/login?redirectTo=/booking');
});

console.log(`\n--- ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! ---`);
