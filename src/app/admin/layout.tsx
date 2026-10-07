import { requireProfile } from '@/lib/supabase/auth-helpers';
import { navForProfile } from '@/lib/admin-nav';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { createClient } from '@/lib/supabase/server';

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Load granular module permission overrides for this profile
  const { data: permissions } = await supabase
    .from('staff_permissions')
    .select('*')
    .eq('profile_id', profile.id);

  const sections = navForProfile(profile, permissions ?? []);

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
