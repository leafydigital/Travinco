import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';
import { getGeneralSettings } from '@/lib/settings';
import { getNavbarFooterContent } from '@/lib/navbar-footer-content';
import { createClient } from '@/lib/supabase/server';
import { getCustomer } from '@/lib/supabase/customer-auth-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [settings, navbarFooterContent] = await Promise.all([
    getGeneralSettings(),
    getNavbarFooterContent(),
  ]);

  const supabase = await createClient();
  const [{ data: destinationsData }, { data: deletedSettingsData }] = await Promise.all([
    supabase
      .from('destinations')
      .select('id, name, slug, sort_order, is_deleted')
      .eq('status', 'published')
      .order('sort_order', { ascending: true }),
    supabase.from('website_settings').select('key').like('key', 'deleted_destination_%'),
    supabase.auth.getUser(),
  ]);

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

  const customer = await getCustomer();
  const customerName = customer?.full_name ?? customer?.email ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        whatsappNumber={settings.whatsapp}
        destinations={activeDestinations}
        customerName={customerName}
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
