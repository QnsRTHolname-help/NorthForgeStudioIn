import { env } from '../env';

/**
 * Origin allowlisting.
 *
 * Two things need the same answer — CORS and (optionally) CSRF origin checks —
 * so the rule lives in one place:
 *
 *   1. exact matches from CLIENT_ORIGIN (comma separated)
 *   2. wildcard patterns, e.g. "https://*.vercel.app" or "*"
 *   3. in development, local hosts and sandbox/preview hosts over http OR https
 *
 * `https://*.e2b.app` matters: the workspace preview is served over HTTPS, and
 * a rule that only matched http produced opaque "origin not allowed" failures
 * on the very first request a user makes — logging in.
 */

const DEV_HOST_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https?:\/\/[\w-]+\.e2b\.app$/,
  /^https?:\/\/[\w-]+\.vercel\.app$/,
];

/**
 * Exported for tests — the single implementation of the matching rule.
 *
 * Wildcards are written as full origins, e.g. `https://*.vercel.app`, and
 * match exactly one extra label: `https://foo.vercel.app` matches, but
 * `https://a.b.vercel.app` and `https://vercel.app.evil.com` do not.
 */
export function matchesPattern(origin: string, pattern: string): boolean {
  if (pattern === '*') return true;

  if (pattern.includes('*.')) {
    let url: URL;
    let expected: URL;
    try {
      url = new URL(origin);
      expected = new URL(pattern.replace('*.', ''));
    } catch {
      return false;
    }
    if (url.protocol !== expected.protocol) return false;
    const suffix = expected.host;
    return url.host.endsWith(`.${suffix}`) && url.host.split('.').length === suffix.split('.').length + 1;
  }

  return origin === pattern;
}

export function isOriginAllowed(origin: string | undefined): boolean {
  // No Origin header: same-origin navigation, curl, health checks, monitors.
  if (!origin) return true;
  if (env.clientOrigin.some((pattern) => matchesPattern(origin, pattern))) return true;
  if (!env.isProd && DEV_HOST_PATTERNS.some((pattern) => pattern.test(origin))) return true;
  return false;
}
