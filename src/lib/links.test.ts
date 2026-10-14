import { describe, expect, it } from 'vitest';
import {
  AUTH_CALLBACK_PATH,
  CANONICAL_SITE_URL,
  canonicalUrl,
  isLocalHost,
  normalizeOrigin,
  publicOrigin,
  resolvePublicOrigin,
} from '@/lib/links';

describe('links & canonical URL generation', () => {
  describe('isLocalHost', () => {
    it('identifies localhost hostnames and loopback IPs correctly', () => {
      expect(isLocalHost('http://localhost')).toBe(true);
      expect(isLocalHost('http://localhost:5173')).toBe(true);
      expect(isLocalHost('http://127.0.0.1:3000')).toBe(true);
      expect(isLocalHost('http://[::1]:8080')).toBe(true);
      expect(isLocalHost('http://0.0.0.0:8000')).toBe(true);
      expect(isLocalHost('http://subdomain.localhost:5173')).toBe(true);
      expect(isLocalHost('localhost:5173')).toBe(true);
    });

    it('rejects public and production hostnames', () => {
      expect(isLocalHost('https://northforgestudioin.vercel.app')).toBe(false);
      expect(isLocalHost('https://customdomain.com')).toBe(false);
      expect(isLocalHost('https://staging.northforge.in')).toBe(false);
      expect(isLocalHost('')).toBe(false);
    });
  });

  describe('normalizeOrigin', () => {
    it('strips trailing slashes from origin', () => {
      expect(normalizeOrigin('https://northforgestudioin.vercel.app/')).toBe('https://northforgestudioin.vercel.app');
      expect(normalizeOrigin('https://northforgestudioin.vercel.app///')).toBe('https://northforgestudioin.vercel.app');
      expect(normalizeOrigin('https://northforgestudioin.vercel.app')).toBe('https://northforgestudioin.vercel.app');
    });
  });

  describe('resolvePublicOrigin', () => {
    it('returns canonical production URL when both configured and browser are localhost', () => {
      const origin = resolvePublicOrigin('http://localhost:5173', 'http://localhost:5173');
      expect(origin).toBe(CANONICAL_SITE_URL);
      expect(origin).not.toContain('localhost');
      expect(origin).not.toContain('127.0.0.1');
    });

    it('returns canonical production URL when inputs are empty or missing', () => {
      expect(resolvePublicOrigin('', '')).toBe(CANONICAL_SITE_URL);
      expect(resolvePublicOrigin(null, null)).toBe(CANONICAL_SITE_URL);
      expect(resolvePublicOrigin(undefined, undefined)).toBe(CANONICAL_SITE_URL);
    });

    it('returns configured production origin when configured with a non-localhost URL', () => {
      const configured = 'https://portal.mycustomdomain.com';
      expect(resolvePublicOrigin(configured, 'http://localhost:5173')).toBe(configured);
    });

    it('returns browser origin when served on a production or preview domain', () => {
      const preview = 'https://preview-12345.vercel.app';
      expect(resolvePublicOrigin('', preview)).toBe(preview);
    });

    it('prefers configured production origin over preview browser origin', () => {
      const configured = 'https://northforgestudioin.vercel.app';
      const preview = 'https://preview-12345.vercel.app';
      expect(resolvePublicOrigin(configured, preview)).toBe(configured);
    });

    it('allows local origin only when explicitly requested via allowLocal: true', () => {
      expect(resolvePublicOrigin('', 'http://localhost:5173', true)).toBe('http://localhost:5173');
      expect(resolvePublicOrigin('http://localhost:3000', '', true)).toBe('http://localhost:3000');
    });
  });

  describe('publicOrigin & canonicalUrl', () => {
    it('guarantees publicOrigin never returns localhost for email links', () => {
      const origin = publicOrigin();
      expect(origin).not.toContain('localhost');
      expect(origin).not.toContain('127.0.0.1');
      expect(origin).not.toContain('[::1]');
      expect(origin.startsWith('https://')).toBe(true);
    });

    it('builds canonicalUrl for auth callback pointing to production domain', () => {
      const url = canonicalUrl(AUTH_CALLBACK_PATH);
      expect(url).toBe(`${CANONICAL_SITE_URL}/auth/callback`);
      expect(url).not.toContain('localhost');
      expect(url).not.toContain('127.0.0.1');
    });

    it('handles routes with or without leading slashes identically', () => {
      expect(canonicalUrl('auth/callback')).toBe(`${CANONICAL_SITE_URL}/auth/callback`);
      expect(canonicalUrl('/auth/callback')).toBe(`${CANONICAL_SITE_URL}/auth/callback`);
    });

    it('builds canonicalUrl for password reset pointing to production domain', () => {
      const url = canonicalUrl('/reset-password');
      expect(url).toBe(`${CANONICAL_SITE_URL}/reset-password`);
      expect(url).not.toContain('localhost');
    });
  });
});
