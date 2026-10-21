import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { BulkPackagesEditor } from './bulk-packages-editor';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Bulk create packages — Admin Portal' };

export default async function BulkPackagesPage() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'packages', 'edit');
  const supabase = await createClient();
  const { data: destinations } = await supabase
    .from('destinations')
    .select('id, name')
    .order('name');

  return (
    <div className="space-y-6 pb-20">
      <div>
        <Link
          href="/travinco_dashboard/packages"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-700 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to packages</span>
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              Bulk Create Packages
            </h1>
            <p className="text-sm text-ink-500 max-w-2xl leading-relaxed mt-1">
              Add and configure multiple tour packages simultaneously with complete itineraries, pricing, highlights, inclusions, exclusions, FAQs, and SEO.
            </p>
          </div>
          <Link
            href="/travinco_dashboard/packages/new"
            className="btn-outline inline-flex items-center gap-2 text-xs"
          >
            <span>Single package mode</span>
          </Link>
        </div>
      </div>

      <BulkPackagesEditor destinations={destinations ?? []} />
    </div>
  );
}
