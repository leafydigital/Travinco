'use server';

import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { uploadImageToBucket } from '@/lib/storage-upload';

const BUCKET = 'gallery-images';

export async function uploadGalleryImage(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'gallery', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to upload gallery images.' };

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { error: 'No file received.' };
  }

  return uploadImageToBucket(BUCKET, file);
}
