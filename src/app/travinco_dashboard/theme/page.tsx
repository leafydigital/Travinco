import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertPageAccess, hasPageAccess } from '@/lib/supabase/auth-helpers';
import {
  getThemeImagesAction,
  getHomePageContentAction,
  getPackagesPageContentAction,
  getDestinationsPageContentAction,
  getBlogPageContentAction,
  getAboutPageContentAction,
  getContactPageContentAction,
  getNavbarFooterContentAction,
  getPageTitlesContentAction,
} from './actions';
import { ThemeClient } from './theme-client';

export const metadata = {
  title: 'Theme & Page Visuals | Travinco Admin',
  description: 'Manage website banners, hero sliders, customer-side theme images, and page titles.',
};

export const dynamic = 'force-dynamic';

export default async function AdminThemePage() {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'theme');

  // Both admin and team members with access can edit and save
  const canEdit = await hasPageAccess(profile, 'theme', 'edit');
  const isAdmin = canEdit;
  const supabase = await createClient();

  const [
    themeImagesRes,
    homeContentRes,
    packagesContentRes,
    destinationsContentRes,
    blogContentRes,
    aboutContentRes,
    contactContentRes,
    navbarFooterRes,
    pageTitlesRes,
    { data: destinations },
    { data: recentPosts },
  ] = await Promise.all([
    getThemeImagesAction(),
    getHomePageContentAction(),
    getPackagesPageContentAction(),
    getDestinationsPageContentAction(),
    getBlogPageContentAction(),
    getAboutPageContentAction(),
    getContactPageContentAction(),
    getNavbarFooterContentAction(),
    getPageTitlesContentAction(),
    supabase
      .from('destinations')
      .select('id, name, slug, cover_image_url, description')
      .eq('status', 'published')
      .order('sort_order')
      .limit(6),
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, created_at, status')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  const activeBlogPosts = (recentPosts ?? []);

  return (
    <ThemeClient
      initialImages={themeImagesRes?.data ?? []}
      initialHomeContent={homeContentRes?.data}
      initialPackagesContent={packagesContentRes?.data}
      initialDestinationsContent={destinationsContentRes?.data}
      initialBlogContent={blogContentRes?.data}
      initialAboutContent={aboutContentRes?.data}
      initialContactContent={contactContentRes?.data}
      initialNavbarFooterContent={navbarFooterRes?.data}
      initialPageTitlesContent={pageTitlesRes?.data}
      destinations={destinations ?? []}
      recentPosts={activeBlogPosts}
      isAdmin={isAdmin}
    />
  );
}

