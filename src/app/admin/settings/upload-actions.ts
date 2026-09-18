'use server';

import { requireProfile } from '@/lib/supabase/auth-helpers';
import { uploadImageToBucket } from '@/lib/storage-upload';

const BUCKET = 'site-images';

export async function uploadLogoImage(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  await requireProfile();

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { error: 'No file received.' };
  }

  return uploadImageToBucket(BUCKET, file);
}
