/**
 * Optional analytics + search-engine verification (spec: SEO stack).
 *
 * Everything here is gated on environment variables and is a no-op when they
 * are unset — the app never ships a broken tag or calls a third party the
 * operator did not configure.
 *
 *   VITE_GA4_ID                    → Google Analytics 4 (G-XXXXXXXXXX)
 *   VITE_GOOGLE_SITE_VERIFICATION  → Google Search Console meta tag
 *
 * Set them per environment on Vercel (Production/Preview/Development).
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
  }
}

const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined;
const SITE_VERIFICATION = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION as string | undefined;

let initialised = false;

/** Inject the Search Console verification meta tag (idempotent). */
export function injectSeoVerification(): void {
  if (initialised || !SITE_VERIFICATION) return;
  initialised = true;
  const meta = document.createElement('meta');
  meta.name = 'google-site-verification';
  meta.content = SITE_VERIFICATION;
  document.head.appendChild(meta);
}

/** Inject the GA4 gtag.js loader. */
export function initAnalytics(): void {
  if (!GA4_ID || !/^G-[A-Z0-9]+$/i.test(GA4_ID)) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.dataLayer as any[]).push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID, { anonymize_ip: true });
}

/** Fire a page_view for SPA route changes (no full-page reloads happen). */
export function trackPageView(path: string): void {
  if (!GA4_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', { page_path: path, page_title: document.title });
}
