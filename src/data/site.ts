/**
 * NORTHFORGE SITE CONFIGURATION
 *
 * Real business details supplied by the owner. This is the single file that
 * feeds the footer, contact page, SEO metadata, WhatsApp deep links, AI
 * answers and schema.org markup — change it here and the whole product
 * follows.
 */

export const PLACEHOLDER_CONTACT = false;

/**
 * Read a `VITE_*` variable safely. `import.meta.env` is a real object inside
 * the app bundle, but is `undefined` when this module is imported at Vite
 * *config* load time (the schema emitter does that) — guarding here keeps
 * both call sites working instead of special-casing the config.
 */
function viteEnv(key: string): string | undefined {
  try {
    // `import.meta.env` may be undefined in non-browser contexts; the
    // optional chain avoids a hard crash at module-evaluation time.
    return (import.meta as { env?: Record<string, string | undefined> }).env?.[key];
  } catch {
    return undefined;
  }
}

const WHATSAPP_DIGITS = viteEnv('VITE_WHATSAPP_NUMBER') ?? '919187006703';

export const SITE = {
  name: 'NorthForge',
  legalName: 'NorthForge Digital Systems',
  monogram: 'NF',
  tagline: 'Web. Automation. AI. Growth.',
  discipline: 'WEB · AUTOMATION · AI · GROWTH',
  description:
    'NorthForge is a premium digital systems studio. We design premium websites and connect them to AI, lead capture, WhatsApp, automation and analytics — turning your digital presence into a system that helps your business grow.',
  url: viteEnv('VITE_SITE_URL') || 'https://northforgestudioin.vercel.app',
  locale: 'en_IN',
} as const;

export const CONTACT = {
  email: 'north.forge.studio.in@gmail.com',
  phone: '+91 9187006703',
  whatsappDisplay: '+91 91870 06703',
  /** Digits only, used for wa.me deep links. */
  whatsappDigits: WHATSAPP_DIGITS,
  addressLine1: 'Mangaluru',
  addressLine2: 'Karnataka, India',
  city: 'Mangaluru (Mangalore)',
  state: 'Karnataka',
  country: 'India',
  hours: 'Mon–Fri 4:00 PM – 9:00 PM · Sat & Sun 2:00 PM – 8:00 PM IST',
  hoursDetail: [
    { days: 'Monday – Friday', time: '4:00 PM – 9:00 PM' },
    { days: 'Saturday', time: '2:00 PM – 8:00 PM' },
    { days: 'Sunday', time: '2:00 PM – 8:00 PM' },
  ],
} as const;

export function whatsappLink(message?: string) {
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${CONTACT.whatsappDigits}${text}`;
}

export function emailLink(subject?: string) {
  return `mailto:${CONTACT.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
}

/**
 * Primary navigation.
 *
 * `to` is the real page; `id` is the matching section on the homepage so the
 * same links scroll to a section when you are already on `/` and navigate
 * properly when you are not.
 */
export const PUBLIC_NAV = [
  { label: 'How It Works', to: '/how-it-works', id: 'process' },
  { label: 'Pricing', to: '/#pricing', id: 'pricing' },
  { label: 'FAQ', to: '/faq', id: 'faq' },
] as const;

export const FOOTER_NAV = [
  {
    title: 'Product',
    links: [
      { label: 'How It Works', to: '/how-it-works' },
      { label: 'Pricing', to: '/#pricing' },
      { label: 'FAQ', to: '/faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', to: '/contact' },
      { label: 'Client Login', to: '/login' },
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
] as const;

/** Structured data for local business SEO (spec §94). */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: SITE.name,
    description: SITE.description,
    url: SITE.url,
    email: CONTACT.email,
    telephone: CONTACT.phone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: CONTACT.city,
      addressRegion: CONTACT.state,
      addressCountry: CONTACT.country,
    },
    areaServed: [
      { '@type': 'City', name: CONTACT.city },
      { '@type': 'State', name: CONTACT.state },
    ],
    knowsAbout: [
      'Business process automation',
      'AI automation for small business',
      'WhatsApp automation',
      'CRM development',
      'Lead management and follow-up automation',
      'AI customer support',
      'Custom SaaS development',
    ],
  };
}

/**
 * Offer catalog (spec §94). An `ItemList` of the five capability groups so
 * Google can surface "services" rich results. Read from the same catalog
 * that renders the services page — the copy can never drift.
 *
 * The caller passes the group list (rather than this module importing the
 * catalog) to keep `site.ts` free of a dependency on `@shared/catalog`:
 * `site.ts` is imported by every page, and a circular import here would be
 * silent and hard to debug.
 */
export function serviceSchema(
  groups: ReadonlyArray<{ label: string; blurb: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'NorthForge services',
    description: SITE.description,
    url: SITE.url,
    numberOfItems: groups.length,
    itemListElement: groups.map((group, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: group.label,
      description: group.blurb,
      url: `${SITE.url}/#services`,
    })),
  };
}
