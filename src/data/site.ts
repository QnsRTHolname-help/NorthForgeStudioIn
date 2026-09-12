/**
 * NORTHFORGE SITE CONFIGURATION
 *
 * Real business details supplied by the owner. This is the single file that
 * feeds the footer, contact page, SEO metadata, WhatsApp deep links, AI
 * answers and schema.org markup — change it here and the whole product
 * follows.
 */

export const PLACEHOLDER_CONTACT = false;

const WHATSAPP_DIGITS = import.meta.env.VITE_WHATSAPP_NUMBER ?? '919187006703';

export const SITE = {
  name: 'NorthForge',
  legalName: 'NorthForge Digital Systems',
  monogram: 'NF',
  tagline: 'Web. Automation. AI. Growth.',
  discipline: 'WEB · AUTOMATION · AI · GROWTH',
  description:
    'NorthForge is a premium digital systems studio. We design premium websites and connect them to AI, lead capture, WhatsApp, automation and analytics — turning your digital presence into a system that helps your business grow.',
  url: (import.meta.env.VITE_SITE_URL as string) || 'https://northforgestudio.vercel.app',
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
  { label: 'Services', to: '/services', id: 'services' },
  { label: 'How It Works', to: '/how-it-works', id: 'process' },
  { label: 'Work', to: '/#work', id: 'work' },
  { label: 'Pricing', to: '/pricing', id: 'pricing' },
  { label: 'FAQ', to: '/faq', id: 'faq' },
] as const;

export const FOOTER_NAV = [
  {
    title: 'Product',
    links: [
      { label: 'Services', to: '/services' },
      { label: 'How It Works', to: '/how-it-works' },
      { label: 'Work', to: '/#work' },
      { label: 'Pricing', to: '/pricing' },
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
    areaServed: { '@type': 'State', name: CONTACT.state },
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
