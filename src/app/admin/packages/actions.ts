'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { packageSchema, slugify, type PackageFormValues } from '@/lib/validations/package';
import { revalidatePath } from 'next/cache';
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
  await requireProfile(); // any logged-in staff can create a draft; publish gate is separate

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

  revalidatePath('/admin/packages');
  return { id: data.id };
}

export async function updatePackage(
  id: string,
  raw: PackageFormValues
): Promise<ActionState> {
  await requireProfile();
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

  revalidatePath('/admin/packages');
  revalidatePath(`/admin/packages/${id}`);
  if (before?.slug) revalidatePath(`/packages/${before.slug}`);
  return {};
}

async function setPackageStatus(id: string, status: 'draft' | 'published') {
  const profile = await requireProfile();
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

  revalidatePath('/admin/packages');
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

  revalidatePath('/admin/packages');
  revalidatePath('/');
  return {};
}

export async function duplicatePackage(id: string): Promise<ActionState & { id?: string }> {
  await requireProfile();
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

  revalidatePath('/admin/packages');
  return { id: created.id };
}

export async function deletePackage(id: string): Promise<ActionState> {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only admins can permanently delete a package.' };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('travel_packages')
    .select('*')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('travel_packages').delete().eq('id', id);
  if (error) {
    return { error: 'Could not delete the package. It may be referenced by an existing booking or enquiry — consider archiving instead.' };
  }

  await logActivity({
    action: 'package.deleted',
    entityType: 'travel_packages',
    entityId: id,
    beforeData: before,
  });

  revalidatePath('/admin/packages');
  return {};
}
