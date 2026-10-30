import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCustomer } from '@/lib/supabase/customer-auth-helpers';
import { getCustomerDashboardData } from '@/lib/services/customer-account';
import { BookingsView } from './bookings-view';

export const metadata: Metadata = {
  title: 'My Bookings — Travinco',
  description: 'View your tour invoices and the status of your trip enquiries.',
};

export default async function BookingsPage() {
  const account = await requireCustomer('/account/bookings');
  const data = await getCustomerDashboardData(account.email);

  return (
    <div className="min-h-screen bg-sand-50/40">
      {/* ── 1. Top Hero Section ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy-950 text-white pt-36 pb-16 sm:pt-40 sm:pb-20">
        {/* Background Visual Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950" />
        </div>

        {/* Subtle Ambient Glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="container-page relative z-10 mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          <Link
            href="/account"
            className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-sand-200 transition hover:bg-white/20 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Account
          </Link>

          <span className="inline-flex items-center rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wider uppercase text-sand-300 border border-white/20 backdrop-blur-md mb-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            Customer Portal • Invoices &amp; Enquiries
          </span>

          <h1 className="font-display text-3xl sm:text-5xl font-bold uppercase text-white tracking-tight drop-shadow-md animate-in fade-in slide-in-from-bottom-3 duration-500">
            My Bookings
          </h1>

          <p className="mt-3 text-sm sm:text-base text-white/85 font-light leading-relaxed max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            Download your official tour invoices and follow the status of your trip enquiries, all in one place.
          </p>
        </div>
      </section>

      {/* ── 2. Content Section Below Hero ───────────────────────────────── */}
      <section className="pt-10 pb-20 px-4 sm:px-6 relative z-10">
        <div className="mx-auto max-w-5xl">
          <BookingsView data={data} />
        </div>
      </section>
    </div>
  );
}
