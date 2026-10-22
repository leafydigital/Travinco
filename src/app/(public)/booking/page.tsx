import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { EnquiryForm } from '@/components/public/enquiry-form';
import { requireCustomer } from '@/lib/supabase/customer-auth-helpers';
import { getPageTitlesContent } from '@/lib/page-titles-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const titlesContent = await getPageTitlesContent();
  const title = titlesContent.titles?.booking || 'Book with Us | Travinco';
  return {
    title: { absolute: title },
    description: 'Tell us what you have in mind and we will put together a tailored itinerary.',
  };
}

export default async function BookingPage() {
  // Enforces valid customer session; redirects unauthenticated visitors to customer login
  const customer = await requireCustomer('/booking');

  const supabase = await createClient();
  const { data: packages } = await supabase
    .from('travel_packages')
    .select('id, title')
    .eq('status', 'published')
    .order('title');

  return (
    <div className="min-h-screen bg-sand-50/40">
      {/* ── 1. Top Hero Section ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy-950 text-white pt-36 pb-16 sm:pt-40 sm:pb-20">
        {/* Background Visual Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=2000&q=80')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950" />
        </div>

        {/* Subtle Ambient Glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="container-page relative z-10 mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          <span className="inline-flex items-center rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wider uppercase text-sand-300 border border-white/20 backdrop-blur-md mb-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            Let&apos;s plan it together
          </span>

          <h1 className="font-display text-3xl sm:text-5xl font-bold uppercase text-white tracking-tight drop-shadow-md animate-in fade-in slide-in-from-bottom-3 duration-500">
            Book With Us
          </h1>

          <p className="mt-3 text-sm sm:text-base text-white/85 font-light leading-relaxed max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            Share a few details and our team will reach out with a tailored itinerary and quote.
          </p>
        </div>
      </section>

      {/* ── 2. Current Form Below Hero ─────────────────────────────────── */}
      <section className="pt-12 sm:pt-16 pb-20 px-4 sm:px-6 relative z-10">
        <div className="mx-auto max-w-xl">
          <div className="card border-t-4 border-t-emerald-500 p-6 sm:p-8 bg-white shadow-xl shadow-ink-900/5">
            {packages && packages.length > 0 && (
              <p className="mb-4 text-xs text-ink-400">
                Have a specific package in mind? Mention it in your message, or browse{' '}
                <a href="/packages" className="text-brand-600 hover:underline">
                  all packages
                </a>{' '}
                first.
              </p>
            )}

            <EnquiryForm
              buttonLabel="Request a quote"
              isLoggedIn={true}
              defaultName={customer.full_name || ''}
              defaultEmail={customer.email || ''}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
