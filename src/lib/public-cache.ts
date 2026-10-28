import { revalidatePath as nextRevalidatePath, revalidateTag } from 'next/cache';

/**
 * Shared cache layer for PUBLIC website content.
 *
 * - Every public read (createPublicClient) is tagged with PUBLIC_CONTENT_TAG.
 * - Entries refresh in the background at most every PUBLIC_REVALIDATE_SECONDS.
 * - Admin saves purge the tag immediately (see revalidatePath below).
 */
export const PUBLIC_CONTENT_TAG = 'public-content';
export const PUBLIC_REVALIDATE_SECONDS = 60;

/** Purges all cached public pages and data so admin changes appear immediately. */
export function revalidatePublicSite() {
  revalidateTag(PUBLIC_CONTENT_TAG);
  nextRevalidatePath('/', 'layout');
}

/**
 * Drop-in replacement for `revalidatePath` from 'next/cache', used by dashboard
 * actions that edit website content: revalidates the given path AND purges the
 * public content cache, so every existing save also refreshes the website.
 */
export function revalidatePath(...args: Parameters<typeof nextRevalidatePath>) {
  nextRevalidatePath(...args);
  revalidateTag(PUBLIC_CONTENT_TAG);
}
