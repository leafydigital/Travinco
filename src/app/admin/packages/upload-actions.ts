'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';

const BUCKET = 'package-images';
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function uploadPackageImage(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  await requireProfile();

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { error: 'No file received.' };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Only JPG, PNG or WEBP images are allowed.' };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { error: 'Image is too large — please keep it under 8 MB.' };
  }

  const supabase = await createClient();
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: 'Could not upload the image. Please try again.' };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
