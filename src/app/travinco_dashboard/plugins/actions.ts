'use server';

import 'server-only';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  pluginFormSchema,
  validateScriptHosts,
  MAX_PLUGIN_CODE_BYTES,
  findDuplicatePlugin,
} from '@/lib/plugins/validation';
import type { Plugin, PluginSlot } from '@/types/database';

/**
 * Ensures the caller is authenticated as an admin or super_admin.
 */
async function verifyAdminCaller() {
  const profile = await requireProfile();
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return { error: 'Unauthorized. Admin privileges are required to manage plugins.' };
  }
  return { profile };
}

/**
 * Returns an authenticated Supabase client using the admin session cookie,
 * with graceful fallback to service role client if configured.
 */
async function getAdminSupabase() {
  try {
    return await createClient();
  } catch {
    const { createServiceClient } = await import('@/lib/supabase/service');
    return createServiceClient();
  }
}

/**
 * Revalidates public pages and admin paths affected by plugin modifications.
 */
function revalidatePluginCaches() {
  try {
    revalidatePath('/');
    revalidatePath('/travinco_dashboard/plugins');
    revalidatePath('/admin/plugins');
  } catch (err) {
    console.warn('Revalidation warning:', err);
  }
}

/**
 * Fetches all plugins ordered by slot and display position.
 */
export async function getPlugins(): Promise<{ data: Plugin[]; error?: string }> {
  const auth = await verifyAdminCaller();
  if (auth.error) return { data: [], error: auth.error };

  const supabase = await getAdminSupabase();
  const { data, error } = await supabase
    .from('plugins')
    .select('*')
    .order('slot', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getPlugins error:', error.message);
    return { data: [], error: 'Failed to fetch plugins list from database.' };
  }

  return { data: (data as Plugin[]) || [] };
}

/**
 * Creates a new plugin record, ensuring no duplicate name or code already exists.
 */
export async function createPlugin(raw: unknown): Promise<{ error?: string; plugin?: Plugin }> {
  const auth = await verifyAdminCaller();
  if (auth.error) return { error: auth.error };

  const parsed = pluginFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid plugin form data.' };
  }

  // Validation of script code (guards against dangerous schemes)
  const hostCheck = validateScriptHosts(parsed.data.code);
  if (!hostCheck.valid) {
    return { error: hostCheck.error || 'Invalid or dangerous script code detected.' };
  }

  const supabase = await getAdminSupabase();

  // Guard against duplicate plugins (name or identical code)
  const { data: existingPlugins } = await supabase
    .from('plugins')
    .select('id, name, code, slot');

  const dupCheck = findDuplicatePlugin(
    (existingPlugins as Plugin[]) || [],
    { name: parsed.data.name, code: parsed.data.code }
  );

  if (dupCheck.isDuplicate) {
    return { error: dupCheck.message || 'A plugin with this name or widget code already exists.' };
  }

  const { data, error } = await supabase
    .from('plugins')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      code: parsed.data.code,
      slot: parsed.data.slot,
      position: parsed.data.position,
      active: parsed.data.active,
    })
    .select('*')
    .single();

  if (error) {
    console.error('createPlugin error:', error.message);
    return { error: 'Could not save the new plugin to the database.' };
  }

  revalidatePluginCaches();
  return { plugin: data as Plugin };
}

/**
 * Updates an existing plugin record, ensuring changes don't collide with other plugins.
 */
export async function updatePlugin(
  id: number,
  raw: unknown
): Promise<{ error?: string; plugin?: Plugin }> {
  const auth = await verifyAdminCaller();
  if (auth.error) return { error: auth.error };

  if (!id || typeof id !== 'number') {
    return { error: 'Invalid plugin ID.' };
  }

  const parsed = pluginFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid plugin form data.' };
  }

  const hostCheck = validateScriptHosts(parsed.data.code);
  if (!hostCheck.valid) {
    return { error: hostCheck.error || 'Invalid or dangerous script code detected.' };
  }

  const supabase = await getAdminSupabase();

  // Guard against collision with other plugins
  const { data: existingPlugins } = await supabase
    .from('plugins')
    .select('id, name, code, slot');

  const dupCheck = findDuplicatePlugin(
    (existingPlugins as Plugin[]) || [],
    { name: parsed.data.name, code: parsed.data.code },
    id
  );

  if (dupCheck.isDuplicate) {
    return { error: dupCheck.message || 'Another plugin already uses this name or widget code.' };
  }

  const { data, error } = await supabase
    .from('plugins')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      code: parsed.data.code,
      slot: parsed.data.slot,
      position: parsed.data.position,
      active: parsed.data.active,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('updatePlugin error:', error.message);
    return { error: 'Could not update plugin.' };
  }

  revalidatePluginCaches();
  return { plugin: data as Plugin };
}

/**
 * Toggles a plugin's active status (activate / deactivate).
 */
export async function togglePluginStatus(
  id: number,
  active: boolean
): Promise<{ error?: string }> {
  const auth = await verifyAdminCaller();
  if (auth.error) return { error: auth.error };

  const supabase = await getAdminSupabase();
  const { error } = await supabase
    .from('plugins')
    .update({ active })
    .eq('id', id);

  if (error) {
    console.error('togglePluginStatus error:', error.message);
    return { error: 'Could not change plugin status.' };
  }

  revalidatePluginCaches();
  return {};
}

/**
 * Permanently deletes a plugin.
 */
export async function deletePlugin(id: number): Promise<{ error?: string }> {
  const auth = await verifyAdminCaller();
  if (auth.error) return { error: auth.error };

  const supabase = await getAdminSupabase();
  const { error } = await supabase
    .from('plugins')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('deletePlugin error:', error.message);
    return { error: 'Could not delete plugin.' };
  }

  revalidatePluginCaches();
  return {};
}

export interface PluginTableItem {
  id: number;
  name: string;
  description: string | null;
  slot: PluginSlot;
  position: number;
  active: boolean;
  created_at: string;
}

export interface PluginsTableQueryResult {
  plugins: PluginTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

/**
 * Fast, lean query fetching strictly the 5 display columns:
 * Plugin / Widget (name, description), Slot, Position, Status, Created (+ id).
 * Excludes heavy widget 'code' HTML/JS snippets.
 */
export async function getPluginsTableList({
  page = 1,
  pageSize = 20,
  q = '',
  slot = 'all',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  slot?: string;
} = {}): Promise<PluginsTableQueryResult> {
  const auth = await verifyAdminCaller();
  if (auth.error) {
    return { plugins: [], totalCount: 0, totalPages: 1, page: 1, pageSize };
  }

  const supabase = await getAdminSupabase();

  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('plugins')
    .select('id, name, description, slot, position, active, created_at', { count: 'exact' })
    .order('slot', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });

  if (slot && slot !== 'all') {
    query = query.eq('slot', slot as PluginSlot);
  }

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error('getPluginsTableList error:', error.message);
    return { plugins: [], totalCount: 0, totalPages: 1, page: currentPage, pageSize };
  }

  const totalCount = count ?? (data?.length || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    plugins: (data as PluginTableItem[]) || [],
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  };
}

/**
 * Fetches the full plugin details including raw code on demand (used when opening the edit modal).
 */
export async function getPluginById(id: number): Promise<{ plugin?: Plugin; error?: string }> {
  const auth = await verifyAdminCaller();
  if (auth.error) return { error: auth.error };

  if (!id || typeof id !== 'number') {
    return { error: 'Invalid plugin ID.' };
  }

  const supabase = await getAdminSupabase();
  const { data, error } = await supabase
    .from('plugins')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('getPluginById error:', error?.message);
    return { error: 'Could not fetch plugin details.' };
  }

  return { plugin: data as Plugin };
}

