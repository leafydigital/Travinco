import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/packages`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/destinations`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/offers`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${siteUrl}/events`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${siteUrl}/gallery`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${siteUrl}/about`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteUrl}/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteUrl}/booking`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const [{ data: packages }, { data: destinations }] = await Promise.all([
    supabase.from('travel_packages').select('slug, updated_at').eq('status', 'published'),
    supabase.from('destinations').select('slug, updated_at').eq('status', 'published'),
  ]);

  const packageRoutes: MetadataRoute.Sitemap = (packages ?? []).map((p) => ({
    url: `${siteUrl}/packages/${p.slug}`,
    lastModified: p.updated_at,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const destinationRoutes: MetadataRoute.Sitemap = (destinations ?? []).map((d) => ({
    url: `${siteUrl}/destinations/${d.slug}`,
    lastModified: d.updated_at,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...packageRoutes, ...destinationRoutes];
}
