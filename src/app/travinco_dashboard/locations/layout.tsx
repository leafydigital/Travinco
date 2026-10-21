import { requireProfile, assertPageAccess } from '@/lib/supabase/auth-helpers';
import { assertTourAccess } from '@/lib/tour/access';
import { LocationTabs } from './tabs';

export default async function LocationsLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'locations');
  assertTourAccess(profile, 'masters');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Locations &amp; Activities</h1>
        <p className="text-sm text-ink-500">
          Places, the sightseeing and activities in each, and travel distances used in tour quotations.
        </p>
      </div>
      <LocationTabs />
      {children}
    </div>
  );
}
