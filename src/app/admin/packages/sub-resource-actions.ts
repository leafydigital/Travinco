'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { itineraryDaySchema } from '@/lib/validations/package';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export async function replaceItineraryDay(
  packageId: string,
  dayId: string | null,
  raw: unknown
) {
  await requireProfile();
  const parsed = itineraryDaySchema.safeParse(raw);
  if (!parsed.success) return { error: 'Please check the itinerary day fields.' };

  const supabase = await createClient();
  const payload = { ...parsed.data, package_id: packageId };

  const { error } = dayId
    ? await supabase.from('package_itineraries').update(payload).eq('id', dayId)
    : await supabase.from('package_itineraries').insert(payload);

  if (error) {
    if (error.code === '23505') {
      return { error: `Day ${parsed.data.day_number} already exists for this package.` };
    }
    return { error: 'Could not save the itinerary day.' };
  }

  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

export async function deleteItineraryDay(packageId: string, dayId: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('package_itineraries').delete().eq('id', dayId);
  if (error) return { error: 'Could not delete the itinerary day.' };
  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

const itemSchema = z.object({ item: z.string().min(1).max(255) });

export async function addInclusion(packageId: string, raw: unknown) {
  await requireProfile();
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return { error: 'Item cannot be empty.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('package_inclusions')
    .insert({ package_id: packageId, item: parsed.data.item });
  if (error) return { error: 'Could not add inclusion.' };
  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

export async function removeInclusion(packageId: string, id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('package_inclusions').delete().eq('id', id);
  if (error) return { error: 'Could not remove inclusion.' };
  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

export async function addExclusion(packageId: string, raw: unknown) {
  await requireProfile();
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return { error: 'Item cannot be empty.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('package_exclusions')
    .insert({ package_id: packageId, item: parsed.data.item });
  if (error) return { error: 'Could not add exclusion.' };
  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

export async function removeExclusion(packageId: string, id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('package_exclusions').delete().eq('id', id);
  if (error) return { error: 'Could not remove exclusion.' };
  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

export async function addPackageImage(packageId: string, imageUrl: string, isCover: boolean) {
  await requireProfile();
  const supabase = await createClient();

  if (isCover) {
    // Only one cover image per package — clear any existing cover flag first.
    await supabase
      .from('package_images')
      .update({ is_cover: false })
      .eq('package_id', packageId);
  }

  // New images go to the end of the current order.
  const { count } = await supabase
    .from('package_images')
    .select('id', { count: 'exact', head: true })
    .eq('package_id', packageId);

  const { error } = await supabase
    .from('package_images')
    .insert({
      package_id: packageId,
      image_url: imageUrl,
      is_cover: isCover,
      sort_order: count ?? 0,
    });

  if (error) return { error: 'Could not add image.' };

  if (isCover) {
    await supabase
      .from('travel_packages')
      .update({ cover_image_url: imageUrl })
      .eq('id', packageId);
  }

  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

export async function setCoverImage(packageId: string, imageId: string, imageUrl: string) {
  await requireProfile();
  const supabase = await createClient();

  await supabase.from('package_images').update({ is_cover: false }).eq('package_id', packageId);
  const { error } = await supabase
    .from('package_images')
    .update({ is_cover: true })
    .eq('id', imageId);

  if (error) return { error: 'Could not set cover image.' };

  await supabase.from('travel_packages').update({ cover_image_url: imageUrl }).eq('id', packageId);

  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

/**
 * Moves one image up or down in display order by swapping sort_order
 * with its neighbor. Simple pairwise swap rather than a full reindex —
 * fine for the small number of images a travel package typically has.
 */
export async function reorderPackageImage(
  packageId: string,
  imageId: string,
  direction: 'up' | 'down'
) {
  await requireProfile();
  const supabase = await createClient();

  const { data: imagesData } = await supabase
    .from('package_images')
    .select('id, sort_order')
    .eq('package_id', packageId)
    .order('sort_order', { ascending: true });

  const images = (imagesData ?? []) as { id: string; sort_order: number }[];
  const index = images.findIndex((img) => img.id === imageId);
  if (index === -1) return { error: 'Image not found.' };

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= images.length) return {};

  const current = images[index];
  const neighbor = images[swapIndex];
  if (!current || !neighbor) return { error: 'Could not reorder images.' };

  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from('package_images').update({ sort_order: neighbor.sort_order }).eq('id', current.id),
    supabase.from('package_images').update({ sort_order: current.sort_order }).eq('id', neighbor.id),
  ]);

  if (err1 || err2) return { error: 'Could not reorder images.' };

  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

export async function removePackageImage(packageId: string, id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('package_images').delete().eq('id', id);
  if (error) return { error: 'Could not remove image.' };
  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

export async function addPackageVideo(packageId: string, videoUrl: string) {
  await requireProfile();
  const supabase = await createClient();

  const { count } = await supabase
    .from('package_videos')
    .select('id', { count: 'exact', head: true })
    .eq('package_id', packageId);

  const { error } = await supabase.from('package_videos').insert({
    package_id: packageId,
    video_url: videoUrl,
    sort_order: count ?? 0,
  });

  if (error) return { error: 'Could not add video.' };
  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

export async function removePackageVideo(packageId: string, id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('package_videos').delete().eq('id', id);
  if (error) return { error: 'Could not remove video.' };
  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}

/**
 * Moves one video up or down in display order by swapping sort_order
 * with its neighbor — same pairwise-swap approach as
 * reorderPackageImage above.
 */
export async function reorderPackageVideo(
  packageId: string,
  videoId: string,
  direction: 'up' | 'down'
) {
  await requireProfile();
  const supabase = await createClient();

  const { data: videosData } = await supabase
    .from('package_videos')
    .select('id, sort_order')
    .eq('package_id', packageId)
    .order('sort_order', { ascending: true });

  const videos = (videosData ?? []) as { id: string; sort_order: number }[];
  const index = videos.findIndex((v) => v.id === videoId);
  if (index === -1) return { error: 'Video not found.' };

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= videos.length) return {};

  const current = videos[index];
  const neighbor = videos[swapIndex];
  if (!current || !neighbor) return { error: 'Could not reorder videos.' };

  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from('package_videos').update({ sort_order: neighbor.sort_order }).eq('id', current.id),
    supabase.from('package_videos').update({ sort_order: current.sort_order }).eq('id', neighbor.id),
  ]);

  if (err1 || err2) return { error: 'Could not reorder videos.' };

  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}
