import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { LeadsFilterBar } from './leads-filter-bar';
import { LeadsTable, type LeadItem } from './leads-table';
import { UploadExcelButton } from './upload-excel-button';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Leads — Travinco Admin' };

interface PageProps {
  searchParams: {
    q?: string;
    status?: string;
    page?: string;
    limit?: string;
  };
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const profile = await requireProfile();
  const isAdmin = ['admin', 'super_admin'].includes(profile.role);
  const supabase = await createClient();

  const currentPage = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Math.max(10, Math.min(100, Number(searchParams.limit ?? 25)));
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  // Fetch filtered & paginated leads (excluding soft-deleted)
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams.q) {
    const q = searchParams.q.trim();
    query = query.or(
      `contact_name.ilike.%${q}%,contact_number.ilike.%${q}%,email.ilike.%${q}%,package.ilike.%${q}%`
    );
  }

  if (searchParams.status) {
    query = query.eq('status', searchParams.status as any);
  }

  const { data: leadsData, count: filteredCount, error } = await query;

  if (error) {
    console.error('Leads query error:', error);
  }

  const leads: LeadItem[] = (leadsData ?? []).map((row: any) => ({
    id: row.id,
    contact_name: row.contact_name,
    contact_number: row.contact_number,
    email: row.email,
    package: row.package,
    number_of_days: row.number_of_days,
    budget: row.budget ? Number(row.budget) : null,
    from_date: row.from_date,
    to_date: row.to_date,
    number_of_people: row.number_of_people,
    status: row.status,
    created_at: row.created_at,
  }));

  return (
    <div className="space-y-5">
      {/* Page Title & Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 tracking-tight">Leads</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            Track customer enquiries, import spreadsheet records, and manage conversion pipelines
          </p>
        </div>
        <UploadExcelButton />
      </div>

      {/* Instant Search, Status Dropdown Filter & Page Size Selector */}
      <LeadsFilterBar
        initialSearch={searchParams.q ?? ''}
        initialStatus={searchParams.status ?? ''}
        initialLimit={pageSize}
      />

      {/* Leads Table with Checkbox Row Selection & Interactive Pagination */}
      <LeadsTable
        leads={leads}
        totalCount={filteredCount ?? 0}
        currentPage={currentPage}
        pageSize={pageSize}
        isAdmin={isAdmin}
      />
    </div>
  );
}
