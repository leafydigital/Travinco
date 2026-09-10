import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { PackageForm } from '../package-form';

export const metadata = { title: 'New package' };

export default async function NewPackagePage() {
  await requireProfile();
  const supabase = await createClient();
  const { data: destinations } = await supabase
    .from('destinations')
    .select('id, name')
    .order('name');

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">New package</h1>
        <p className="text-sm text-ink-500">
          Package is created as a draft. Itinerary, inclusions, exclusions and images can be
          added once it&apos;s saved.
        </p>
      </div>
      <PackageForm destinations={destinations ?? []} />
    </div>
  );
}
