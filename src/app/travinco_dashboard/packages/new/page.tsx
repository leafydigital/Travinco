import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { PackageForm } from '../package-form';
import { getDestinationOptions } from '../destination-options';
import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';

export const metadata = { title: 'New package' };

export default async function NewPackagePage() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'packages', 'edit');
  const supabase = await createClient();
  const destinations = await getDestinationOptions(supabase);

  return (
    <PackageForm
      destinations={destinations ?? []}
      header={
        <div>
          <Link
            href="/travinco_dashboard/packages"
            className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-700 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to packages</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-ink-900">New package</h1>
            <Link
              href="/travinco_dashboard/packages/bulk"
              className="btn-outline inline-flex items-center gap-2 px-2.5 py-1 text-xs shadow-2xs hover:shadow-xs transition"
            >
              <Layers className="h-3.5 w-3.5 text-brand-600" />
              <span>Switch to Bulk create</span>
            </Link>
          </div>
        </div>
      }
    />
  );
}
