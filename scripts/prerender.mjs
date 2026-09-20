/**
 * Bakes per-route head tags into real HTML files after a build.
 *
 * The app is client-rendered, so `dist/index.html` is an empty `<div id="root">`
 * with one hard-coded set of tags. Everything a crawler or a link-preview bot
 * would want per page is written by JavaScript, which only Googlebot reliably
 * runs — WhatsApp, LinkedIn, AI crawlers and anything else that fetches raw
 * HTML saw the same homepage tags on every URL.
 *
 * For each public route this writes `dist/<slug>.html` containing that route's
 * title, description, canonical, robots and social tags. Vercel serves those
 * with `cleanUrls: true`, so `/pricing` returns real HTML with a 200 and no
 * redirect. `dist/404.html` is what Vercel serves (with a 404 status) for any
 * URL that matches neither a file nor a rewrite, which is what stops the site
 * emitting soft 404s.
 *
 * The route table comes from `dist/route-meta.json`, emitted by vite.config
 * from `shared/routes.ts` — one source of truth shared with the sitemap.
 *
 *   node scripts/prerender.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const SITE_URL = (process.env.SITE_URL ?? 'https://northforgestudio.vercel.app').replace(/\/$/, '');
const BRAND = 'NorthForge';
const OG_IMAGE = `${SITE_URL}/og.png`;

const START = '<!-- nf:meta:start -->';
const END = '<!-- nf:meta:end -->';

const metaPath = path.join(dist, 'route-meta.json');
if (!fs.existsSync(metaPath)) {
  // Better to stop the deploy than to ship a build whose routes have no head
  // tags — the whole point of this step.
  console.error('✗ dist/route-meta.json is missing — run `vite build` before the prerender step.');
  process.exit(1);
}

const shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const { routes } = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

const startAt = shell.indexOf(START);
const endAt = shell.indexOf(END);
if (startAt === -1 || endAt === -1) {
  console.error(`✗ dist/index.html has no ${START} … ${END} block to replace.`);
  process.exit(1);
}

const before = shell.slice(0, startAt);
const after = shell.slice(endAt + END.length);

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The `<head>` block for one route. `canonical: false` omits self-referencing tags. */
function head({ title, description, index }, canonical) {
  const fullTitle = `${title} · ${BRAND}`;
  const tags = [
    `    <title>${escapeHtml(fullTitle)}</title>`,
    `    <meta name="description" content="${escapeHtml(description)}" />`,
    `    <meta name="robots" content="${index ? 'index,follow,max-image-preview:large' : 'noindex,nofollow'}" />`,
  ];

  if (canonical) {
    tags.push(`    <link rel="canonical" href="${escapeHtml(canonical)}" />`);
  }

  tags.push(
    `    <meta property="og:type" content="website" />`,
    `    <meta property="og:site_name" content="${BRAND}" />`,
    `    <meta property="og:title" content="${escapeHtml(fullTitle)}" />`,
    `    <meta property="og:description" content="${escapeHtml(description)}" />`,
  );

  if (canonical) tags.push(`    <meta property="og:url" content="${escapeHtml(canonical)}" />`);

  tags.push(
    // Absolute: scrapers do not resolve a relative path against the page URL.
    `    <meta property="og:image" content="${OG_IMAGE}" />`,
    `    <meta property="og:image:width" content="1200" />`,
    `    <meta property="og:image:height" content="630" />`,
    `    <meta property="og:image:alt" content="${BRAND} — web, automation, AI and growth systems" />`,
    `    <meta property="og:locale" content="en_IN" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    `    <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />`,
    `    <meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `    <meta name="twitter:image" content="${OG_IMAGE}" />`,
  );

  return `${START}\n${tags.join('\n')}\n    ${END}`;
}

const render = (route, canonical) => before + head(route, canonical) + after;

const urlFor = (routePath) => (routePath === '/' ? `${SITE_URL}/` : `${SITE_URL}${routePath}`);

let written = 0;
for (const route of routes) {
  const html = render(route, urlFor(route.path));
  const target =
    route.path === '/' ? path.join(dist, 'index.html') : path.join(dist, `${route.path}.html`);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
  written += 1;
}

/* Vercel serves this with a real 404 status for anything unmatched. */
fs.writeFileSync(
  path.join(dist, '404.html'),
  render(
    {
      title: 'Page not found',
      description: 'That page does not exist on the NorthForge site.',
      index: false,
    },
    false,
  ),
);

console.log(`✓ prerendered ${written} routes + dist/404.html · SITE_URL=${SITE_URL}`);
