import type { Metadata } from 'next';
import { getGeneralSettings } from '@/lib/settings';
import { getPageTitlesContent } from '@/lib/page-titles-content';
import { getContactPageContent } from '@/lib/contact-page-content';
import { ContactForm } from './contact-form';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageCircle,
  ShieldCheck,
  Compass,
  Sparkles,
  Headphones,
  CheckCircle2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const [titlesContent, contactContent] = await Promise.all([
    getPageTitlesContent(),
    getContactPageContent(),
  ]);
  const title =
    titlesContent.titles?.contact ||
    contactContent.hero?.title ||
    'Contact Us | Travinco';
  return {
    title: { absolute: title },
    description:
      contactContent.hero?.subtitle ||
      'Get in touch to plan your next trip — phone, WhatsApp, email, or the form below.',
  };
}

const PILLAR_ICON_MAP = {
  clock: Clock,
  compass: Compass,
  message: MessageCircle,
  phone: Phone,
  shield: ShieldCheck,
  sparkles: Sparkles,
};

export default async function ContactPage() {
  const [settings, contactContent] = await Promise.all([
    getGeneralSettings(),
    getContactPageContent(),
  ]);

  const { hero } = contactContent;

  // Admin-configured contact details with fallback to general settings
  const displayPhone = contactContent.phone?.trim() || settings.phone;
  const displayEmail = contactContent.email?.trim() || settings.email;

  return (
    <div className="min-h-screen bg-sand-50/40">
      {/* ── 1. Top Hero Section with Atmospheric Background & Centered Text ── */}
      <section className="relative overflow-hidden bg-navy-950 text-white pt-36 pb-20 sm:pt-44 sm:pb-28">
        {/* Hero Background Image with Atmospheric Gradient Overlay */}
        {hero.background_image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 scale-100"
            style={{ backgroundImage: `url(${hero.background_image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950/95 backdrop-blur-[1px]" />
          </div>
        )}

        {/* Ambient Luxury Glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="container-page relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
            {hero.badge && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wider uppercase text-sand-300 border border-white/20 backdrop-blur-md mb-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span>{hero.badge}</span>
              </span>
            )}

            <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold uppercase text-white tracking-tight drop-shadow-md animate-in fade-in slide-in-from-bottom-3 duration-500">
              {hero.title || 'CONTACT US'}
            </h1>

            {hero.subtitle && (
              <p className="mt-4 text-base sm:text-lg text-white/85 font-light leading-relaxed max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                {hero.subtitle}
              </p>
            )}

            {/* Highlights / Trust Pillars */}
            {hero.pillars && hero.pillars.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs sm:text-sm text-white/85 font-medium animate-in fade-in slide-in-from-bottom-5 duration-700">
                {hero.pillars.map((pillar, i) => {
                  const PillarIcon =
                    (pillar.icon_key && PILLAR_ICON_MAP[pillar.icon_key]) || Clock;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <PillarIcon className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{pillar.label}</span>
                      {i < hero.pillars.length - 1 && (
                        <span className="ml-4 text-white/25 hidden sm:inline">•</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 2. Redesigned Contact Contents (Responsive Grid) ── */}
      <section className="container-page py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Direct Assistance & Contact Cards (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Header info */}
            <div>
              {contactContent.info_badge && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200 mb-2">
                  <Headphones className="h-3.5 w-3.5" />
                  {contactContent.info_badge}
                </span>
              )}
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-950">
                {contactContent.info_title || 'Speak with our travel specialists'}
              </h2>
              {contactContent.info_subtitle && (
                <p className="mt-2 text-sm text-ink-600 leading-relaxed">
                  {contactContent.info_subtitle}
                </p>
              )}
            </div>

            {/* Contact Action Cards */}
            <div className="space-y-3.5">
              {/* Phone Card — static, no link */}
              {displayPhone && (
                <div className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-ink-150/80 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-400">
                      Phone Support
                    </span>
                    <p className="mt-1 text-base sm:text-lg font-bold text-ink-950 truncate">
                      {displayPhone}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Direct line to our destination concierge
                    </p>
                  </div>
                </div>
              )}

              {/* WhatsApp Card */}
              {settings.whatsapp && (
                <a
                  href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-ink-150/80 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-400">
                        WhatsApp Concierge
                      </span>
                      <span className="text-xs font-semibold text-emerald-600">
                        Chat now
                      </span>
                    </div>
                    <p className="mt-1 text-base sm:text-lg font-bold text-ink-950 truncate">
                      {settings.whatsapp}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Instant messaging &amp; fast itinerary replies
                    </p>
                  </div>
                </a>
              )}

              {/* Email Card — static, no link */}
              {displayEmail && (
                <div className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-ink-150/80 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-400">
                      Email Inquiries
                    </span>
                    <p className="mt-1 text-sm sm:text-base font-bold text-ink-950 break-all">
                      {displayEmail}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Detailed travel plans, corporate RFPs &amp; custom retreats
                    </p>
                  </div>
                </div>
              )}

              {/* Office Address Card */}
              {settings.address && (
                <div className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-ink-150/80 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-400">
                      Concierge Office
                    </span>
                    <p className="mt-1 text-sm font-semibold text-ink-900 leading-relaxed">
                      {settings.address}
                    </p>
                  </div>
                </div>
              )}

              {/* Working Hours Card */}
              {settings.working_hours && (
                <div className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-ink-150/80 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-400">
                      Working Hours
                    </span>
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      {settings.working_hours}
                    </p>
                  </div>
                </div>
              )}

              {/* Interactive Google Map Card */}
              {settings.map_embed_url && (
                <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
                  <div className="px-4 py-3 bg-ink-50/80 border-b border-ink-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-700 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-brand-600" />
                      Find Us on the Map
                    </span>
                    <span className="text-[11px] text-ink-400">Interactive Location</span>
                  </div>
                  <iframe
                    src={settings.map_embed_url}
                    width="100%"
                    height="240"
                    style={{ border: 0 }}
                    loading="lazy"
                    title="Office location map"
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Elevated Inquiry Form Card (lg:col-span-7) */}
          <div className="lg:col-span-7">
            <div className="relative rounded-2xl sm:rounded-3xl border border-ink-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xl shadow-ink-950/5">
              {/* Card top decorative accent line */}
              <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-brand-500 via-emerald-500 to-brand-600 rounded-b-full" />

              {/* Card Header */}
              <div className="mb-6">
                {contactContent.form_badge && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 mb-2">
                    {contactContent.form_badge}
                  </span>
                )}
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink-950">
                  {contactContent.form_title || 'Plan Your Next Journey With Us'}
                </h3>
                {contactContent.form_subtitle && (
                  <p className="mt-2 text-sm text-ink-600 leading-relaxed">
                    {contactContent.form_subtitle}
                  </p>
                )}
              </div>

              {/* Value guarantees */}
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pb-6 border-b border-ink-100">
                <div className="flex items-center gap-2 text-xs font-medium text-ink-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Custom Tailored</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-ink-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Zero Obligation</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-ink-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Confidential &amp; Direct</span>
                </div>
              </div>

              {/* Contact Form */}
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
