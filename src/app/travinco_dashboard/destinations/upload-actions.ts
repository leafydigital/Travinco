'use server';

import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { uploadImageToBucket } from '@/lib/storage-upload';

const BUCKET = 'destination-images';

export async function uploadDestinationImage(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'destinations', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to upload destination images.' };

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { error: 'No file received.' };
  }

  return uploadImageToBucket(BUCKET, file);
}
