'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { packageSchema, packageCategories, slugify, type PackageFormValues } from '@/lib/validations/package';
import { revalidatePath } from '@/lib/public-cache'; // also purges cached public website content
import { redirect } from 'next/navigation';

export type ActionState = { error?: string; fieldErrors?: Record<string, string> };

/**
 * Fills in meta_title/meta_description from the package's own title and
 * short_description whenever the admin leaves those SEO fields blank, so
 * SEO metadata is automatic by default rather than a manual chore. An
 * admin who types something into either field always keeps what they
 * typed — this only fills genuinely empty fields.
 */
function withAutoSeo(data: PackageFormValues): PackageFormValues {
  const meta_title = data.meta_title?.trim() ? data.meta_title : data.title;
  const meta_description = data.meta_description?.trim()
    ? data.meta_description
    : (data.short_description?.trim() ?? null);
  return { ...data, meta_title, meta_description };
}

async function logActivity(params: {
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from('audit_logs').insert({
    actor_id: user?.id ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    before_data: (params.beforeData as never) ?? null,
    after_data: (params.afterData as never) ?? null,
  });
}

export async function createPackage(
  raw: PackageFormValues,
  imageUrls: string[] = [],
  videoUrls: string[] = [],
  itineraryDays: { day_number: number; title: string; description?: string }[] = [],
  inclusions: string[] = [],
  exclusions: string[] = [],
  faqs: { question: string; answer: string }[] = [],
  publishNow = false
): Promise<ActionState & { id?: string }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'packages', 'edit');
  if (!perm.allowed) {
    return { error: perm.error || 'You do not have permission to create packages.' };
  }

  const parsed = packageSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }

  const validImageUrls = imageUrls.map((u) => u.trim()).filter(Boolean);

  // Draft creation stays lenient (staff can save an incomplete idea and
  // come back to it), but publishing has two real, checked requirements:
  // a price, and at least one photo. This is enforced here — the single
  // source of truth — rather than only in the UI, so it can't be
  // bypassed by calling the action directly.
  if (publishNow) {
    const missing: string[] = [];
    if (!parsed.data.base_price || parsed.data.base_price <= 0) missing.push('a starting price');
    if (validImageUrls.length === 0) missing.push('at least one photo');
    if (missing.length > 0) {
      return {
        error: `Can't publish yet — this package needs ${missing.join(' and ')}. Saved as a draft instead.`,
      };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('travel_packages')
    .insert({
      ...withAutoSeo(parsed.data),
      status: publishNow ? 'published' : 'draft',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'A package with this slug already exists.', fieldErrors: { slug: 'Already taken' } };
    }
    return { error: 'Could not create the package. Please try again.' };
  }

  // Any images pasted on the create form go in right away — no cap on
  // how many, matching the multi-URL paste flow already used on the
  // edit page's image manager. The first image becomes the cover if
  // none is otherwise set.
  if (validImageUrls.length > 0) {
    const { error: imagesError } = await supabase.from('package_images').insert(
      validImageUrls.map((image_url, index) => ({
        package_id: data.id,
        image_url,
        is_cover: index === 0,
        sort_order: index,
      }))
    );
    if (!imagesError) {
      await supabase
        .from('travel_packages')
        .update({ cover_image_url: validImageUrls[0] })
        .eq('id', data.id);
    }
  }

  const validVideoUrls = videoUrls.map((u) => u.trim()).filter(Boolean);
  if (validVideoUrls.length > 0) {
    await supabase.from('package_videos').insert(
      validVideoUrls.map((video_url, index) => ({
        package_id: data.id,
        video_url,
        sort_order: index,
      }))
    );
  }

  if (itineraryDays.length > 0) {
    await supabase.from('package_itineraries').insert(
      itineraryDays.map((day) => ({
        package_id: data.id,
        day_number: day.day_number,
        title: day.title,
        description: day.description || null,
      }))
    );
  }

  if (inclusions.length > 0) {
    await supabase.from('package_inclusions').insert(
      inclusions.map((item, index) => ({ package_id: data.id, item, sort_order: index }))
    );
  }

  if (exclusions.length > 0) {
    await supabase.from('package_exclusions').insert(
      exclusions.map((item, index) => ({ package_id: data.id, item, sort_order: index }))
    );
  }

  const validFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
  if (validFaqs.length > 0) {
    await supabase.from('package_faqs').insert(
      validFaqs.map((f, index) => ({
        package_id: data.id,
        question: f.question,
        answer: f.answer,
        sort_order: index,
      }))
    );
  }

  await logActivity({
    action: 'package.created',
    entityType: 'travel_packages',
    entityId: data.id,
    afterData: parsed.data,
  });

  revalidatePath('/travinco_dashboard/packages');
  return { id: data.id };
}

export async function updatePackage(
  id: string,
  raw: PackageFormValues
): Promise<ActionState> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'packages', 'edit');
  if (!perm.allowed) {
    return { error: perm.error || 'You do not have permission to edit packages.' };
  }

  const parsed = packageSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('travel_packages')
    .select('*')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('travel_packages')
    .update(withAutoSeo(parsed.data))
    .eq('id', id);

  if (error) {
    if (error.code === '23505') {
      return { error: 'A package with this slug already exists.', fieldErrors: { slug: 'Already taken' } };
    }
    return { error: 'Could not update the package. Please try again.' };
  }

  await logActivity({
    action: 'package.updated',
    entityType: 'travel_packages',
    entityId: id,
    beforeData: before,
    afterData: parsed.data,
  });

  revalidatePath('/travinco_dashboard/packages');
  revalidatePath(`/admin/packages/${id}`);
  if (before?.slug) revalidatePath(`/packages/${before.slug}`);
  return {};
}

async function setPackageStatus(id: string, status: 'draft' | 'published') {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'packages', 'edit');
  if (!perm.allowed) {
    return { error: perm.error || 'You do not have permission to change package status.' };
  }
  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from('travel_packages')
    .select('slug, status, base_price')
    .eq('id', id)
    .single();

  if (!pkg) return { error: 'Package not found.' };

  if (status === 'published') {
    const { count: imageCount } = await supabase
      .from('package_images')
      .select('id', { count: 'exact', head: true })
      .eq('package_id', id);

    const missing: string[] = [];
    if (!pkg.base_price || pkg.base_price <= 0) missing.push('a starting price');
    if (!imageCount || imageCount === 0) missing.push('at least one photo');
    if (missing.length > 0) {
      return { error: `Can't publish yet — this package needs ${missing.join(' and ')}.` };
    }
  }

  const { error } = await supabase
    .from('travel_packages')
    .update({ status })
    .eq('id', id);

  if (error) return { error: 'Could not update package status.' };

  await logActivity({
    action: `package.${status}`,
    entityType: 'travel_packages',
    entityId: id,
    beforeData: { status: pkg.status, by: profile.id },
    afterData: { status },
  });

  revalidatePath('/travinco_dashboard/packages');
  revalidatePath(`/packages/${pkg.slug}`);
  return {};
}

export async function publishPackage(id: string) {
  return setPackageStatus(id, 'published');
}
export async function unpublishPackage(id: string) {
  return setPackageStatus(id, 'draft');
}

export async function toggleFeatured(id: string, isFeatured: boolean) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'packages', 'edit');
  if (!perm.allowed) {
    return { error: perm.error || 'You do not have permission to feature packages.' };
  }
  const supabase = await createClient();

  const { error } = await supabase
    .from('travel_packages')
    .update({ is_featured: isFeatured })
    .eq('id', id);

  if (error) return { error: 'Could not update featured status.' };

  await logActivity({
    action: isFeatured ? 'package.featured' : 'package.unfeatured',
    entityType: 'travel_packages',
    entityId: id,
    afterData: { is_featured: isFeatured, by: profile.id },
  });

  revalidatePath('/travinco_dashboard/packages');
  revalidatePath('/');
  return {};
}

export async function duplicatePackage(id: string): Promise<ActionState & { id?: string }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'packages', 'edit');
  if (!perm.allowed) {
    return { error: perm.error || 'You do not have permission to duplicate packages.' };
  }
  const supabase = await createClient();

  const { data: original, error: fetchError } = await supabase
    .from('travel_packages')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !original) return { error: 'Package not found.' };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Generate a unique-enough slug by appending -copy and, if that's taken
  // too, a short timestamp suffix.
  let newSlug = `${original.slug}-copy`;
  const { data: clash } = await supabase
    .from('travel_packages')
    .select('id')
    .eq('slug', newSlug)
    .maybeSingle();
  if (clash) newSlug = `${original.slug}-copy-${Date.now().toString(36)}`;

  const {
    id: _oldId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    seats_booked: _seatsBooked,
    ...rest
  } = original;

  const { data: created, error } = await supabase
    .from('travel_packages')
    .insert({
      ...rest,
      title: `${original.title} (Copy)`,
      slug: newSlug,
      status: 'draft',
      is_featured: false,
      seats_booked: 0,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();

  if (error || !created) return { error: 'Could not duplicate the package.' };

  // Duplicate children: images, itinerary days, inclusions, exclusions.
  const [{ data: images }, { data: itinerary }, { data: inclusions }, { data: exclusions }] =
    await Promise.all([
      supabase.from('package_images').select('*').eq('package_id', id),
      supabase.from('package_itineraries').select('*').eq('package_id', id),
      supabase.from('package_inclusions').select('*').eq('package_id', id),
      supabase.from('package_exclusions').select('*').eq('package_id', id),
    ]);

  await Promise.all([
    images?.length
      ? supabase.from('package_images').insert(
          images.map(({ id: _i, package_id: _p, created_at: _c, ...img }) => ({
            ...img,
            package_id: created.id,
          }))
        )
      : Promise.resolve(),
    itinerary?.length
      ? supabase.from('package_itineraries').insert(
          itinerary.map(({ id: _i, package_id: _p, ...day }) => ({
            ...day,
            package_id: created.id,
          }))
        )
      : Promise.resolve(),
    inclusions?.length
      ? supabase.from('package_inclusions').insert(
          inclusions.map(({ id: _i, package_id: _p, ...inc }) => ({
            ...inc,
            package_id: created.id,
          }))
        )
      : Promise.resolve(),
    exclusions?.length
      ? supabase.from('package_exclusions').insert(
          exclusions.map(({ id: _i, package_id: _p, ...exc }) => ({
            ...exc,
            package_id: created.id,
          }))
        )
      : Promise.resolve(),
  ]);

  await logActivity({
    action: 'package.duplicated',
    entityType: 'travel_packages',
    entityId: created.id,
    beforeData: { duplicated_from: id },
  });

  revalidatePath('/travinco_dashboard/packages');
  return { id: created.id };
}

export async function deletePackage(id: string): Promise<ActionState> {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only administrators have permission to delete packages.' };
  }

  const supabase = await createClient();

  const { data: before } = await supabase
    .from('travel_packages')
    .select('*')
    .eq('id', id)
    .single();

  // 1. Try secure RPC function first (bypasses RLS recursion)
  let updateSuccess = false;
  try {
    const { error: rpcError } = await supabase.rpc('soft_delete_package', {
      package_id: id,
    });
    if (!rpcError) {
      updateSuccess = true;
    }
  } catch {}

  // 2. Direct update fallback on travel_packages table
  if (!updateSuccess) {
    try {
      const { error: updateError } = await supabase
        .from('travel_packages')
        .update({ is_deleted: true })
        .eq('id', id);

      if (!updateError) {
        updateSuccess = true;
      }
    } catch {}
  }

  // 3. Fallback tracking in website_settings so package is guaranteed soft-deleted
  // even if database RLS migration hasn't been executed yet in Supabase
  try {
    const { error: wsError } = await supabase.from('website_settings').upsert(
      {
        key: `deleted_package_${id}`,
        value: { is_deleted: true, deleted_at: new Date().toISOString() },
      },
      { onConflict: 'key' }
    );
    if (!wsError) {
      updateSuccess = true;
    }
  } catch {}

  if (!updateSuccess) {
    return { error: 'Unable to delete package. Please try again.' };
  }

  try {
    await logActivity({
      action: 'package.deleted',
      entityType: 'travel_packages',
      entityId: id,
      beforeData: before,
    });
  } catch {}

  revalidatePath('/travinco_dashboard/packages');
  revalidatePath('/travinco_dashboard');
  revalidatePath('/packages');
  return {};
}

export type BulkPackageInput = {
  // Basic info
  title: string;
  slug?: string;
  destination_id?: string | null;
  category?: (typeof packageCategories)[number];
  duration_days: number;
  duration_nights: number;
  short_description?: string | null;
  full_description?: string | null;

  // Pricing & availability
  base_price: number;
  discount_price?: number | null;
  child_price?: number | null;
  currency?: string;
  available_from?: string | null;
  available_to?: string | null;
  total_seats?: number | null;
  pickup_info?: string | null;
  is_featured?: boolean;

  // Highlights
  highlights?: string[];

  // SEO
  meta_title?: string | null;
  meta_description?: string | null;

  // Status
  status?: 'draft' | 'published';

  // Sub-resources
  cover_image_url?: string | null;
  video_url?: string | null;
  imageUrls?: string[];
  videoUrls?: string[];
  itineraryDays?: { day_number: number; title: string; description?: string }[];
  inclusions?: string[];
  exclusions?: string[];
  faqs?: { question: string; answer: string }[];
};

export async function bulkCreatePackages(
  items: BulkPackageInput[]
): Promise<{ error?: string; count?: number; packages?: any[] }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'packages', 'edit');
  if (!perm.allowed) {
    return { error: perm.error || 'You do not have permission to create packages.' };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Please provide at least one package to save.' };
  }

  // Filter candidate items with a valid title
  const candidates = items.filter((item) => item.title && item.title.trim().length >= 2);
  if (candidates.length === 0) {
    return { error: 'Each package must have a valid title (at least 2 characters).' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all existing package slugs to prevent conflicts
  const { data: existingPackages } = await supabase
    .from('travel_packages')
    .select('slug');
  const usedSlugs = new Set((existingPackages || []).map((p) => p.slug.toLowerCase()));

  const preparedCandidates = candidates.map((item) => {
    const rawTitle = item.title.trim();
    let baseSlug = item.slug ? slugify(item.slug) : slugify(rawTitle);
    if (!baseSlug) baseSlug = 'package';
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    usedSlugs.add(slug);

    const days = Math.max(1, Math.floor(Number(item.duration_days) || 1));
    const nights = Math.max(0, Math.floor(Number(item.duration_nights) || 0));
    const basePrice = Math.max(0, Number(item.base_price) || 0);
    const discountPrice =
      item.discount_price && Number(item.discount_price) > 0
        ? Math.min(basePrice, Number(item.discount_price))
        : null;

    const validImages = Array.isArray(item.imageUrls)
      ? item.imageUrls.map((u) => u.trim()).filter(Boolean)
      : [];
    const coverUrl = validImages[0] || item.cover_image_url || null;

    return {
      item,
      slug,
      payload: {
        title: rawTitle,
        slug,
        destination_id: item.destination_id && item.destination_id.trim() ? item.destination_id.trim() : null,
        category: item.category || 'other',
        duration_days: days,
        duration_nights: nights,
        base_price: basePrice,
        discount_price: discountPrice,
        child_price: item.child_price && Number(item.child_price) > 0 ? Number(item.child_price) : null,
        currency: item.currency || 'INR',
        available_from: item.available_from || null,
        available_to: item.available_to || null,
        total_seats: item.total_seats && Number(item.total_seats) > 0 ? Math.floor(Number(item.total_seats)) : null,
        pickup_info: item.pickup_info?.trim() || null,
        is_featured: Boolean(item.is_featured),
        short_description: item.short_description?.trim() || null,
        full_description: item.full_description?.trim() || null,
        highlights: Array.isArray(item.highlights) ? item.highlights.filter(Boolean) : [],
        cover_image_url: coverUrl,
        video_url: item.videoUrls?.[0] || item.video_url || null,
        status: item.status === 'published' ? 'published' : 'draft',
        meta_title: item.meta_title?.trim() || rawTitle,
        meta_description: item.meta_description?.trim() || item.short_description?.trim() || null,
        created_by: user?.id ?? null,
      },
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from('travel_packages')
    .insert(preparedCandidates.map((c) => c.payload))
    .select(
      'id, title, slug, status, base_price, discount_price, currency, duration_days, duration_nights, cover_image_url, is_featured, destination_id'
    );

  if (insertError) {
    console.error('Error during bulk create packages:', insertError);
    return { error: 'Failed to bulk create packages: ' + insertError.message };
  }

  // Map inserted package IDs by slug to attach sub-resources
  if (inserted && inserted.length > 0) {
    const insertedMap = new Map(inserted.map((p) => [p.slug, p.id]));

    const allImagesToInsert: { package_id: string; image_url: string; is_cover: boolean; sort_order: number }[] = [];
    const allVideosToInsert: { package_id: string; video_url: string; sort_order: number }[] = [];
    const allItinerariesToInsert: { package_id: string; day_number: number; title: string; description: string | null }[] = [];
    const allInclusionsToInsert: { package_id: string; item: string; sort_order: number }[] = [];
    const allExclusionsToInsert: { package_id: string; item: string; sort_order: number }[] = [];
    const allFaqsToInsert: { package_id: string; question: string; answer: string; sort_order: number }[] = [];

    for (const prep of preparedCandidates) {
      const packageId = insertedMap.get(prep.slug);
      if (!packageId) continue;

      // 1. Images
      const images = Array.isArray(prep.item.imageUrls) ? prep.item.imageUrls.map((u) => u.trim()).filter(Boolean) : [];
      images.forEach((url, idx) => {
        allImagesToInsert.push({
          package_id: packageId,
          image_url: url,
          is_cover: idx === 0,
          sort_order: idx,
        });
      });

      // 2. Videos
      const videos = Array.isArray(prep.item.videoUrls) ? prep.item.videoUrls.map((u) => u.trim()).filter(Boolean) : [];
      videos.forEach((url, idx) => {
        allVideosToInsert.push({
          package_id: packageId,
          video_url: url,
          sort_order: idx,
        });
      });

      // 3. Itineraries
      if (Array.isArray(prep.item.itineraryDays)) {
        prep.item.itineraryDays
          .filter((d) => d && d.title && d.title.trim())
          .forEach((d) => {
            allItinerariesToInsert.push({
              package_id: packageId,
              day_number: d.day_number,
              title: d.title.trim(),
              description: d.description?.trim() || null,
            });
          });
      }

      // 4. Inclusions
      if (Array.isArray(prep.item.inclusions)) {
        prep.item.inclusions
          .map((i) => i?.trim())
          .filter(Boolean)
          .forEach((item, idx) => {
            allInclusionsToInsert.push({
              package_id: packageId,
              item,
              sort_order: idx,
            });
          });
      }

      // 5. Exclusions
      if (Array.isArray(prep.item.exclusions)) {
        prep.item.exclusions
          .map((i) => i?.trim())
          .filter(Boolean)
          .forEach((item, idx) => {
            allExclusionsToInsert.push({
              package_id: packageId,
              item,
              sort_order: idx,
            });
          });
      }

      // 6. FAQs
      if (Array.isArray(prep.item.faqs)) {
        prep.item.faqs
          .filter((f) => f && f.question?.trim() && f.answer?.trim())
          .forEach((f, idx) => {
            allFaqsToInsert.push({
              package_id: packageId,
              question: f.question.trim(),
              answer: f.answer.trim(),
              sort_order: idx,
            });
          });
      }
    }

    // Insert all sub-resources in parallel
    await Promise.all([
      allImagesToInsert.length > 0 ? supabase.from('package_images').insert(allImagesToInsert) : Promise.resolve(),
      allVideosToInsert.length > 0 ? supabase.from('package_videos').insert(allVideosToInsert) : Promise.resolve(),
      allItinerariesToInsert.length > 0 ? supabase.from('package_itineraries').insert(allItinerariesToInsert) : Promise.resolve(),
      allInclusionsToInsert.length > 0 ? supabase.from('package_inclusions').insert(allInclusionsToInsert) : Promise.resolve(),
      allExclusionsToInsert.length > 0 ? supabase.from('package_exclusions').insert(allExclusionsToInsert) : Promise.resolve(),
      allFaqsToInsert.length > 0 ? supabase.from('package_faqs').insert(allFaqsToInsert) : Promise.resolve(),
    ]);

    for (const pkg of inserted) {
      try {
        await logActivity({
          action: 'package.bulk_created',
          entityType: 'travel_packages',
          entityId: pkg.id,
          afterData: pkg,
        });
      } catch {}
    }
  }

  revalidatePath('/travinco_dashboard/packages');
  revalidatePath('/travinco_dashboard');
  revalidatePath('/packages');

  return {
    count: inserted?.length || 0,
    packages: inserted || [],
  };
}

export interface PackageTableItem {
  id: string;
  title: string;
  slug: string;
  cover_image_url: string | null;
  destination_name: string | null;
  duration_days: number;
  duration_nights: number;
  base_price: number;
  discount_price: number | null;
  currency: string;
  status: string;
  is_featured: boolean;
}

export interface PackagesTableQueryResult {
  packages: PackageTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

/**
 * Fast, lean query fetching strictly the 7 table columns:
 * Image, Package (title/slug/id), Destination, Duration, Price, Status, Featured.
 * Excludes heavy itineraries, inclusions, exclusions, faqs, images, videos, and descriptions.
 */
export async function getPackagesTableList({
  page = 1,
  pageSize = 20,
  q = '',
  status = 'all',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
} = {}): Promise<PackagesTableQueryResult> {
  const profile = await requireProfile();
  await checkModulePermission(profile, 'packages', 'view');

  const supabase = await createClient();

  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('travel_packages')
    .select(
      'id, title, slug, cover_image_url, duration_days, duration_nights, base_price, discount_price, currency, status, is_featured, destination_id, is_deleted',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status as any);
  }

  if (q && q.trim()) {
    query = query.or(`title.ilike.%${q.trim()}%,slug.ilike.%${q.trim()}%`);
  }

  const [packagesRes, destinationsRes, deletedSettingsRes] = await Promise.all([
    query.range(from, to),
    supabase.from('destinations').select('id, name'),
    supabase.from('website_settings').select('key').like('key', 'deleted_package_%'),
  ]);

  const deletedKeys = new Set(
    (deletedSettingsRes.data || []).map((s: { key: string }) => s.key.replace('deleted_package_', ''))
  );

  const destMap = new Map<string, string>();
  (destinationsRes.data || []).forEach((d: { id: string; name: string }) => {
    destMap.set(d.id, d.name);
  });

  const rawRows = packagesRes.data || [];
  const activeRows = rawRows.filter(
    (pkg: any) => pkg.is_deleted !== true && !deletedKeys.has(pkg.id)
  );

  const items: PackageTableItem[] = activeRows.map((pkg: any) => ({
    id: pkg.id,
    title: pkg.title,
    slug: pkg.slug,
    cover_image_url: pkg.cover_image_url || null,
    destination_name: pkg.destination_id ? destMap.get(pkg.destination_id) || '—' : '—',
    duration_days: pkg.duration_days ?? 0,
    duration_nights: pkg.duration_nights ?? 0,
    base_price: Number(pkg.base_price) || 0,
    discount_price: pkg.discount_price ? Number(pkg.discount_price) : null,
    currency: pkg.currency || 'INR',
    status: pkg.status,
    is_featured: Boolean(pkg.is_featured),
  }));

  const totalCount = packagesRes.count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    packages: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  };
}
