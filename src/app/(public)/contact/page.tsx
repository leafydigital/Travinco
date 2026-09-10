import type { Metadata } from 'next';
import { getGeneralSettings } from '@/lib/settings';
import { ContactForm } from './contact-form';
import { Phone, Mail, MapPin, Clock, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Get in touch to plan your next trip — phone, WhatsApp, email, or the form below.',
};

export default async function ContactPage() {
  const settings = await getGeneralSettings();

  return (
    <div className="container-page py-14">
      <div className="mb-10 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">Contact us</h1>
        <p className="mt-3 text-ink-600">Tell us where you want to go, and we&apos;ll take it from there.</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          {settings.phone && (
            <a href={`tel:${settings.phone}`} className="flex items-center gap-3 text-ink-700 hover:text-brand-700">
              <Phone className="h-5 w-5 text-brand-600" /> {settings.phone}
            </a>
          )}
          {settings.whatsapp && (
            <a
              href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-ink-700 hover:text-brand-700"
            >
              <MessageCircle className="h-5 w-5 text-brand-600" /> {settings.whatsapp}
            </a>
          )}
          {settings.email && (
            <a href={`mailto:${settings.email}`} className="flex items-center gap-3 text-ink-700 hover:text-brand-700">
              <Mail className="h-5 w-5 text-brand-600" /> {settings.email}
            </a>
          )}
          {settings.address && (
            <div className="flex items-start gap-3 text-ink-700">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /> {settings.address}
            </div>
          )}
          {settings.working_hours && (
            <div className="flex items-start gap-3 text-ink-700">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /> {settings.working_hours}
            </div>
          )}

          {settings.map_embed_url && (
            <div className="overflow-hidden rounded-xl2 border border-ink-100">
              <iframe
                src={settings.map_embed_url}
                width="100%"
                height="220"
                style={{ border: 0 }}
                loading="lazy"
                title="Office location map"
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="card p-6">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
