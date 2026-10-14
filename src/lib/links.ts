/**
 * Absolute links for everything we send OUTSIDE the browser tab — email
 * confirmation, password reset, invite links (spec: links must never
 * depend on which machine happened to trigger them).
 *
 * Why this exists: auth emails used to be built from
 * `window.location.origin`. Sign up while testing on
 * `http://localhost:5173` and the CUSTOMER then receives a link to
 * localhost — a dead link on their phone. Equally, a deployment whose
 * Supabase "Site URL" is still localhost falls back there for any
 * redirect that is not allow-listed.
 *
 * Rule: prefer an explicitly configured public origin (VITE_SITE_URL);
 * otherwise use the origin the app is actually served from.
 */

export const CANONICAL_SITE_URL = 'https://northforgestudioin.vercel.app';

const CONFIGURED = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() ?? '';

export function isLocalHost(value: string): boolean {
  if (!value) return false;
  try {
    const target = value.includes('://') ? value : `http://${value}`;
    const { hostname } = new URL(target);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

export function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Pure function to resolve public origin from configured and browser inputs.
 * Guaranteed to never return localhost unless allowLocal is explicitly true.
 */
export function resolvePublicOrigin(
  configuredInput?: string | null,
  browserOriginInput?: string | null,
  allowLocal = false,
): string {
  const configured = configuredInput ? normalizeOrigin(configuredInput.trim()) : '';
  const browserOrigin = browserOriginInput ? normalizeOrigin(browserOriginInput.trim()) : '';

  const configuredIsLocal = !configured || isLocalHost(configured);
  const browserIsLocal = !browserOrigin || isLocalHost(browserOrigin);

  // 1. Explicitly configured non-localhost origin is authoritative
  if (!configuredIsLocal) return configured;

  // 2. Real non-localhost browser origin (e.g. preview deployment or custom production domain)
  if (browserOrigin && !browserIsLocal) return browserOrigin;

  // 3. If local origins are explicitly allowed (e.g. internal dev-only tooling)
  if (allowLocal) {
    if (browserOrigin) return browserOrigin;
    if (configured) return configured;
  }

  // 4. Default for out-of-band emails: ALWAYS canonical production URL
  return CANONICAL_SITE_URL;
}

/** Public origin for links we email: e.g. `https://northforgestudio.vercel.app`. */
export function publicOrigin(options?: { allowLocal?: boolean }): string {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  return resolvePublicOrigin(CONFIGURED, browserOrigin, options?.allowLocal ?? false);
}

/** Absolute URL for a route: `canonicalUrl('/auth/callback')`. */
export function canonicalUrl(path = '/', options?: { allowLocal?: boolean }): string {
  const origin = publicOrigin(options);
  const route = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${route}`;
}

/** Where Supabase should send people after they click an emailed link. */
export const AUTH_CALLBACK_PATH = '/auth/callback';

