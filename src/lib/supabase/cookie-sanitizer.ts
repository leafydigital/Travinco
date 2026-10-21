import type { CookieOptions } from '@supabase/ssr';

export interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

const BASE64_PREFIX = 'base64-';

/**
 * Sanitizes cookies to ensure that Supabase auth cookies do not leak
 * or store bulky session details (identities, user_metadata, app_metadata, weak_password, etc.).
 *
 * Keeps ONLY:
 * - access_token
 * - refresh_token
 * - expires_at
 * - role
 */
export function sanitizeCookies(cookiesToSet: CookieToSet[], defaultRole?: string): CookieToSet[] {
  const authCookieRegex = /^sb-[^.]+-auth-token(?:\.\d+)?$/;

  const hasAuthCookie = cookiesToSet.some((c) => authCookieRegex.test(c.name));
  if (!hasAuthCookie) {
    return cookiesToSet;
  }

  // Separate non-auth cookies from auth cookies
  const nonAuthCookies = cookiesToSet.filter((c) => !authCookieRegex.test(c.name));
  const groups = new Map<string, CookieToSet[]>();

  for (const cookie of cookiesToSet) {
    if (!authCookieRegex.test(cookie.name)) continue;
    const match = cookie.name.match(/^(sb-[^.]+-auth-token)(?:\.(\d+))?$/);
    const baseKey = match?.[1];
    if (!baseKey) {
      nonAuthCookies.push(cookie);
      continue;
    }
    if (!groups.has(baseKey)) {
      groups.set(baseKey, []);
    }
    groups.get(baseKey)!.push(cookie);
  }

  const result: CookieToSet[] = [...nonAuthCookies];

  for (const [baseAuthKey, groupCookies] of groups.entries()) {
    // Check if there are any non-empty auth cookies with values being set for this baseAuthKey
    const authCookiesWithValues = groupCookies.filter(
      (c) => c.value && (!c.options || c.options.maxAge !== 0)
    );

    // If there are no auth cookies with values being set, it is a pure deletion/sign-out
    if (authCookiesWithValues.length === 0) {
      result.push(...groupCookies);
      continue;
    }

    const authCookieOptions = authCookiesWithValues[0]?.options;

    const chunkMap = new Map<number, string>();
    let nonChunkedValue: string | null = null;

    for (const cookie of groupCookies) {
      const match = cookie.name.match(/^(sb-[^.]+-auth-token)(?:\.(\d+))?$/);
      if (!match) continue;
      const chunkIndex = match[2];

      if (chunkIndex !== undefined) {
        chunkMap.set(parseInt(chunkIndex, 10), cookie.value);
      } else {
        nonChunkedValue = cookie.value;
      }
    }

    let fullRawValue = '';
    if (nonChunkedValue) {
      fullRawValue = nonChunkedValue;
    } else if (chunkMap.size > 0) {
      const sortedIndices = Array.from(chunkMap.keys()).sort((a, b) => a - b);
      fullRawValue = sortedIndices.map((i) => chunkMap.get(i) || '').join('');
    }

    if (!fullRawValue) {
      result.push(...groupCookies);
      continue;
    }

    try {
      let jsonStr = fullRawValue;
      let isBase64 = false;

      if (jsonStr.startsWith(BASE64_PREFIX)) {
        isBase64 = true;
        const base64Body = jsonStr.substring(BASE64_PREFIX.length);
        jsonStr = Buffer.from(base64Body, 'base64url').toString('utf8');
      }

      const sessionObj = JSON.parse(jsonStr);

      if (sessionObj && typeof sessionObj === 'object' && 'access_token' in sessionObj) {
        const slimSession = {
          access_token: sessionObj.access_token,
          refresh_token: sessionObj.refresh_token,
          expires_at: sessionObj.expires_at,
          role: sessionObj.role ?? defaultRole ?? sessionObj.user?.role ?? 'authenticated',
        };

        let sanitizedValue = JSON.stringify(slimSession);
        if (isBase64) {
          sanitizedValue = BASE64_PREFIX + Buffer.from(sanitizedValue).toString('base64url');
        }

        const defaultOpts: CookieOptions = {
          path: '/',
          sameSite: 'lax',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          ...authCookieOptions,
        };

        // 1. Emit strictly ONE cookie chunk (.0) containing ONLY the sanitized slim session
        result.push({
          name: `${baseAuthKey}.0`,
          value: sanitizedValue,
          options: defaultOpts,
        });

        // 2. Explicitly delete the unchunked base cookie to prevent duplicate cookies in browser
        result.push({
          name: baseAuthKey,
          value: '',
          options: {
            ...defaultOpts,
            maxAge: 0,
          },
        });

        // 3. Explicitly delete any extra legacy chunks (.1 to .4)
        for (let i = 1; i <= 4; i++) {
          result.push({
            name: `${baseAuthKey}.${i}`,
            value: '',
            options: {
              ...defaultOpts,
              maxAge: 0,
            },
          });
        }
      } else {
        result.push(...groupCookies);
      }
    } catch {
      result.push(...groupCookies);
    }
  }

  return result;
}
