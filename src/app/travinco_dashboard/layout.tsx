import { requireProfile, getStaffPermissions } from '@/lib/supabase/auth-helpers';
import { navForProfile } from '@/lib/admin-nav';
import { SaveConfirmationProvider } from '@/components/admin/save-confirmation-provider';
import { AdminDashboardLayout } from '@/components/admin/admin-dashboard-layout';

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
    <SaveConfirmationProvider>
      <AdminDashboardLayout
        sections={sections}
        userName={profile.full_name}
        userRole={profile.role}
        userEmail={profile.email}
      >
        {children}
      </AdminDashboardLayout>
    </SaveConfirmationProvider>
  );
}
