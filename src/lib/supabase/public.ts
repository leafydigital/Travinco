import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_CONTENT_TAG, PUBLIC_REVALIDATE_SECONDS } from '@/lib/public-cache';

/**
 * Cookie-free, read-only Supabase client for PUBLIC website content.
 *
 * Uses only the anon key (same visibility as a logged-out visitor) and never
 * reads cookies/headers, so its reads can be cached (Next Data Cache) and lets
 * public pages be statically generated / served from the CDN.
 *
 * Do NOT use for anything user-specific or for writes.
 */
// Intentionally untyped (like the other clients in src/lib/supabase).
let client: SupabaseClient<any, 'public', any> | null = null;

export function createPublicClient(): SupabaseClient<any, 'public', any> {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.');
  }

  client = createSupabaseClient<any, 'public', any>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      // Every public read goes through Next's Data Cache: refreshed in the background at
      // most every 60s, and purged instantly by revalidateTag(PUBLIC_CONTENT_TAG) on admin saves.
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          next: { revalidate: PUBLIC_REVALIDATE_SECONDS, tags: [PUBLIC_CONTENT_TAG] },
        } as RequestInit),
    },
  });
  return client;
}
