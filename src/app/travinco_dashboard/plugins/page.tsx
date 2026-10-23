import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { PluginsClient } from './plugins-client';
import type { Plugin } from '@/types/database';

export const metadata: Metadata = {
  title: 'Plugins & Widgets — Travinco Admin',
  description: 'Manage third-party widgets and script integrations for the customer website.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPluginsPage() {
  const profile = await requireProfile();

  // Strict admin authorization: only admin and super_admin can configure plugins
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect('/travinco_dashboard?error=unauthorized');
  }

  // Fetch plugins list using authenticated staff client
  const supabase = await createClient();
  const { data: plugins, error } = await supabase
    .from('plugins')
    .select('*')
    .order('slot', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load plugins in AdminPluginsPage:', error.message);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PluginsClient initialPlugins={(plugins as Plugin[]) || []} />
    </div>
  );
}
