/**
 * Authentication parameters as they were when the app BOOTED.
 *
 * Both Supabase and the self-hosted API report link problems in the URL —
 * in the query string (`?error=…&error_code=otp_expired`) or the fragment
 * (`#error=…`). Two things then race whoever wants to read them:
 *
 *   1. `AuthUrlErrorHandler` scrubs the parameters the moment React mounts,
 *      so a refresh or a shared URL never replays the error.
 *   2. `/auth/callback` is a lazy chunk: it mounts AFTER that first effect,
 *      by which time the address bar is already clean.
 *
 * Capturing the values once, at module-evaluation time (this module is pulled
 * into the main bundle by the error handler), makes both readers see the same
 * truth no matter when they run.
 */

function paramsFrom(search: string): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams('');
  return new URLSearchParams(search);
}

const bootQuery = paramsFrom(window.location.search);
const bootHash = paramsFrom(window.location.hash.replace(/^#/, ''));

export const initialAuthUrl = {
  query: bootQuery,
  hash: bootHash,
  /** First value found for a key, query string first, then fragment. */
  get(key: string): string | null {
    return bootQuery.get(key) ?? bootHash.get(key);
  },
  has(key: string): boolean {
    return bootQuery.has(key) || bootHash.has(key);
  },
} as const;

/** True when a link problem is a timeout/reuse rather than tampering. */
export function looksExpired(...parts: (string | null | undefined)[]): boolean {
  return /expired|invalid or has expired|otp_expired/i.test(parts.filter(Boolean).join(' '));
}

/** True when the URL carries an auth failure at all. */
export function hasAuthUrlError(): boolean {
  return Boolean(initialAuthUrl.get('error'));
}
