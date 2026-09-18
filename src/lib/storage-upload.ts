import 'server-only';
import { createClient } from '@/lib/supabase/server';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Uploads a single image file to the given Storage bucket and returns
 * its public URL. Shared by every admin image-upload action (package
 * photos, destination cover images, gallery, etc.) so validation rules
 * and the file-naming scheme stay consistent in one place.
 */
export async function uploadImageToBucket(
  bucket: string,
  file: File
): Promise<{ url?: string; error?: string }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: 'Only JPG, PNG or WEBP images are allowed.' };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { error: 'Image is too large — please keep it under 8 MB.' };
  }

  const supabase = await createClient();
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: 'Could not upload the image. Please try again.' };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl };
}
