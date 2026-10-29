'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireProfile, checkPageAccess } from '@/lib/supabase/auth-helpers';
import { uploadImageToBucket } from '@/lib/storage-upload';
import { revalidatePath } from '@/lib/public-cache';
import type { Tables } from '@/types/database';

/**
 * Thoroughly revalidate customer layout and all customer-facing routes so
 * any theme updates immediately reflect on the customer side without caching delays.
 */
export async function revalidatePublicAndTheme() {
  try {
    revalidatePath('/', 'layout');
    revalidatePath('/travinco_dashboard/theme');
  } catch (err) {
    console.warn('revalidatePublicAndTheme warning:', err);
  }
}


import type { ThemeImageItem } from '@/lib/theme-images';
import { fetchThemeImages } from '@/lib/theme-images';
import { getTermsSettings } from '@/lib/settings';
export type { ThemeImageItem };

const BUCKET = 'theme-images';
const FALLBACK_BUCKET = 'site-images';

/**
 * Fetch all theme images from DB (with fallback to website_settings if table doesn't exist yet).
 */
export async function getThemeImagesAction(): Promise<{ data: ThemeImageItem[]; error?: string }> {
  return fetchThemeImages(await createClient());
}

/** Saves a theme media record (theme_images table, website_settings fallback) and refreshes the site. */
async function insertThemeRecord(fields: {
  page: string;
  placement: string;
  image_url: string;
  title?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  button_text?: string | null;
  link_url?: string | null;
}): Promise<ThemeImageItem> {
  const supabase = await createAdminClient();
  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newRecord: ThemeImageItem = {
    id: newId,
    page: fields.page,
    placement: fields.placement,
    image_url: fields.image_url,
    title: fields.title ?? null,
    subtitle: fields.subtitle ?? null,
    badge: fields.badge ?? null,
    button_text: fields.button_text ?? null,
    link_url: fields.link_url ?? null,
    sort_order: 0,
    is_active: true,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  // Try inserting into theme_images table
  const { error: insertError } = await supabase.from('theme_images').insert(newRecord);

  if (insertError) {
    console.warn('theme_images table insert failed, saving to website_settings:', insertError.message);
    // Fallback to website_settings
    await supabase.from('website_settings').upsert(
      {
        key: `theme_img_${newId}`,
        value: newRecord,
      },
      { onConflict: 'key' }
    );
  }

  await revalidatePublicAndTheme();
  return newRecord;
}

// ─── Hero videos ─────────────────────────────────────────────────────────────
// Videos are too large for Server Action bodies (5 MB limit), so the browser
// uploads them straight to Storage with a short-lived signed upload URL that is
// only issued to staff with Theme edit access.

const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB (Supabase default per-file limit)
const VIDEO_PREFIX = 'videos/';

/** Video is only supported for the Home page hero slider. */
function isVideoPlacement(page: string, placement: string) {
  return page === 'home' && placement === 'hero';
}

export async function createThemeVideoUploadAction(input: {
  contentType: string;
  size: number;
  page: string;
  placement: string;
}): Promise<{ path?: string; token?: string; bucket?: string; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { error: perm.error || 'Access denied.' };

    const page = (input.page || '').trim().toLowerCase();
    const placement = (input.placement || '').trim().toLowerCase();
    if (!isVideoPlacement(page, placement)) {
      return { error: 'Videos can only be used in the Home page hero slider.' };
    }
    const ext = VIDEO_TYPES[input.contentType];
    if (!ext) return { error: 'Only MP4, WEBM or MOV videos are allowed.' };
    if (!input.size || input.size > MAX_VIDEO_SIZE_BYTES) {
      return { error: 'Video is too large — please keep it under 50 MB.' };
    }

    const { createServiceClient } = await import('@/lib/supabase/service');
    const service = createServiceClient();
    const path = `${VIDEO_PREFIX}${crypto.randomUUID()}.${ext}`;
    const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error('createSignedUploadUrl failed:', error);
      return { error: 'Could not prepare the video upload. Please try again.' };
    }
    return { path: data.path, token: data.token, bucket: BUCKET };
  } catch (err: any) {
    console.error('createThemeVideoUploadAction error:', err);
    return { error: 'Could not prepare the video upload. Please try again.' };
  }
}

/** Called after the browser finished uploading to the signed URL. */
export async function saveThemeVideoAction(input: {
  path: string;
  page: string;
  placement: string;
}): Promise<{ success: boolean; data?: ThemeImageItem; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const page = (input.page || '').trim().toLowerCase();
    const placement = (input.placement || '').trim().toLowerCase();
    if (!isVideoPlacement(page, placement)) {
      return { success: false, error: 'Videos can only be used in the Home page hero slider.' };
    }
    const path = input.path || '';
    if (!path.startsWith(VIDEO_PREFIX) || path.includes('..') || !/\.(mp4|webm|mov)$/i.test(path)) {
      return { success: false, error: 'Invalid video upload.' };
    }

    const { createServiceClient } = await import('@/lib/supabase/service');
    const service = createServiceClient();

    // Make sure the file really was uploaded
    const fileName = path.slice(VIDEO_PREFIX.length);
    const { data: listed } = await service.storage
      .from(BUCKET)
      .list(VIDEO_PREFIX.replace(/\/$/, ''), { search: fileName, limit: 1 });
    if (!listed || !listed.some((f) => f.name === fileName)) {
      return { success: false, error: 'The video upload did not complete. Please try again.' };
    }

    const { data: urlData } = service.storage.from(BUCKET).getPublicUrl(path);
    const record = await insertThemeRecord({ page, placement, image_url: urlData.publicUrl });
    return { success: true, data: record };
  } catch (err: any) {
    console.error('saveThemeVideoAction error:', err);
    return { success: false, error: 'Could not save the video. Please try again.' };
  }
}

/**
 * Upload a new theme image file and save metadata.
 */
export async function uploadThemeImageAction(formData: FormData): Promise<{
  success: boolean;
  data?: ThemeImageItem;
  error?: string;
}> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const file = formData.get('image') as File | null;
    const page = ((formData.get('page') as string) || 'home').trim().toLowerCase();
    const placement = ((formData.get('placement') as string) || 'hero').trim().toLowerCase();
    const title = (formData.get('title') as string)?.trim() || null;
    const subtitle = (formData.get('subtitle') as string)?.trim() || null;
    const badge = (formData.get('badge') as string)?.trim() || null;
    const button_text = (formData.get('button_text') as string)?.trim() || null;
    const link_url = (formData.get('link_url') as string)?.trim() || null;

    if (!file || typeof file === 'string' || file.size === 0) {
      return { success: false, error: 'Please choose an image file to upload.' };
    }

    // Upload image to bucket (try theme-images first, fall back to site-images)
    let uploadRes = await uploadImageToBucket(BUCKET, file);
    if (uploadRes.error) {
      uploadRes = await uploadImageToBucket(FALLBACK_BUCKET, file);
    }

    if (uploadRes.error || !uploadRes.url) {
      return { success: false, error: uploadRes.error || 'Image upload failed. Please try again.' };
    }

    const newRecord = await insertThemeRecord({
      page,
      placement,
      image_url: uploadRes.url,
      title,
      subtitle,
      badge,
      button_text,
      link_url,
    });

    return { success: true, data: newRecord };
  } catch (err: any) {
    console.error('Upload theme image error:', err);
    return { success: false, error: err?.message || 'Failed to upload theme image.' };
  }
}

/**
 * Update metadata of an existing theme image.
 */
export async function updateThemeImageAction(
  id: string,
  data: Partial<Omit<ThemeImageItem, 'id' | 'created_at'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const supabase = await createAdminClient();
    const updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('theme_images')
      .update({ ...data, updated_at })
      .eq('id', id);

    if (updateError) {
      // Fallback update in website_settings
      const { data: existing } = await supabase
        .from('website_settings')
        .select('value')
        .eq('key', `theme_img_${id}`)
        .maybeSingle();

      if (existing?.value) {
        await supabase.from('website_settings').upsert(
          {
            key: `theme_img_${id}`,
            value: { ...(existing.value as object), ...data, updated_at },
          },
          { onConflict: 'key' }
        );
      }
    }

    await revalidatePublicAndTheme();

    return { success: true };
  } catch (err: any) {
    console.error('Update theme image error:', err);
    return { success: false, error: 'Failed to update image details.' };
  }
}

/**
 * Toggle active status of a theme image.
 */
export async function toggleThemeImageStatusAction(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  return updateThemeImageAction(id, { is_active: isActive });
}

/**
 * Delete a theme image completely from both theme_images and website_settings.
 */
export async function deleteThemeImageAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    let db: any;
    try {
      const { createServiceClient } = await import('@/lib/supabase/service');
      db = createServiceClient();
    } catch {
      db = await createClient();
    }

    // 0. Fetch image details before deleting to check if its URL is in page content settings
    let deletedImageUrl: string | null = null;
    try {
      const { data: imgRow } = await db.from('theme_images').select('image_url').eq('id', id).maybeSingle();
      if (imgRow?.image_url) {
        deletedImageUrl = imgRow.image_url;
      } else {
        const { data: sRow } = await db.from('website_settings').select('value').eq('key', `theme_img_${id}`).maybeSingle();
        if (sRow?.value?.image_url) {
          deletedImageUrl = sRow.value.image_url;
        }
      }
    } catch (err) {
      console.warn('Could not pre-fetch deleted image details:', err);
    }

    // 1. Hard delete from theme_images table
    const { error: dbDeleteError } = await db
      .from('theme_images')
      .delete()
      .eq('id', id);

    if (dbDeleteError) {
      console.warn('theme_images SQL delete returned warning:', dbDeleteError.message);
    }

    // 2. Also delete from website_settings fallback
    await db
      .from('website_settings')
      .delete()
      .eq('key', `theme_img_${id}`);

    // 3. Mark permanent tombstone in website_settings so getThemeImagesAction never returns it
    await db.from('website_settings').upsert(
      {
        key: `deleted_theme_img_${id}`,
        value: { id, deleted_at: new Date().toISOString() },
      },
      { onConflict: 'key' }
    );

    // 4. If deleted image was configured as the active Ayurveda background, reset to default
    if (deletedImageUrl) {
      try {
        const { data: homeSetting } = await db
          .from('website_settings')
          .select('value')
          .eq('key', 'home_page_content')
          .maybeSingle();

        if (homeSetting?.value && (homeSetting.value as any)?.ayurveda?.image_url === deletedImageUrl) {
          const updatedHomeContent = {
            ...(homeSetting.value as object),
            ayurveda: {
              ...((homeSetting.value as any).ayurveda || {}),
              image_url: '/images/kerala-ayurveda-wellness.jpg',
            },
          };
          await db.from('website_settings').upsert(
            { key: 'home_page_content', value: updatedHomeContent },
            { onConflict: 'key' }
          );
        }
      } catch (contentCleanErr) {
        console.warn('Could not reset deleted image in home_page_content:', contentCleanErr);
      }
    }

    await revalidatePublicAndTheme();

    return { success: true };
  } catch (err: any) {
    console.error('Delete theme image error:', err);
    return { success: false, error: 'Failed to delete theme image.' };
  }
}

import {
  getHomePageContent,
  type HomePageContent,
  DEFAULT_HOME_PAGE_CONTENT,
} from '@/lib/home-page-content';

/**
 * Fetch home page content configuration from website_settings.
 */
export async function getHomePageContentAction(): Promise<{
  data: HomePageContent;
  error?: string;
}> {
  try {
    const data = await getHomePageContent();
    return { data };
  } catch (err: any) {
    console.error('getHomePageContentAction error:', err);
    return { data: DEFAULT_HOME_PAGE_CONTENT, error: 'Could not load home page content.' };
  }
}

/**
 * Save home page content configuration into website_settings.
 */
export async function saveHomePageContentAction(
  content: HomePageContent
): Promise<{ success: boolean; data?: HomePageContent; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const supabase = await createAdminClient();
    let { error: upsertError } = await supabase.from('website_settings').upsert(
      {
        key: 'home_page_content',
        value: content as any,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (upsertError) {
      console.warn('Upsert with updated_by failed, trying without updated_by:', upsertError);
      const retry = await supabase.from('website_settings').upsert(
        {
          key: 'home_page_content',
          value: content as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
      upsertError = retry.error;
    }

    // Persist to local JSON file for guaranteed resilience
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = path.join(process.cwd(), 'src', 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        path.join(dataDir, 'home-page-content.json'),
        JSON.stringify(content, null, 2),
        'utf8'
      );
    } catch (fsErr) {
      console.warn('Could not write local home-page-content.json backup:', fsErr);
    }

    if (upsertError) {
      console.error('Failed to save home_page_content in website_settings:', upsertError);
    }

    await revalidatePublicAndTheme();

    return { success: true, data: content };
  } catch (err: any) {
    console.error('saveHomePageContentAction error:', err);
    return { success: false, error: err?.message || 'Failed to save home page content.' };
  }
}

import {
  getPackagesPageContent,
  type PackagesPageContent,
  DEFAULT_PACKAGES_PAGE_CONTENT,
} from '@/lib/packages-page-content';

/**
 * Fetch packages page content configuration from website_settings.
 */
export async function getPackagesPageContentAction(): Promise<{
  data: PackagesPageContent;
  error?: string;
}> {
  try {
    const [data, terms] = await Promise.all([getPackagesPageContent(), getTermsSettings()]);
    return { data: { ...data, terms_and_conditions: terms.terms_and_conditions ?? '' } };
  } catch (err: any) {
    console.error('getPackagesPageContentAction error:', err);
    return { data: DEFAULT_PACKAGES_PAGE_CONTENT, error: 'Could not load packages page content.' };
  }
}

/**
 * Save packages page content configuration into website_settings and local JSON backup.
 */
export async function savePackagesPageContentAction(
  content: PackagesPageContent
): Promise<{ success: boolean; data?: PackagesPageContent; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    // Terms live in their own setting (read by every package detail page).
    const { terms_and_conditions, ...pageContent } = content;
    content = pageContent;

    const supabase = await createAdminClient();
    if (terms_and_conditions !== undefined) {
      const { error: termsError } = await supabase.from('website_settings').upsert(
        { key: 'terms', value: { terms_and_conditions } as any, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (termsError) {
        console.error('Failed to save terms in website_settings:', termsError);
        return { success: false, error: 'Could not save terms & conditions.' };
      }
    }

    let { error: upsertError } = await supabase.from('website_settings').upsert(
      {
        key: 'packages_page_content',
        value: content as any,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (upsertError) {
      console.warn('Upsert with updated_by failed, trying without updated_by:', upsertError);
      const retry = await supabase.from('website_settings').upsert(
        {
          key: 'packages_page_content',
          value: content as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
      upsertError = retry.error;
    }

    // Persist to local JSON file for backup
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = path.join(process.cwd(), 'src', 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        path.join(dataDir, 'packages-page-content.json'),
        JSON.stringify(content, null, 2),
        'utf8'
      );
    } catch (fsErr) {
      console.warn('Could not write local packages-page-content.json backup:', fsErr);
    }

    if (upsertError) {
      console.error('Failed to save packages_page_content in website_settings:', upsertError);
    }

    await revalidatePublicAndTheme();

    return { success: true, data: { ...content, terms_and_conditions } };
  } catch (err: any) {
    console.error('savePackagesPageContentAction error:', err);
    return { success: false, error: err?.message || 'Failed to save packages page content.' };
  }
}

/**
 * Quick upload helper for package hero background image
 */
export async function uploadPackageHeroImageAction(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const file = formData.get('image') as File | null;
    if (!file || typeof file === 'string' || file.size === 0) {
      return { success: false, error: 'Please choose an image file to upload.' };
    }

    let uploadRes = await uploadImageToBucket(BUCKET, file);
    if (uploadRes.error) {
      uploadRes = await uploadImageToBucket(FALLBACK_BUCKET, file);
    }

    if (uploadRes.error || !uploadRes.url) {
      return { success: false, error: uploadRes.error || 'Image upload failed. Please try again.' };
    }

    return { success: true, url: uploadRes.url };
  } catch (err: any) {
    console.error('Upload package hero image error:', err);
    return { success: false, error: err?.message || 'Failed to upload image.' };
  }
}

import {
  getDestinationsPageContent,
  type DestinationsPageContent,
  DEFAULT_DESTINATIONS_PAGE_CONTENT,
} from '@/lib/destinations-page-content';

/**
 * Fetch destinations page content configuration from website_settings.
 */
export async function getDestinationsPageContentAction(): Promise<{
  data: DestinationsPageContent;
  error?: string;
}> {
  try {
    const data = await getDestinationsPageContent();
    return { data };
  } catch (err: any) {
    console.error('getDestinationsPageContentAction error:', err);
    return { data: DEFAULT_DESTINATIONS_PAGE_CONTENT, error: 'Could not load destinations page content.' };
  }
}

/**
 * Save destinations page content configuration into website_settings and local JSON backup.
 */
export async function saveDestinationsPageContentAction(
  content: DestinationsPageContent
): Promise<{ success: boolean; data?: DestinationsPageContent; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const supabase = await createAdminClient();
    let { error: upsertError } = await supabase.from('website_settings').upsert(
      {
        key: 'destinations_page_content',
        value: content as any,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (upsertError) {
      console.warn('Upsert with updated_by failed, trying without updated_by:', upsertError);
      const retry = await supabase.from('website_settings').upsert(
        {
          key: 'destinations_page_content',
          value: content as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
      upsertError = retry.error;
    }

    // Persist to local JSON file for backup
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = path.join(process.cwd(), 'src', 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        path.join(dataDir, 'destinations-page-content.json'),
        JSON.stringify(content, null, 2),
        'utf8'
      );
    } catch (fsErr) {
      console.warn('Could not write local destinations-page-content.json backup:', fsErr);
    }

    if (upsertError) {
      console.error('Failed to save destinations_page_content in website_settings:', upsertError);
    }

    await revalidatePublicAndTheme();

    return { success: true, data: content };
  } catch (err: any) {
    console.error('saveDestinationsPageContentAction error:', err);
    return { success: false, error: err?.message || 'Failed to save destinations page content.' };
  }
}

/**
 * Quick upload helper for destination hero background image
 */
export async function uploadDestinationHeroImageAction(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const file = formData.get('image') as File | null;
    if (!file || typeof file === 'string' || file.size === 0) {
      return { success: false, error: 'Please choose an image file to upload.' };
    }

    let uploadRes = await uploadImageToBucket(BUCKET, file);
    if (uploadRes.error) {
      uploadRes = await uploadImageToBucket(FALLBACK_BUCKET, file);
    }

    if (uploadRes.error || !uploadRes.url) {
      return { success: false, error: uploadRes.error || 'Image upload failed. Please try again.' };
    }

    return { success: true, url: uploadRes.url };
  } catch (err: any) {
    console.error('Upload destination hero image error:', err);
    return { success: false, error: err?.message || 'Failed to upload image.' };
  }
}

import {
  getBlogPageContent,
  type BlogPageContent,
  DEFAULT_BLOG_PAGE_CONTENT,
} from '@/lib/blog-page-content';

/**
 * Fetch blog page content configuration from website_settings or fallback.
 */
export async function getBlogPageContentAction(): Promise<{
  data: BlogPageContent;
  error?: string;
}> {
  try {
    const data = await getBlogPageContent();
    return { data };
  } catch (err: any) {
    console.error('getBlogPageContentAction error:', err);
    return { data: DEFAULT_BLOG_PAGE_CONTENT, error: 'Could not load blog page content.' };
  }
}

/**
 * Save blog page content configuration into website_settings and local JSON backup.
 */
export async function saveBlogPageContentAction(
  content: BlogPageContent
): Promise<{ success: boolean; data?: BlogPageContent; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const supabase = await createAdminClient();
    let { error: upsertError } = await supabase.from('website_settings').upsert(
      {
        key: 'blog_page_content',
        value: content as any,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (upsertError) {
      console.warn('Upsert with updated_by failed, trying without updated_by:', upsertError);
      const retry = await supabase.from('website_settings').upsert(
        {
          key: 'blog_page_content',
          value: content as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
      upsertError = retry.error;
    }

    // Persist to local JSON file for backup
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = path.join(process.cwd(), 'src', 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        path.join(dataDir, 'blog-page-content.json'),
        JSON.stringify(content, null, 2),
        'utf8'
      );
    } catch (fsErr) {
      console.warn('Could not write local blog-page-content.json backup:', fsErr);
    }

    if (upsertError) {
      console.error('Failed to save blog_page_content in website_settings:', upsertError);
    }

    await revalidatePublicAndTheme();

    return { success: true, data: content };
  } catch (err: any) {
    console.error('saveBlogPageContentAction error:', err);
    return { success: false, error: err?.message || 'Failed to save blog page content.' };
  }
}

/**
 * Quick upload helper for blog hero background image
 */
export async function uploadBlogHeroImageAction(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const file = formData.get('image') as File | null;
    if (!file || typeof file === 'string' || file.size === 0) {
      return { success: false, error: 'Please choose an image file to upload.' };
    }

    let uploadRes = await uploadImageToBucket(BUCKET, file);
    if (uploadRes.error) {
      uploadRes = await uploadImageToBucket(FALLBACK_BUCKET, file);
    }

    if (uploadRes.error || !uploadRes.url) {
      return { success: false, error: uploadRes.error || 'Image upload failed. Please try again.' };
    }

    return { success: true, url: uploadRes.url };
  } catch (err: any) {
    console.error('Upload blog hero image error:', err);
    return { success: false, error: err?.message || 'Failed to upload image.' };
  }
}

import {
  getAboutPageContent,
  type AboutPageContent,
  DEFAULT_ABOUT_PAGE_CONTENT,
} from '@/lib/about-page-content';

/**
 * Fetch about page content configuration from website_settings or fallback.
 */
export async function getAboutPageContentAction(): Promise<{
  data: AboutPageContent;
  error?: string;
}> {
  try {
    const data = await getAboutPageContent();
    return { data };
  } catch (err: any) {
    console.error('getAboutPageContentAction error:', err);
    return { data: DEFAULT_ABOUT_PAGE_CONTENT, error: 'Could not load about page content.' };
  }
}

/**
 * Save about page content configuration into website_settings and local JSON backup.
 */
export async function saveAboutPageContentAction(
  content: AboutPageContent
): Promise<{ success: boolean; data?: AboutPageContent; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const supabase = await createAdminClient();
    let { error: upsertError } = await supabase.from('website_settings').upsert(
      {
        key: 'about_page_content',
        value: content as any,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (upsertError) {
      console.warn('Upsert with updated_by failed, trying without updated_by:', upsertError);
      const retry = await supabase.from('website_settings').upsert(
        {
          key: 'about_page_content',
          value: content as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
      upsertError = retry.error;
    }

    // Persist to local JSON file for backup
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = path.join(process.cwd(), 'src', 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        path.join(dataDir, 'about-page-content.json'),
        JSON.stringify(content, null, 2),
        'utf8'
      );
    } catch (fsErr) {
      console.warn('Could not write local about-page-content.json backup:', fsErr);
    }

    if (upsertError) {
      console.error('Failed to save about_page_content in website_settings:', upsertError);
    }

    await revalidatePublicAndTheme();

    return { success: true, data: content };
  } catch (err: any) {
    console.error('saveAboutPageContentAction error:', err);
    return { success: false, error: err?.message || 'Failed to save about page content.' };
  }
}

/**
 * Quick upload helper for about hero background image
 */
export async function uploadAboutHeroImageAction(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const file = formData.get('image') as File | null;
    if (!file || typeof file === 'string' || file.size === 0) {
      return { success: false, error: 'Please choose an image file to upload.' };
    }

    let uploadRes = await uploadImageToBucket(BUCKET, file);
    if (uploadRes.error) {
      uploadRes = await uploadImageToBucket(FALLBACK_BUCKET, file);
    }

    if (uploadRes.error || !uploadRes.url) {
      return { success: false, error: uploadRes.error || 'Image upload failed. Please try again.' };
    }

    return { success: true, url: uploadRes.url };
  } catch (err: any) {
    console.error('Upload about hero image error:', err);
    return { success: false, error: err?.message || 'Failed to upload image.' };
  }
}

/**
 * Quick upload helper for about story section image
 */
export async function uploadAboutStoryImageAction(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const file = formData.get('image') as File | null;
    if (!file || typeof file === 'string' || file.size === 0) {
      return { success: false, error: 'Please choose an image file to upload.' };
    }

    let uploadRes = await uploadImageToBucket(BUCKET, file);
    if (uploadRes.error) {
      uploadRes = await uploadImageToBucket(FALLBACK_BUCKET, file);
    }

    if (uploadRes.error || !uploadRes.url) {
      return { success: false, error: uploadRes.error || 'Image upload failed. Please try again.' };
    }

    return { success: true, url: uploadRes.url };
  } catch (err: any) {
    console.error('Upload about story image error:', err);
    return { success: false, error: err?.message || 'Failed to upload image.' };
  }
}

import {
  getNavbarFooterContent,
  type NavbarFooterContent,
  DEFAULT_NAVBAR_FOOTER_CONTENT,
} from '@/lib/navbar-footer-content';

/**
 * Fetch navbar and footer content configuration from website_settings / fallback.
 */
export async function getNavbarFooterContentAction(): Promise<{
  data: NavbarFooterContent;
  error?: string;
}> {
  try {
    const data = await getNavbarFooterContent();
    return { data };
  } catch (err: any) {
    console.error('getNavbarFooterContentAction error:', err);
    return { data: DEFAULT_NAVBAR_FOOTER_CONTENT, error: 'Could not load navbar and footer content.' };
  }
}

/**
 * Save navbar and footer content configuration into website_settings and local JSON backup.
 */
export async function saveNavbarFooterContentAction(
  content: NavbarFooterContent
): Promise<{ success: boolean; data?: NavbarFooterContent; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const supabase = await createAdminClient();
    let { error: upsertError } = await supabase.from('website_settings').upsert(
      {
        key: 'navbar_footer_content',
        value: content as any,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (upsertError) {
      console.warn('Upsert with updated_by failed, trying without updated_by:', upsertError);
      const retry = await supabase.from('website_settings').upsert(
        {
          key: 'navbar_footer_content',
          value: content as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
      upsertError = retry.error;
    }

    // Also sync business_name, phone, email, address into 'general' setting so existing systems stay consistent
    try {
      const { data: existingGeneral } = await supabase
        .from('website_settings')
        .select('value')
        .eq('key', 'general')
        .maybeSingle();

      const generalVal = (existingGeneral?.value as any) || {};
      const updatedGeneral = {
        ...generalVal,
        business_name: content.footer.brand_name || content.navbar.logo_text || generalVal.business_name,
        logo_url: content.navbar.logo_image_url || generalVal.logo_url,
        logo_light_url: content.navbar.logo_light_image_url || generalVal.logo_light_url,
        phone: content.footer.phone || generalVal.phone,
        email: content.footer.email || generalVal.email,
        address: content.footer.address || generalVal.address,
        social: {
          ...(generalVal.social || {}),
          facebook: content.footer.social?.facebook ?? generalVal.social?.facebook,
          instagram: content.footer.social?.instagram ?? generalVal.social?.instagram,
          twitter: content.footer.social?.twitter ?? generalVal.social?.twitter,
        },
      };

      await supabase.from('website_settings').upsert(
        {
          key: 'general',
          value: updatedGeneral,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    } catch (genErr) {
      console.warn('Could not sync general settings with navbar_footer_content:', genErr);
    }

    // Persist to local JSON file for backup
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = path.join(process.cwd(), 'src', 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        path.join(dataDir, 'navbar-footer-content.json'),
        JSON.stringify(content, null, 2),
        'utf8'
      );
    } catch (fsErr) {
      console.warn('Could not write local navbar-footer-content.json backup:', fsErr);
    }

    if (upsertError) {
      console.error('Failed to save navbar_footer_content in website_settings:', upsertError);
    }

    await revalidatePublicAndTheme();

    return { success: true, data: content };
  } catch (err: any) {
    console.error('saveNavbarFooterContentAction error:', err);
    return { success: false, error: err?.message || 'Failed to save navbar and footer content.' };
  }
}

/**
 * Quick upload helper for navbar logo image
 */
export async function uploadNavbarLogoAction(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const file = formData.get('image') as File | null;
    if (!file || typeof file === 'string' || file.size === 0) {
      return { success: false, error: 'Please choose an image file to upload.' };
    }

    let uploadRes = await uploadImageToBucket(BUCKET, file);
    if (uploadRes.error) {
      uploadRes = await uploadImageToBucket(FALLBACK_BUCKET, file);
    }

    if (uploadRes.error || !uploadRes.url) {
      return { success: false, error: uploadRes.error || 'Image upload failed. Please try again.' };
    }

    return { success: true, url: uploadRes.url };
  } catch (err: any) {
    console.error('Upload navbar logo image error:', err);
    return { success: false, error: err?.message || 'Failed to upload logo image.' };
  }
}

/**
 * Fetch customer page titles and favicon configuration
 */
export async function getPageTitlesContentAction(): Promise<{
  data: import('@/lib/page-titles-content').PageTitlesContent;
  error?: string;
}> {
  try {
    const { getPageTitlesContent, DEFAULT_PAGE_TITLES_CONTENT } = await import('@/lib/page-titles-content');
    const content = await getPageTitlesContent();
    return { data: content };
  } catch (err: any) {
    const { DEFAULT_PAGE_TITLES_CONTENT } = await import('@/lib/page-titles-content');
    return { data: DEFAULT_PAGE_TITLES_CONTENT, error: err?.message };
  }
}

/**
 * Save customer page titles and favicon configuration
 */
export async function savePageTitlesContentAction(
  content: import('@/lib/page-titles-content').PageTitlesContent
): Promise<{
  success: boolean;
  data?: import('@/lib/page-titles-content').PageTitlesContent;
  error?: string;
}> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) {
      return { success: false, error: perm.error || 'Access denied.' };
    }

    // 1. Immediately persist to local JSON file for instant reliability
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = path.join(process.cwd(), 'src', 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        path.join(dataDir, 'page-titles-content.json'),
        JSON.stringify(content, null, 2),
        'utf8'
      );
    } catch (fsErr) {
      console.warn('Could not write local page-titles-content.json backup:', fsErr);
    }

    // 2. Persist to Supabase website_settings using admin client with retry
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const supabase = await createAdminClient();
        const { error: upsertError } = await supabase.from('website_settings').upsert(
          {
            key: 'page_titles_content',
            value: content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

        if (!upsertError) {
          break;
        } else {
          console.warn(`Upsert page_titles_content attempt ${attempt} warning:`, upsertError.message || upsertError);
          if (attempt === 1) await new Promise((r) => setTimeout(r, 200));
        }
      } catch (connErr: any) {
        console.warn(`Supabase connection attempt ${attempt} error:`, connErr.message || connErr);
        if (attempt === 1) await new Promise((r) => setTimeout(r, 200));
      }
    }

    await revalidatePublicAndTheme();

    return { success: true, data: content };
  } catch (err: any) {
    console.error('savePageTitlesContentAction error:', err);
    return { success: false, error: err?.message || 'Failed to save page titles content.' };
  }
}

/**
 * Quick upload helper for site favicon image
 */
export async function uploadFaviconAction(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const file = formData.get('image') as File | null;
    if (!file || typeof file === 'string' || file.size === 0) {
      return { success: false, error: 'Please choose an image file to upload as favicon.' };
    }

    let uploadRes = await uploadImageToBucket(BUCKET, file);
    if (uploadRes.error) {
      uploadRes = await uploadImageToBucket(FALLBACK_BUCKET, file);
    }

    if (uploadRes.error || !uploadRes.url) {
      return { success: false, error: uploadRes.error || 'Favicon upload failed. Please try again.' };
    }

    return { success: true, url: uploadRes.url };
  } catch (err: any) {
    console.error('Upload favicon image error:', err);
    return { success: false, error: err?.message || 'Failed to upload favicon image.' };
  }
}

import {
  getContactPageContent,
  type ContactPageContent,
  DEFAULT_CONTACT_PAGE_CONTENT,
} from '@/lib/contact-page-content';

/**
 * Fetch contact page content configuration from website_settings.
 */
export async function getContactPageContentAction(): Promise<{
  data: ContactPageContent;
  error?: string;
}> {
  try {
    const data = await getContactPageContent();
    return { data };
  } catch (err: any) {
    console.error('getContactPageContentAction error:', err);
    return { data: DEFAULT_CONTACT_PAGE_CONTENT, error: 'Could not load contact page content.' };
  }
}

/**
 * Save contact page content configuration into website_settings and local JSON backup.
 */
export async function saveContactPageContentAction(
  content: ContactPageContent
): Promise<{ success: boolean; data?: ContactPageContent; error?: string }> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const supabase = await createAdminClient();
    let { error: upsertError } = await supabase.from('website_settings').upsert(
      {
        key: 'contact_page_content',
        value: content as any,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (upsertError) {
      const retry = await supabase.from('website_settings').upsert(
        {
          key: 'contact_page_content',
          value: content as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
      upsertError = retry.error;
    }

    if (upsertError) {
      console.error('Failed to save contact_page_content in website_settings:', upsertError);
    }

    // Persist to local JSON file for backup
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = path.join(process.cwd(), 'src', 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        path.join(dataDir, 'contact-page-content.json'),
        JSON.stringify(content, null, 2),
        'utf8'
      );
    } catch (fsErr) {
      console.warn('Could not write local contact-page-content.json backup:', fsErr);
    }

    await revalidatePublicAndTheme();

    return { success: true, data: content };
  } catch (err: any) {
    console.error('saveContactPageContentAction error:', err);
    return { success: false, error: err?.message || 'Failed to save contact page content.' };
  }
}

/**
 * Quick upload helper for Contact hero background image
 */
export async function uploadContactHeroImageAction(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const profile = await requireProfile();
    const perm = await checkPageAccess(profile, 'theme', 'edit');
    if (!perm.allowed) return { success: false, error: perm.error || 'Access denied.' };

    const file = formData.get('image') as File | null;
    if (!file || typeof file === 'string' || file.size === 0) {
      return { success: false, error: 'Please choose an image file to upload.' };
    }

    let uploadRes = await uploadImageToBucket(BUCKET, file);
    if (uploadRes.error) {
      uploadRes = await uploadImageToBucket(FALLBACK_BUCKET, file);
    }

    if (uploadRes.error || !uploadRes.url) {
      return { success: false, error: uploadRes.error || 'Image upload failed. Please try again.' };
    }

    return { success: true, url: uploadRes.url };
  } catch (err: any) {
    console.error('Upload contact hero image error:', err);
    return { success: false, error: err?.message || 'Failed to upload image.' };
  }
}



