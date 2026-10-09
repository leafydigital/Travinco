import { requireProfile, getStaffPermissions } from '@/lib/supabase/auth-helpers';
import { navForProfile } from '@/lib/admin-nav';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminNavProgress } from '@/components/admin/admin-nav-progress';

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireProfile() and getStaffPermissions() are both wrapped in React cache(),
  // so if any child Server Component calls requireProfile() in the same render
  // pass, no extra DB round-trip is made. The staff_permissions query runs once
  // per render instead of once per layout re-render.
  const profile = await requireProfile();
  const permissions = await getStaffPermissions(profile.id);

  const sections = navForProfile(profile, permissions);

  return (
    <div className="flex min-h-screen bg-ink-50 print:block print:bg-white">
      <AdminNavProgress />
      <AdminSidebar
        sections={sections}
        userName={profile.full_name}
        userRole={profile.role}
      />
      <div className="flex-1 overflow-x-hidden">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
