import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { EnquiryForm } from '@/components/public/enquiry-form';

export const metadata: Metadata = {
  title: 'Plan your trip',
  description: 'Tell us what you have in mind and we will put together a tailored itinerary.',
};

export default async function BookingPage() {
  const supabase = await createClient();
  const { data: packages } = await supabase
    .from('travel_packages')
    .select('id, title')
    .eq('status', 'published')
    .order('title');

  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold text-ink-900">Plan your trip</h1>
          <p className="mt-3 text-ink-600">
            Share a few details and our team will reach out with a tailored itinerary and quote.
          </p>
        </div>

        <div className="card p-6">
          {packages && packages.length > 0 && (
            <p className="mb-3 text-xs text-ink-400">
              Have a specific package in mind? Mention it in your message, or browse{' '}
              <a href="/packages" className="text-brand-600 hover:underline">
                all packages
              </a>{' '}
              first.
            </p>
          )}
          <EnquiryForm buttonLabel="Request a quote" />
        </div>
      </div>
    </div>
  );
}
