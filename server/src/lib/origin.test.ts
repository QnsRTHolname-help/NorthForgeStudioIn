import { describe, expect, it } from 'vitest';
import { isOriginAllowed, matchesPattern } from './origin';
import { env } from '../env';

/**
 * Origin allowlisting (the fix for "origin not allowed" on login).
 *
 * The preview is served over HTTPS, so a rule that only matched http://
 * rejected the very first request a user makes. These cases lock that in.
 */
describe('isOriginAllowed', () => {
  it('allows requests with no Origin header (same-origin, curl, monitors)', () => {
    expect(isOriginAllowed(undefined)).toBe(true);
  });

  it('allows the configured client origins', () => {
    expect(isOriginAllowed(env.clientOrigin[0]!)).toBe(true);
  });

  it('allows https preview hosts in development', () => {
    if (env.isProd) return; // rule only applies outside production
    expect(isOriginAllowed('https://5173-abc123.e2b.app')).toBe(true);
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(isOriginAllowed('https://northforgestudio.vercel.app')).toBe(true);
  });

  it('rejects unknown third-party origins', () => {
    expect(isOriginAllowed('https://evil.example')).toBe(false);
    expect(isOriginAllowed('https://attacker.io')).toBe(false);
  });

  it('matches wildcard patterns against a single label only', () => {
    expect(matchesPattern('https://northforge.vercel.app', 'https://*.vercel.app')).toBe(true);
    expect(matchesPattern('https://sub.northforge.vercel.app', 'https://*.vercel.app')).toBe(false);
    expect(matchesPattern('https://vercel.app.evil.com', 'https://*.vercel.app')).toBe(false);
    expect(matchesPattern('https://evil.example', 'https://*.vercel.app')).toBe(false);
  });

  it('treats a bare "*" as allow-all and an exact entry as exact', () => {
    expect(matchesPattern('https://anything.example', '*')).toBe(true);
    expect(matchesPattern('https://a.example', 'https://a.example')).toBe(true);
    expect(matchesPattern('https://b.example', 'https://a.example')).toBe(false);
  });
});
