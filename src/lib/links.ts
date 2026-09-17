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

const CONFIGURED = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() ?? '';

function isLocalHost(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

/** Public origin for links we email: e.g. `https://northforgestudio.vercel.app`. */
export function publicOrigin(): string {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // A local browser wins: a developer testing locally must receive a
  // link they can actually open.
  if (browserOrigin && isLocalHost(browserOrigin)) return browserOrigin;

  // Otherwise the configured production origin is authoritative.
  if (CONFIGURED && !isLocalHost(CONFIGURED)) return CONFIGURED.replace(/\/+$/, '');

  return (browserOrigin || CONFIGURED).replace(/\/+$/, '');
}

/** Absolute URL for a route: `canonicalUrl('/auth/callback')`. */
export function canonicalUrl(path = '/'): string {
  const origin = publicOrigin();
  const route = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${route}`;
}

/** Where Supabase should send people after they click an emailed link. */
export const AUTH_CALLBACK_PATH = '/auth/callback';
