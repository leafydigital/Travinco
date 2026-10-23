import { z } from 'zod';
import type { PluginSlot } from '@/types/database';

/**
 * Allowed script hosts list (empty/unrestricted: Travelpayouts and affiliate widgets load from arbitrary partner CDNs).
 */
export const ALLOWED_SCRIPT_HOSTS: readonly string[] = [];

/**
 * Normalizes code snippet for duplicate comparison:
 * Unifies CRLF to LF, collapses consecutive whitespace, and converts to lowercase.
 */
export function normalizePluginCode(code: string): string {
  if (!code) return '';
  return code
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Checks whether a plugin with identical name or code already exists in the given collection.
 * Skips the plugin currently being edited (currentId).
 */
export function findDuplicatePlugin<T extends { id: number; name: string; code: string; slot: string }>(
  items: T[],
  current: { name: string; code: string },
  currentId?: number | null
): { isDuplicate: boolean; reason?: 'name' | 'code'; matchedPlugin?: T; message?: string } {
  const normName = current.name.trim().toLowerCase();
  const normCode = normalizePluginCode(current.code);

  for (const item of items) {
    if (currentId != null && item.id === currentId) {
      continue; // Skip self when editing
    }

    if (normName && item.name.trim().toLowerCase() === normName) {
      return {
        isDuplicate: true,
        reason: 'name',
        matchedPlugin: item,
        message: `A plugin with the name "${item.name}" already exists in slot "${item.slot}". Please choose a distinct name.`,
      };
    }

    if (normCode && normCode.length > 20 && normalizePluginCode(item.code) === normCode) {
      return {
        isDuplicate: true,
        reason: 'code',
        matchedPlugin: item,
        message: `This exact widget code is already installed as "${item.name}" in slot "${item.slot}".`,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Maximum allowed code size in bytes (100 KB limit).
 */
export const MAX_PLUGIN_CODE_BYTES = 100 * 1024; // 100 KB

export const VALID_PLUGIN_SLOTS: readonly PluginSlot[] = [
  'home-top',
  'home-middle',
  'home-bottom',
];

/**
 * Validates script code for basic safety (rejects dangerous schemes like javascript: or vbscript:).
 * All valid external script hosts and CDNs (Travelpayouts and partners) are allowed without restriction.
 */
export function validateScriptHosts(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: true };
  }

  // Regex to extract the `src` attribute from any <script ...> tag
  const scriptTagRegex = /<script\b([^>]*)>/gi;
  const srcAttrRegex = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = scriptTagRegex.exec(code)) !== null) {
    const attributes = tagMatch[1] || '';
    const srcMatch = srcAttrRegex.exec(attributes);
    if (!srcMatch) {
      // Inline scripts are allowed
      continue;
    }

    const rawSrc = (srcMatch[1] || srcMatch[2] || srcMatch[3] || '').trim();
    if (!rawSrc) continue;

    // Reject dangerous URI schemes
    const lowerSrc = rawSrc.toLowerCase();
    if (lowerSrc.startsWith('javascript:') || lowerSrc.startsWith('vbscript:')) {
      return {
        valid: false,
        error: `Dangerous script source scheme detected: "${rawSrc}".`,
      };
    }
  }

  return { valid: true };
}

export const pluginFormSchema = z.object({
  name: z.string().trim().min(1, 'Plugin name is required').max(150, 'Name too long'),
  description: z.string().trim().max(500, 'Description too long').optional().nullable(),
  slot: z.enum(['home-top', 'home-middle', 'home-bottom'], {
    errorMap: () => ({ message: 'Slot must be one of: home-top, home-middle, home-bottom' }),
  }),
  position: z.coerce.number().int().default(0),
  code: z
    .string()
    .trim()
    .min(1, 'Plugin code is required')
    .refine(
      (val) => new TextEncoder().encode(val).length <= MAX_PLUGIN_CODE_BYTES,
      `Code size must not exceed ${MAX_PLUGIN_CODE_BYTES / 1024} KB`
    )
    .refine((val) => {
      const check = validateScriptHosts(val);
      return check.valid;
    }, {
      message: 'Invalid script code detected.',
    }),
  active: z.boolean().default(true),
});

export type PluginFormData = z.infer<typeof pluginFormSchema>;
