import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';
import { getGeneralSettings } from '@/lib/settings';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getGeneralSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader whatsappNumber={settings.whatsapp} />
      {/*
        The header is `fixed`, not `sticky` — this avoids a blank-flash
        gap above the hero on first paint, since a `fixed` element never
        participates in document flow. The trade-off: every page's own
        content is now responsible for its own top spacing. The homepage
        hero is full-bleed by design (see src/app/(public)/page.tsx) and
        needs none; every other page/section already uses its own
        `py-*` utility for vertical spacing — those were written
        assuming a non-fixed header, so double check top spacing on any
        page that looks like content is tucked under the header.
      */}
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} />
    </div>
  );
}
