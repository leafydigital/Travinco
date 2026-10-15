'use server';

import { requireProfile } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { PAGE_CATALOG } from '@/lib/admin-pages';

/**
 * Saves granular page access permissions for a specific staff member.
 * Only accessible to admin and super_admin users.
 *
 * Each selected page key is saved with can_view: true, can_edit: true.
 * If 0 pages are selected, a sentinel record is stored to enforce an empty
 * whitelist (all pages hidden).
 */
export async function saveStaffPagePermissions(
  targetProfileId: string,
  pageKeys: string[]
): Promise<{ success?: boolean; error?: string }> {
  try {
    const caller = await requireProfile();
    if (caller.role !== 'admin' && caller.role !== 'super_admin') {
      return { error: 'Unauthorized: Only administrators can manage page access.' };
    }

    if (!targetProfileId) {
      return { error: 'Invalid staff profile ID.' };
    }

    const supabase = await createClient();

    // Verify target profile exists
    const { data: targetProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', targetProfileId)
      .single();

    if (profileErr || !targetProfile) {
      return { error: 'Target staff member not found.' };
    }

    // Safety: Super admin accounts cannot have their access restricted
    if (targetProfile.role === 'super_admin') {
      return { error: 'Super Admin permissions cannot be restricted.' };
    }

    // Admins can only configure other staff, not demote other admins unless super_admin
    if (targetProfile.role === 'admin' && caller.role !== 'super_admin') {
      return { error: 'Only Super Admin can configure permissions for Admin users.' };
    }

    // Filter valid page keys from catalog
    const validKeys = PAGE_CATALOG.map((p) => p.key);
    const sanitizedKeys = Array.from(new Set(pageKeys.filter((k) => validKeys.includes(k))));

    // Delete existing permissions for this profile
    const { error: deleteErr } = await supabase
      .from('staff_permissions')
      .delete()
      .eq('profile_id', targetProfileId);

    if (deleteErr) {
      console.error('Error clearing staff permissions:', deleteErr);
      return { error: 'Failed to update permissions in database.' };
    }

    // Build new rows
    if (sanitizedKeys.length > 0) {
      const rows = sanitizedKeys.map((key) => ({
        profile_id: targetProfileId,
        module: key,
        can_view: true,
        can_edit: true,
      }));

      const { error: insertErr } = await supabase
        .from('staff_permissions')
        .insert(rows);

      if (insertErr) {
        // If Postgres has not yet altered the module column from admin_module enum to text
        const isEnumConstraint =
          insertErr.code === '22P02' ||
          insertErr.message?.toLowerCase().includes('admin_module') ||
          insertErr.message?.toLowerCase().includes('enum');

        if (isEnumConstraint) {
          // 1. Insert only the subset of modules that match the legacy enum
          const LEGACY_MODULE_ENUMS = [
            'packages',
            'destinations',
            'enquiries',
            'offers',
            'gallery',
            'blog',
            'settings',
            'users',
          ];
          const legacyRows = sanitizedKeys
            .filter((k) => LEGACY_MODULE_ENUMS.includes(k))
            .map((key) => ({
              profile_id: targetProfileId,
              module: key,
              can_view: true,
              can_edit: true,
            }));

          if (legacyRows.length > 0) {
            await supabase.from('staff_permissions').insert(legacyRows);
          } else {
            // Keep at least one record to denote custom permissions
            await supabase.from('staff_permissions').insert([
              {
                profile_id: targetProfileId,
                module: 'packages',
                can_view: false,
                can_edit: false,
              },
            ]);
          }

          // 2. Persist the complete list of all granted page keys in website_settings
          await supabase.from('website_settings').upsert(
            {
              key: `staff_perms_${targetProfileId}`,
              value: { pages: sanitizedKeys },
            },
            { onConflict: 'key' }
          );
        } else {
          console.error('Error inserting staff permissions:', insertErr);
          return { error: 'Failed to save selected page permissions: ' + insertErr.message };
        }
      } else {
        // Successfully inserted directly into staff_permissions; sync website_settings
        await supabase.from('website_settings').upsert(
          {
            key: `staff_perms_${targetProfileId}`,
            value: { pages: sanitizedKeys },
          },
          { onConflict: 'key' }
        );
      }
    } else {
      // Store sentinel row so getStaffPermissions returns > 0 rows, activating strict empty whitelist
      try {
        await supabase.from('staff_permissions').insert([
          {
            profile_id: targetProfileId,
            module: '__none__',
            can_view: false,
            can_edit: false,
          },
        ]);
      } catch {
        // Ignored if __none__ not in legacy enum
      }

      await supabase.from('website_settings').upsert(
        {
          key: `staff_perms_${targetProfileId}`,
          value: { pages: [] },
        },
        { onConflict: 'key' }
      );
    }

    revalidatePath('/travinco_dashboard', 'layout');
    revalidatePath('/travinco_dashboard/role-management/page-access');
    return { success: true };
  } catch (err) {
    console.error('Exception in saveStaffPagePermissions:', err);
    return { error: err instanceof Error ? err.message : 'Unknown server error.' };
  }
}

/**
 * Resets a staff member's permissions back to their default role baseline.
 */
export async function resetStaffPagePermissions(
  targetProfileId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const caller = await requireProfile();
    if (caller.role !== 'admin' && caller.role !== 'super_admin') {
      return { error: 'Unauthorized: Only administrators can reset page access.' };
    }

    const supabase = await createClient();
    const { error: deleteErr } = await supabase
      .from('staff_permissions')
      .delete()
      .eq('profile_id', targetProfileId);

    // Also remove any custom overrides in website_settings
    await supabase
      .from('website_settings')
      .delete()
      .eq('key', `staff_perms_${targetProfileId}`);

    if (deleteErr) {
      return { error: 'Failed to reset permissions.' };
    }

    revalidatePath('/travinco_dashboard', 'layout');
    revalidatePath('/travinco_dashboard/role-management/page-access');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}
