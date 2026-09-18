import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { OfferForm } from '../offer-form';

export default async function NewOfferPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data: packages } = await supabase
    .from('travel_packages')
    .select('id, title, base_price, currency')
    .order('title');

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">New offer</h1>
      <OfferForm packages={packages ?? []} />
    </div>
  );
}
