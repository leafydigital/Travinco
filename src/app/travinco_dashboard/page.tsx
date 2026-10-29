import { Suspense } from 'react';
import { requireProfile, hasPageAccess, getStaffPermissions } from '@/lib/supabase/auth-helpers';
import { navForProfile } from '@/lib/admin-nav';
import { redirect } from 'next/navigation';
import { Calendar } from 'lucide-react';
import {
  LeadsPipelineSection,
  FinancialOverviewSection,
  TopSellingPackagesSection,
  RecentEnquiriesSection,
  SectionSkeleton,
  currentMonthInfo,
} from './dashboard-sections';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: { error?: string };
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

  const { name: currentMonthName } = currentMonthInfo();

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
            Overview of your leads pipeline, monthly finances, and top performing packages.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-brand-600" />
            <span>{currentMonthName}</span>
          </div>
        </div>
      </div>

      <Suspense fallback={<SectionSkeleton variant="cards4" />}>
        <LeadsPipelineSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton variant="cards2" />}>
        <FinancialOverviewSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton variant="list" />}>
        <TopSellingPackagesSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton variant="list" />}>
        <RecentEnquiriesSection />
      </Suspense>
    </div>
  );
}
