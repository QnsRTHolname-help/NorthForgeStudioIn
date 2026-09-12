import { useEffect } from 'react';
import { SITE } from '@/data/site';

interface PageMeta {
  title: string;
  description?: string;
  /** Appended to the page title unless `exact` is set. */
  suffix?: boolean;
  noIndex?: boolean;
  canonicalPath?: string;
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Per-route SEO metadata (spec §94).
 * Sets title, description, canonical, robots, OpenGraph and Twitter tags.
 */
export function usePageMeta({ title, description, suffix = true, noIndex, canonicalPath }: PageMeta) {
  useEffect(() => {
    const fullTitle = suffix ? `${title} · ${SITE.name}` : title;
    document.title = fullTitle;

    if (description) upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', fullTitle);
    if (description) upsertMeta('property', 'og:description', description);
    upsertMeta('name', 'twitter:title', fullTitle);
    if (description) upsertMeta('name', 'twitter:description', description);

    const canonicalHref = `${SITE.url}${canonicalPath ?? window.location.pathname}`;
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalHref);
    upsertMeta('property', 'og:url', canonicalHref);

    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large');
  }, [title, description, suffix, noIndex, canonicalPath]);
}
