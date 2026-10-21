import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import Link from 'next/link';
import { Search, Plus } from 'lucide-react';
import { CustomerRowActions } from './customer-row-actions';

const PAGE_SIZE = 25;

function buildHref(sp: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
  return `?${params.toString()}`;
}

function CustomersTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="px-5 py-3">Customer</th>
            <th className="px-5 py-3">Phone</th>
            <th className="px-5 py-3">Email</th>
            <th className="px-5 py-3">City</th>
            <th className="px-5 py-3">Source</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-5 py-3.5"><div className="h-4 w-32 rounded bg-ink-200/70" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-24 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-36 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-20 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-16 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-6 w-16 rounded-full bg-ink-100" /></td>
              <td className="px-5 py-3.5 text-right"><div className="h-8 w-24 rounded-lg bg-ink-100 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function CustomersTableContent({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'customers', 'view');
  const isAdmin = ['admin', 'super_admin'].includes(profile.role);
  const canEdit = isAdmin || profile.role === 'sales_staff';
  const supabase = await createClient();

  // Sync any customer_accounts that haven't been copied to customers yet
  try {
    const { data: unlinkedAccounts } = await supabase
      .from('customer_accounts')
      .select('full_name, email, created_at');

    if (unlinkedAccounts && unlinkedAccounts.length > 0) {
      const emails = unlinkedAccounts.map((a) => a.email).filter(Boolean);
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('email')
        .in('email', emails);

      const existingEmails = new Set((existingCustomers || []).map((c) => c.email));
      const toInsert = unlinkedAccounts
        .filter((a) => a.email && !existingEmails.has(a.email))
        .map((a) => ({
          full_name: a.full_name || a.email.split('@')[0] || 'Customer',
          email: a.email,
          phone: '',
          source: 'website',
          is_active: true,
          is_deleted: false,
          created_at: a.created_at,
        }));

      if (toInsert.length > 0) {
        await supabase.from('customers').insert(toInsert as any);
      }
    }
  } catch {
    // Non-blocking sync
  }

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('customers')
    .select(
      'id, full_name, phone, whatsapp_number, email, city, state, country, source, notes, whatsapp_opt_in, is_active, is_deleted, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams.q) {
    query = query.or(
      `full_name.ilike.%${searchParams.q}%,phone.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%`
    );
  }

  const [{ data: customers, count, error: queryError }, { data: settingsData }] = await Promise.all([
    query,
    supabase
      .from('website_settings')
      .select('key, value')
      .or('key.like.deleted_customer_%,key.like.customer_status_%'),
  ]);

  let customerRows: any[] | null = customers;
  if (queryError && (queryError.message?.includes('is_deleted') || queryError.message?.includes('is_active'))) {
    let fallbackQuery = supabase
      .from('customers')
      .select('id, full_name, phone, whatsapp_number, email, city, state, country, source, notes, whatsapp_opt_in, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (searchParams.q) {
      fallbackQuery = fallbackQuery.or(
        `full_name.ilike.%${searchParams.q}%,phone.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%`
      );
    }
    const fallbackRes = await fallbackQuery;
    customerRows = fallbackRes.data;
  }

  const deletedKeys = new Set(
    (settingsData || [])
      .filter((s: any) => s.key?.startsWith('deleted_customer_'))
      .map((s: any) => s.key.replace('deleted_customer_', ''))
  );
  const statusOverrides = new Map<string, boolean>();
  (settingsData || [])
    .filter((s: any) => s.key?.startsWith('customer_status_'))
    .forEach((s: any) => {
      const id = s.key.replace('customer_status_', '');
      if (s.value && typeof s.value.is_active === 'boolean') {
        statusOverrides.set(id, s.value.is_active);
      }
    });

  const visibleCustomers = (customerRows ?? []).filter(
    (c: any) =>
      c &&
      c.is_deleted !== true &&
      c.is_deleted !== 'true' &&
      c.is_deleted !== 1 &&
      !deletedKeys.has(c.id)
  );
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">City</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleCustomers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-400">
                  No customers found.
                </td>
              </tr>
            )}
            {visibleCustomers.map((c) => {
              const isActive = statusOverrides.has(c.id)
                ? statusOverrides.get(c.id)!
                : c.is_active !== false && c.is_active !== 'false' && (c as any).status !== 'inactive';

              return (
                <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-ink-800 hover:text-brand-700">
                      {c.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-600">{c.phone || '—'}</td>
                  <td className="px-5 py-3 text-ink-500">{c.email || '—'}</td>
                  <td className="px-5 py-3 text-ink-500">{c.city || '—'}</td>
                  <td className="px-5 py-3 text-ink-500 capitalize">{c.source?.replace('_', ' ') || '—'}</td>
                  <td className="px-5 py-3">
                    {isActive ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-800 border-amber-200">Deactivated</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <CustomerRowActions
                      customer={c}
                      isActive={isActive}
                      canEdit={canEdit}
                      isAdmin={isAdmin}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
          <span>Page {page} of {totalPages} ({count ?? 0} total)</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref(searchParams, { page: String(page - 1) })} className="btn-outline px-3 py-1.5">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildHref(searchParams, { page: String(page + 1) })} className="btn-outline px-3 py-1.5">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'customers', 'view');

  const suspKey = `${searchParams.q ?? ''}-${searchParams.page ?? '1'}`;

  return (
    <div className="space-y-5">
      {/* 1. Header Structure (Renders Instantly) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Customers</h1>
          <p className="text-sm text-ink-500">Directory of travel customers and leads</p>
        </div>
        <Link href="/admin/customers/new" prefetch={true} className="btn-primary">
          <Plus className="h-4 w-4" /> New customer
        </Link>
      </div>

      {/* 2. Filter Form Structure (Renders Instantly) */}
      <form className="flex flex-wrap sm:flex-nowrap items-center gap-3" method="get">
        <div className="relative flex-1 min-w-[200px] sm:min-w-[220px] max-w-md w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search by name, phone, or email…"
            className="input pl-9 w-full"
          />
        </div>
        <button type="submit" className="btn-outline w-full sm:w-auto">
          Search
        </button>
      </form>

      {/* 3. Table Card (Header loads immediately, rows show skeleton only while fetching) */}
      <div className="card overflow-hidden">
        <Suspense key={suspKey} fallback={<CustomersTableSkeleton />}>
          <CustomersTableContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
