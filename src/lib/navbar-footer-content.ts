// Public website content: read with the cookie-free anon client so it can be cached
import { createPublicClient } from '@/lib/supabase/public';
import {
  type NavbarFooterContent,
  DEFAULT_NAVBAR_FOOTER_CONTENT,
} from './navbar-footer-content-types';
import { getGeneralSettings } from './settings';

export * from './navbar-footer-content-types';

export async function getNavbarFooterContent(): Promise<NavbarFooterContent> {
  try {
    const supabase = createPublicClient();
    const [settingsRes, generalSettings] = await Promise.all([
      supabase
        .from('website_settings')
        .select('value')
        .eq('key', 'navbar_footer_content')
        .maybeSingle(),
      getGeneralSettings(),
    ]);

    let data = settingsRes.data?.value as Partial<NavbarFooterContent> | null;

    if (!data) {
      try {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const filePath = path.join(
          process.cwd(),
          'src',
          'data',
          'navbar-footer-content.json'
        );
        const fileContent = await fs.readFile(filePath, 'utf8');
        data = JSON.parse(fileContent);
      } catch {}
    }

    // Merge with general settings as default fallbacks
    const fallbackBrandName =
      generalSettings.business_name || DEFAULT_NAVBAR_FOOTER_CONTENT.footer.brand_name;
    const fallbackPhone =
      generalSettings.phone || DEFAULT_NAVBAR_FOOTER_CONTENT.footer.phone;
    const fallbackEmail =
      generalSettings.email || DEFAULT_NAVBAR_FOOTER_CONTENT.footer.email;
    const fallbackAddress =
      generalSettings.address || DEFAULT_NAVBAR_FOOTER_CONTENT.footer.address;
    const fallbackSocial = {
      ...DEFAULT_NAVBAR_FOOTER_CONTENT.footer.social,
      ...(generalSettings.social || {}),
    };

    return {
      navbar: {
        logo_type: data?.navbar?.logo_type ?? DEFAULT_NAVBAR_FOOTER_CONTENT.navbar.logo_type,
        logo_text:
          data?.navbar?.logo_text ?? fallbackBrandName ?? DEFAULT_NAVBAR_FOOTER_CONTENT.navbar.logo_text,
        logo_image_url:
          data?.navbar?.logo_image_url || '/images/green_logo.png',
        logo_light_image_url:
          data?.navbar?.logo_light_image_url || '/images/white_logo.png',
        cta_button_text:
          data?.navbar?.cta_button_text ?? DEFAULT_NAVBAR_FOOTER_CONTENT.navbar.cta_button_text,
        cta_button_url:
          data?.navbar?.cta_button_url ?? DEFAULT_NAVBAR_FOOTER_CONTENT.navbar.cta_button_url,
        nav_links:
          data?.navbar?.nav_links && Array.isArray(data.navbar.nav_links) && data.navbar.nav_links.length > 0
            ? data.navbar.nav_links
            : DEFAULT_NAVBAR_FOOTER_CONTENT.navbar.nav_links,
      },
      footer: {
        brand_name:
          data?.footer?.brand_name ?? fallbackBrandName,
        brand_tagline:
          data?.footer?.brand_tagline ?? DEFAULT_NAVBAR_FOOTER_CONTENT.footer.brand_tagline,
        show_social:
          data?.footer?.show_social ?? DEFAULT_NAVBAR_FOOTER_CONTENT.footer.show_social,
        social: {
          ...fallbackSocial,
          ...(data?.footer?.social || {}),
        },
        explore_heading:
          data?.footer?.explore_heading ?? DEFAULT_NAVBAR_FOOTER_CONTENT.footer.explore_heading,
        explore_links:
          data?.footer?.explore_links && Array.isArray(data.footer.explore_links)
            ? data.footer.explore_links
            : DEFAULT_NAVBAR_FOOTER_CONTENT.footer.explore_links,
        company_heading:
          data?.footer?.company_heading ?? DEFAULT_NAVBAR_FOOTER_CONTENT.footer.company_heading,
        company_links:
          data?.footer?.company_links && Array.isArray(data.footer.company_links)
            ? data.footer.company_links
            : DEFAULT_NAVBAR_FOOTER_CONTENT.footer.company_links,
        contact_heading:
          data?.footer?.contact_heading ?? DEFAULT_NAVBAR_FOOTER_CONTENT.footer.contact_heading,
        phone: data?.footer?.phone ?? fallbackPhone,
        email: data?.footer?.email ?? fallbackEmail,
        address: data?.footer?.address ?? fallbackAddress,
        copyright_text:
          data?.footer?.copyright_text ?? DEFAULT_NAVBAR_FOOTER_CONTENT.footer.copyright_text,
      },
    };
  } catch (err) {
    console.error('Error fetching navbar footer content:', err);
    return DEFAULT_NAVBAR_FOOTER_CONTENT;
  }
}
