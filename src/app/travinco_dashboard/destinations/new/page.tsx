import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { DestinationForm } from '../destination-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewDestinationPage() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'destinations', 'edit');
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/travinco_dashboard/destinations"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-700 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to destinations</span>
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">New destination</h1>
      </div>
      <DestinationForm />
    </div>
  );
}
