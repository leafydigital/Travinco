import { Suspense } from 'react';
import { requireProfile, hasPageAccess, getStaffPermissions } from '@/lib/supabase/auth-helpers';
import { navForProfile } from '@/lib/admin-nav';
import { redirect } from 'next/navigation';
import {
  EnquiryStatsSection,
  FinancialOverviewSection,
  TopSellingPackagesSection,
  SectionSkeleton,
  monthInfo,
} from './dashboard-sections';
import { MonthPicker } from './month-picker';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: { error?: string; month?: string };
}) {
  const profile = await requireProfile();

  // If staff member does not have dashboard access and visits /travinco_dashboard directly, redirect to first allowed page
  const canViewDashboard = await hasPageAccess(profile, 'dashboard');
  if (!canViewDashboard) {
    const permissions = await getStaffPermissions(profile.id);
    const navSections = navForProfile(profile, permissions);
    const firstItem = navSections[0]?.items[0];
    if (firstItem && firstItem.href !== '/travinco_dashboard') {
      redirect(firstItem.href);
    }
    redirect('/app?reason=forbidden');
  }

  // ?month=YYYY-MM picks the month every section shows (defaults to this month)
  const month = monthInfo(searchParams?.month);
  const thisMonth = monthInfo().key;

  // Each section fetches its own data behind a Suspense boundary, so the shell
  // renders immediately and sections stream in as their queries finish.
  return (
    <div className="space-y-8">
      {searchParams?.error === 'forbidden' && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm"
        >
          <span className="font-semibold">Access restricted:</span> Your account role does not have permission to access that section.
        </div>
      )}

      {/* Welcome Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            Welcome back, {profile.full_name.split(' ')[0]}
          </h1>
          <p className="text-sm text-ink-500">
            Enquiries, income &amp; expense and top packages for {month.name}.
          </p>
        </div>
        <MonthPicker value={month.key} currentMonth={thisMonth} />
      </div>

      <Suspense key={`enq-${month.key}`} fallback={<SectionSkeleton variant="cards4" />}>
        <EnquiryStatsSection month={month} />
      </Suspense>

      <Suspense key={`fin-${month.key}`} fallback={<SectionSkeleton variant="cards2" />}>
        <FinancialOverviewSection month={month} />
      </Suspense>

      <Suspense key={`pkg-${month.key}`} fallback={<SectionSkeleton variant="chart" />}>
        <TopSellingPackagesSection month={month} />
      </Suspense>
    </div>
  );
}
