import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  Compass,
  Users,
  ShieldCheck,
  Heart,
  Star,
  Award,
  ArrowRight,
  CheckCircle2,
  Globe,
  Check,
} from 'lucide-react';
import { getAboutPageContent } from '@/lib/about-page-content';
import { getGeneralSettings } from '@/lib/settings';
import { AboutFaqAccordion } from '@/components/public/about-faq-accordion';

import { getPageTitlesContent } from '@/lib/page-titles-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const [content, titlesContent] = await Promise.all([
    getAboutPageContent(),
    getPageTitlesContent(),
  ]);
  const title = titlesContent.titles?.about || content.hero.title || 'About Us | Travinco';
  return {
    title: { absolute: title },
    description:
      content.hero.subtitle ||
      'How we plan trips, and why travelers keep coming back to Travinco.',
  };
}

const ICON_MAP = {
  compass: Compass,
  users: Users,
  shield: ShieldCheck,
  heart: Heart,
  sparkles: Award,
  star: Star,
  globe: Globe,
};

export default async function AboutPage() {
  const [content, generalSettings] = await Promise.all([
    getAboutPageContent(),
    getGeneralSettings(),
  ]);

  const { hero, story, overview_cards, faqs, bottom_cta } = content;

  return (
    <div className="min-h-screen bg-sand-50/30">
      {/* ── 1. Top Hero Section with Atmospheric Background & Centered Text ── */}
      <section className="relative overflow-hidden bg-navy-950 text-white pt-36 pb-20 sm:pt-44 sm:pb-28">
        {/* Hero Background Image */}
        {hero.background_image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 scale-100"
            style={{ backgroundImage: `url(${hero.background_image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950/95 backdrop-blur-[1px]" />
          </div>
        )}

        {/* Ambient Glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="container-page relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
            {hero.badge && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wider uppercase text-sand-300 border border-white/20 backdrop-blur-md mb-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span>{hero.badge}</span>
              </span>
            )}

            <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold uppercase text-white tracking-tight drop-shadow-md animate-in fade-in slide-in-from-bottom-3 duration-500">
              {hero.title || `ABOUT ${generalSettings?.business_name ?? 'TRAVINCO'}`}
            </h1>

            {hero.subtitle && (
              <p className="mt-4 text-base sm:text-lg text-white/85 font-light leading-relaxed max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                {hero.subtitle}
              </p>
            )}

            {/* Highlights / Trust Pillars */}
            {hero.pillars && hero.pillars.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs sm:text-sm text-white/80 font-medium">
                {hero.pillars.map((pillar, i) => {
                  const PillarIcon =
                    (pillar.icon_key && ICON_MAP[pillar.icon_key]) || ShieldCheck;
                  return (
                    <div key={i} className="flex items-center gap-1.5">
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

      {/* ── 2. Our Story / Heritage Section ── */}
      <section className="py-16 sm:py-24">
        <div className="container-page mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Story Text */}
            <div className="lg:col-span-7 space-y-6">
              {story.badge && (
                <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
                  <span>{story.badge}</span>
                </span>
              )}

              <h2 className="font-display text-2xl sm:text-4xl font-bold text-ink-950 leading-tight">
                {story.title}
              </h2>

              <p className="text-sm sm:text-base text-ink-700 leading-relaxed">
                {story.paragraph_1}
              </p>

              {story.paragraph_2 && (
                <p className="text-sm sm:text-base text-ink-600 leading-relaxed">
                  {story.paragraph_2}
                </p>
              )}
            </div>

            {/* Story Photo */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl overflow-hidden bg-ink-100 border border-ink-200/80 shadow-xl aspect-4/3 sm:aspect-square">
                {story.image_url && (
                  <Image
                    src={story.image_url}
                    alt={story.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/40 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Strategic Overview & Services (4 Cards, 2 per row) ── */}
      {overview_cards && overview_cards.length > 0 && (
        <section className="py-16 sm:py-24 bg-sand-50/70 border-t border-ink-100/80">
          <div className="container-page mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7 lg:gap-9">
              {overview_cards.map((card, i) => {
                const CardIcon =
                  card.icon_key === 'globe'
                    ? Globe
                    : card.icon_key === 'shield'
                    ? ShieldCheck
                    : card.icon_key === 'users'
                    ? Users
                    : Compass;

                return (
                  <div
                    key={i}
                    className="flex flex-col justify-between rounded-3xl bg-white p-7 sm:p-9 border border-ink-200/80 shadow-xs hover:shadow-xl hover:border-brand-300 transition-all duration-300 group"
                  >
                    <div>
                      {/* Card Icon & Index Indicator */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 border border-brand-200/80 text-brand-600 group-hover:scale-105 group-hover:bg-brand-600 group-hover:text-white transition-all duration-300 shadow-xs">
                          <CardIcon className="h-6 w-6 transition-colors" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400 bg-sand-100/70 px-3 py-1 rounded-full border border-sand-200">
                          {`0${i + 1}`}
                        </span>
                      </div>

                      {/* Heading */}
                      <h3 className="font-display text-xl sm:text-2xl font-bold text-ink-950 leading-snug tracking-tight">
                        {card.heading}
                      </h3>

                      {/* Main Text */}
                      <p className="mt-3.5 text-sm sm:text-base text-ink-600 leading-relaxed font-normal">
                        {card.text}
                      </p>

                      {/* Bullet points (if any) */}
                      {card.bullet_points && card.bullet_points.length > 0 && (
                        <div className="mt-6 pt-5 border-t border-ink-100/80 space-y-3.5">
                          {card.bullet_points.map((bullet, bIdx) => {
                            const colonIndex = bullet.indexOf(':');
                            const hasColon = colonIndex > 0;
                            const title = hasColon ? bullet.slice(0, colonIndex + 1) : '';
                            const body = hasColon ? bullet.slice(colonIndex + 1) : bullet;

                            return (
                              <div key={bIdx} className="flex items-start gap-3">
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shrink-0 mt-0.5 border border-emerald-200">
                                  <Check className="h-3 w-3 stroke-[2.5]" />
                                </div>
                                <p className="text-xs sm:text-sm text-ink-700 leading-relaxed">
                                  {hasColon ? (
                                    <>
                                      <strong className="font-bold text-ink-950">{title}</strong>
                                      <span>{body}</span>
                                    </>
                                  ) : (
                                    bullet
                                  )}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Frequently Asked Questions (Accordion Dropdowns) ── */}
      {faqs && (
        <section className="py-16 sm:py-24 bg-white border-t border-ink-100">
          <div className="container-page mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
              {faqs.badge && (
                <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-3.5 py-1 rounded-full border border-brand-200 mb-3 shadow-xs">
                  <span>{faqs.badge}</span>
                </span>
              )}
              <h2 className="font-display text-2xl sm:text-4xl font-bold text-ink-950 leading-tight">
                {faqs.title}
              </h2>
              {faqs.subtitle && (
                <p className="mt-3 text-xs sm:text-sm text-ink-600 leading-relaxed">
                  {faqs.subtitle}
                </p>
              )}
            </div>

            <AboutFaqAccordion items={faqs.items || []} />
          </div>
        </section>
      )}


      {/* ── 4. Bottom CTA Banner ── */}
      {bottom_cta && (
        <section className="py-16 sm:py-20">
          <div className="container-page mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-navy-950 text-white p-8 sm:p-12 lg:p-16 border border-white/10 shadow-2xl">
              {/* Background ambient lighting */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl">
                {bottom_cta.badge && (
                  <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sand-300 border border-white/20 mb-4 shadow-xs">
                    <span>{bottom_cta.badge}</span>
                  </span>
                )}

                <h2 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight">
                  {bottom_cta.title}
                </h2>

                {bottom_cta.description && (
                  <p className="mt-3 text-sm sm:text-base text-white/80 font-light leading-relaxed">
                    {bottom_cta.description}
                  </p>
                )}

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href={bottom_cta.button_link || '/booking'}
                    className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl shadow-lg cursor-pointer"
                  >
                    <span>{bottom_cta.button_text || 'Plan My Journey'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-white/90 hover:text-white px-4 py-3 rounded-xl border border-white/20 hover:bg-white/10 transition cursor-pointer"
                  >
                    <span>Contact Our Travel Concierge</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
