/**
 * Optional analytics + search-engine verification (spec: SEO stack, §38–§46).
 *
 * Everything here is gated on environment variables and is a no-op when they
 * are unset — the app never ships a broken tag or calls a third party the
 * operator did not configure.
 *
 *   VITE_GA4_ID                    → Google Analytics 4 (G-XXXXXXXXXX)
 *   VITE_GOOGLE_SITE_VERIFICATION  → Google Search Console meta tag
 *
 * GA4 is additionally gated on the visitor's consent (src/lib/consent.ts):
 * with no decision — or an explicit "no" — the gtag.js script is never
 * requested and every event below is a no-op. Search Console verification is
 * not tracking, so it is injected whenever it is configured.
 *
 * Set the variables per environment on Vercel (Production/Preview/Development).
 */

import { hasConsent, readConsent, type ConsentState } from '@/lib/consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
  }
}

const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined;
const SITE_VERIFICATION = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION as string | undefined;

/** True when a syntactically valid measurement id was configured. */
export const analyticsConfigured = Boolean(GA4_ID && /^G-[A-Z0-9]+$/i.test(GA4_ID));

let verificationInjected = false;
let scriptRequested = false;

/** Inject the Search Console verification meta tag (idempotent). */
export function injectSeoVerification(): void {
  if (verificationInjected || !SITE_VERIFICATION) return;
  verificationInjected = true;
  const meta = document.createElement('meta');
  meta.name = 'google-site-verification';
  meta.content = SITE_VERIFICATION;
  document.head.appendChild(meta);
}

/**
 * Load gtag.js — once, and only with consent.
 *
 * There is deliberately no `disable` path afterwards: once Google's script
 * has run, that request cannot be un-sent. The only honest way to honour a
 * "no" is never to make the request, which is what this does.
 */
export function applyAnalyticsConsent(state: ConsentState = readConsent()): void {
  if (!analyticsConfigured || scriptRequested || !state.analytics) return;
  scriptRequested = true;

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
  // Ad personalisation and IP geolocation are off: this is measurement only.
  window.gtag('config', GA4_ID as string, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

/** Bootstrap call (main.tsx): loads GA4 only when consent already exists. */
export function initAnalytics(): void {
  applyAnalyticsConsent();
}

/** Fire a page_view for SPA route changes (no full-page reloads happen). */
export function trackPageView(path: string): void {
  if (!hasConsent('analytics') || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', { page_path: path, page_title: document.title });
}

/**
 * Public-site events worth measuring (spec §39).
 *
 * Kept as a closed union so a typo cannot create a phantom event and so it is
 * obvious at review time that nothing private is being sent. Values are
 * primitives only — never an email, phone number, message body, password,
 * card detail or authentication token.
 */
export type PublicEvent =
  | 'get_started_click'
  | 'contact_form_start'
  | 'contact_form_submit'
  | 'whatsapp_click'
  | 'whatsapp_context_selected'
  | 'pricing_view'
  | 'service_view';

/** Fire one of the defined public events (no-op without consent). */
export function trackEvent(
  event: PublicEvent,
  params: Record<string, string | number | boolean> = {},
): void {
  if (!hasConsent('analytics') || typeof window.gtag !== 'function') return;
  window.gtag('event', event, params);
}
