import { requireProfile } from '@/lib/supabase/auth-helpers';
import { DestinationForm } from '../destination-form';

export default async function NewDestinationPage() {
  await requireProfile();
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">New destination</h1>
      <DestinationForm />
    </div>
  );
}
