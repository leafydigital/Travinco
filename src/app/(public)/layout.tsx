import type { Metadata } from 'next';
import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';
import { getGeneralSettings } from '@/lib/settings';
import { getNavbarFooterContent } from '@/lib/navbar-footer-content';
import { getPageTitlesContent } from '@/lib/page-titles-content';
import { createPublicClient } from '@/lib/supabase/public';
import { AuthToastNotifier } from '@/components/public/auth-toast-notifier';

// Shared by every public page: built from cached, cookie-free reads so content pages
// can be served from the CDN. The signed-in customer's name is loaded client-side
// by <SiteHeader /> (see /api/customer/me).
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const titlesContent = await getPageTitlesContent();
  if (titlesContent.favicon_url) {
    return {
      icons: {
        icon: [{ url: titlesContent.favicon_url, href: titlesContent.favicon_url }],
        shortcut: [titlesContent.favicon_url],
        apple: [titlesContent.favicon_url],
      },
    };
  }
  return {};
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = createPublicClient();

  const [
    settings,
    navbarFooterContent,
    pageTitlesContent,
    destinationsRes,
    deletedSettingsRes,
  ] = await Promise.all([
    getGeneralSettings(),
    getNavbarFooterContent(),
    getPageTitlesContent(),
    supabase
      .from('destinations')
      .select('id, name, slug, sort_order, is_deleted')
      .eq('status', 'published')
      .order('sort_order', { ascending: true }),
    supabase.from('website_settings').select('key').like('key', 'deleted_destination_%'),
  ]);

  const destinationsData = destinationsRes.data;
  const deletedSettingsData = deletedSettingsRes.data;

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_destination_', ''))
  );

  const activeDestinations = (destinationsData ?? [])
    .filter((d: any) => d.is_deleted !== true && !deletedKeys.has(d.id))
    .map((d: any) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
    }));

  return (
    <div className="flex min-h-screen flex-col">
      <AuthToastNotifier />
      {pageTitlesContent.favicon_url && (
        <link rel="icon" href={pageTitlesContent.favicon_url} />
      )}
      <SiteHeader
        whatsappNumber={settings.whatsapp}
        destinations={activeDestinations}
        navbarContent={navbarFooterContent.navbar}
      />
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
      <SiteFooter settings={settings} footerContent={navbarFooterContent.footer} />
    </div>
  );
}
