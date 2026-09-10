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

  const { error } = await supabase
    .from('package_images')
    .insert({ package_id: packageId, image_url: imageUrl, is_cover: isCover });

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

export async function removePackageImage(packageId: string, id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('package_images').delete().eq('id', id);
  if (error) return { error: 'Could not remove image.' };
  revalidatePath(`/admin/packages/${packageId}`);
  return {};
}
