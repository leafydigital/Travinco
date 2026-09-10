import { requireProfile } from '@/lib/supabase/auth-helpers';
import { EventForm } from '../event-form';

export default async function NewEventPage() {
  await requireProfile();
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">New event</h1>
      <EventForm />
    </div>
  );
}
