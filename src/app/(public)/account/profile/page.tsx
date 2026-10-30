import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCustomerProfile } from '../actions';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = {
  title: 'My Profile — Travinco',
  description: 'View and update your Travinco account details.',
};

export default async function ProfilePage() {
  // getCustomerProfile() enforces a signed-in, active customer
  const profile = await getCustomerProfile();

  return (
    <div className="min-h-screen bg-sand-50/40">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy-950 pb-16 pt-36 text-white sm:pb-20 sm:pt-40">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25"
          style={{ backgroundImage: "url('/images/kerala-ayurveda-wellness.jpg')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950" />
        </div>
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="container-page relative z-10 mx-auto flex flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <Link
            href="/account"
            className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-sand-200 transition hover:bg-white/20 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Account
          </Link>
          <span className="mb-4 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-sand-300 backdrop-blur-md">
            Customer Portal • Profile
          </span>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-white drop-shadow-md sm:text-5xl">
            My Profile
          </h1>
          <p className="mt-3 max-w-xl text-sm font-light leading-relaxed text-white/85 sm:text-base">
            Keep your contact details up to date so our travel experts can reach you about your trips.
          </p>
        </div>
      </section>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 pt-10 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <ProfileForm initial={profile} />
        </div>
      </section>
    </div>
  );
}
