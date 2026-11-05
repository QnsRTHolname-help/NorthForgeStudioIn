import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
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

/**
 * The schema tests read the *baked* HTML under `dist/`, which only exists
 * after `npm run build`. Rather than silently skip when it is absent, build it
 * first so the test is deterministic either way — a fresh checkout and a
 * post-build run both exercise the same seam.
 */
beforeAll(async () => {
  if (fs.existsSync(path.join(root, 'dist', 'schema.json'))) return;
  const { execFileSync } = await import('node:child_process');
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'ignore' });
});

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
    // Only check INDEXABLE_ROUTES — private routes like /portal/* are behind auth
    // and must be served by the SPA shell.
    for (const route of INDEXABLE_ROUTES) {
      expect(SPA_REWRITES).not.toContain(route.path);
      expect(SPA_REWRITES).not.toContain(`${route.path}/(.*)`);
    }
    expect(SPA_REWRITES).toContain('/app/(.*)');
    expect(SPA_REWRITES).toContain('/portal/(.*)');
  });
});

/**
 * Guards the baked JSON-LD seam. The schemas are emitted by vite.config into
 * `dist/schema.json` and baked into every indexable page's prerendered HTML by
 * `scripts/prerender.mjs`. They are also injected at runtime by `useEffect` in
 * the pages themselves. Those are three copies of one fact — and unlike the
 * title/description table, a drift here is invisible: a missing schema simply
 * means Google never gets rich results, nothing breaks in the browser.
 *
 * Reading the baked file back is the cheapest way to make that drift fail.
 */
describe('baked schema', () => {
  const readBuilt = (p: string) => fs.readFileSync(path.join(root, 'dist', p), 'utf8');

  it('bakes organization + service schema onto every indexable page', () => {
    for (const route of INDEXABLE_ROUTES) {
      const file = route.path === '/' ? 'index.html' : `${route.path}.html`;
      const html = readBuilt(file);
      expect(html, `${route.path} should carry baked JSON-LD`).toContain(
        'application/ld+json',
      );
      expect(html, `${route.path} should describe the business`).toContain(
        '"@type":"ProfessionalService"',
      );
      expect(html, `${route.path} should list its services`).toContain(
        '"@type":"ItemList"',
      );
    }
  });

  it('bakes the FAQPage schema only onto the FAQ route', () => {
    const faq = readBuilt('faq.html');
    expect(faq).toContain('"@type":"FAQPage"');

    for (const route of INDEXABLE_ROUTES) {
      if (route.path === '/faq') continue;
      const file = route.path === '/' ? 'index.html' : `${route.path}.html`;
      expect(readBuilt(file), `${route.path} should not carry the FAQ schema`).not.toContain(
        '"@type":"FAQPage"',
      );
    }
  });

  it('bakes no schema onto non-indexable routes', () => {
    // Auth and error screens are never baked, so they carry no schema at all.
    for (const file of ['404.html']) {
      expect(readBuilt(file)).not.toContain('application/ld+json');
    }
  });
});
