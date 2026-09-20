import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INDEXABLE_ROUTES, ROUTES, SPA_REWRITES } from './routes';

/**
 * Guards the one seam that the prerenderer and the app share on trust.
 *
 * `scripts/prerender.mjs` bakes titles and descriptions from `shared/routes.ts`
 * into real per-route HTML, while the running app gets the same strings from
 * each page's own `usePageMeta(...)` call. Those are two copies of one fact.
 * If a page's title is edited without updating this table, the site would keep
 * serving the old title to every crawler that does not run JavaScript — silent,
 * and invisible in the browser. Reading the page sources back is the cheapest
 * way to make that drift fail a test instead.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readPage = (page: string) => fs.readFileSync(path.join(root, page), 'utf8');

describe('route manifest', () => {
  it('defines every route with the fields the build steps rely on', () => {
    for (const route of ROUTES) {
      expect(route.path.startsWith('/'), `${route.path} must start with /`).toBe(true);
      expect(route.title.length).toBeGreaterThan(0);
      expect(route.description.length).toBeGreaterThan(20);
      expect(route.page.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate paths', () => {
    const paths = ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps the title on the page that renders it in sync with this table', () => {
    for (const route of ROUTES) {
      const source = readPage(route.page);
      expect(source, `${route.page} should still set the title for ${route.path}`).toContain(
        route.title,
      );
    }
  });

  it('keeps indexable routes and noindex screens apart', () => {
    // An auth screen in the sitemap, or a marketing page excluded from it, is
    // the failure this whole table exists to prevent.
    for (const privatePath of ['/login', '/register', '/mfa', '/auth/callback', '/reset-password']) {
      expect(INDEXABLE_ROUTES.map((route) => route.path)).not.toContain(privatePath);
    }
    for (const publicPath of ['/', '/pricing', '/how-it-works', '/faq', '/contact']) {
      expect(INDEXABLE_ROUTES.map((route) => route.path)).toContain(publicPath);
    }
  });

  it('gives indexable routes sitemap hints and leaves the rest without them', () => {
    for (const route of INDEXABLE_ROUTES) {
      expect(route.priority, `${route.path} needs a priority`).toBeTruthy();
      expect(route.changefreq, `${route.path} needs a changefreq`).toBeTruthy();
    }
  });

  it('never rewrites a prerendered public route back to the SPA shell', () => {
    // If a public route were listed here it would shadow its own prerendered
    // file, and every crawler would get the empty shell again.
    for (const route of ROUTES) {
      expect(SPA_REWRITES).not.toContain(route.path);
      expect(SPA_REWRITES).not.toContain(`${route.path}/(.*)`);
    }
    expect(SPA_REWRITES).toContain('/app/(.*)');
    expect(SPA_REWRITES).toContain('/portal/(.*)');
  });
});
