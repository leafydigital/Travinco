import { requireProfile } from '@/lib/supabase/auth-helpers';
import { navForRole } from '@/lib/admin-nav';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects to /login if not authenticated or the account is deactivated.
  // Middleware already blocks unauthenticated requests to /admin/**, so
  // this call mainly fetches the profile row we need for role-based nav —
  // but keeping the check here too means this layout is safe even if it's
  // ever reached by a path middleware doesn't cover.
  const profile = await requireProfile();
  const sections = navForRole(profile.role);

  return (
    <div className="flex min-h-screen bg-ink-50">
      <AdminSidebar
        sections={sections}
        userName={profile.full_name}
        userRole={profile.role}
      />
      <div className="flex-1 overflow-x-hidden">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
