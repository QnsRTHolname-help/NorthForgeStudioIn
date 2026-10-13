/**
 * Public route metadata — titles, descriptions and indexability.
 *
 * This exists because the app is a client-rendered SPA: the HTML the server
 * sends is an empty `<div id="root">`, so per-page titles and descriptions
 * only exist after JavaScript runs. Googlebot runs JavaScript, but link
 * previews (WhatsApp, LinkedIn), AI crawlers and most other consumers do not —
 * they saw the homepage's tags on every URL, or nothing at all.
 *
 * `scripts/prerender.mjs` reads this table (via `dist/route-meta.json`, which
 * vite.config emits at build time) and bakes these tags into real per-route
 * HTML files. `scripts/generate-sitemap.mjs` reads the same table, so a route
 * can never be in the sitemap but missing its metadata, or vice versa.
 *
 * `title` is deliberately the same string each page passes to `usePageMeta`
 * (without the `· NorthForge` suffix, which that hook appends). The
 * `shared/routes.test.ts` guard fails the suite if a page's copy drifts from
 * this table, so the prerendered HTML cannot silently go stale.
 */

export interface RouteMeta {
  /** Served path. `path` is what the file is written to. */
  path: string;
  /** Static <title>, without the brand suffix. */
  title: string;
  description: string;
  /**
   * Indexable public pages are listed in sitemap.xml and get `index,follow`.
   * Auth and error screens are `noindex,nofollow` and stay out of the sitemap.
   */
  index: boolean;
  /** Sitemap hints. Only meaningful when `index` is true. */
  priority?: string;
  changefreq?: string;
  /**
   * Where the runtime copy lives, so the drift test can check this table
   * against the page that actually renders it.
   */
  page: string;
}

export const ROUTES: RouteMeta[] = [
  {
    path: '/',
    title: 'Websites, automation and AI systems that grow your business',
    description:
      'NorthForge is a digital systems studio in Mangaluru, Karnataka. We build premium websites and connect them to lead capture, WhatsApp, AI, automation and analytics.',
    index: true,
    priority: '1.0',
    changefreq: 'weekly',
    page: 'src/pages/public/Home.tsx',
  },
  {
    path: '/how-it-works',
    title: 'How it works — from discovery to continuous growth',
    description:
      'The NorthForge process: discover, design, build, connect, launch and grow. Six clear stages from first conversation to a system that keeps improving.',
    index: true,
    priority: '0.8',
    changefreq: 'monthly',
    page: 'src/pages/public/HowItWorks.tsx',
  },
  {
    path: '/pricing',
    title: 'Pricing — setup fee plus monthly subscription',
    description:
      'NorthForge pricing: LEAD ₹7,500/month + ₹15,000 setup, CONVERT ₹15,000/month + ₹30,000 setup, AUTOPILOT ₹30,000/month + ₹60,000 setup, plus custom-quoted work.',
    index: true,
    priority: '0.9',
    changefreq: 'monthly',
    page: 'src/pages/public/Pricing.tsx',
  },
  {
    path: '/faq',
    title: 'Frequently asked questions',
    description:
      'Answers about NorthForge websites, hosting, SSL, domains, WhatsApp, AI, automation, the client portal, timelines, changes and plan upgrades.',
    index: true,
    priority: '0.6',
    changefreq: 'monthly',
    page: 'src/pages/public/Faq.tsx',
  },
  {
    path: '/contact',
    title: 'Contact — automation audit',
    description:
      'Tell NorthForge about your business and we will point out where automation, AI and a better website would save you the most time.',
    index: true,
    priority: '0.8',
    changefreq: 'yearly',
    page: 'src/pages/public/Contact.tsx',
  },
  {
    path: '/privacy',
    title: 'Privacy policy',
    description:
      'What NorthForge collects, why, which providers process it, how long we keep it and the choices you have over your data.',
    index: true,
    priority: '0.3',
    changefreq: 'yearly',
    page: 'src/pages/public/Legal.tsx',
  },
  {
    path: '/terms',
    title: 'Terms of service',
    description:
      'NorthForge terms of service: scope of work, fees and billing, plan cancellation, availability and liability.',
    index: true,
    priority: '0.3',
    changefreq: 'yearly',
    page: 'src/pages/public/Legal.tsx',
  },

  /* ── Screens that must never be indexed ─────────────────────── */
  {
    path: '/login',
    title: 'Sign in',
    description: 'Sign in to your NorthForge client portal or agency workspace.',
    index: false,
    page: 'src/pages/public/Login.tsx',
  },
  {
    path: '/register',
    title: 'Create your account',
    description: 'Create a NorthForge client account.',
    index: false,
    page: 'src/pages/public/Register.tsx',
  },
  {
    path: '/forgot-password',
    title: 'Reset your password',
    description: 'Request a password reset link for your NorthForge account.',
    index: false,
    page: 'src/pages/public/ForgotPassword.tsx',
  },
  {
    path: '/reset-password',
    title: 'Set a new password',
    description: 'Choose a new password for your NorthForge account.',
    index: false,
    page: 'src/pages/public/ResetPassword.tsx',
  },
  {
    path: '/mfa',
    title: 'Two-factor verification',
    description: 'Verify your second factor to continue.',
    index: false,
    page: 'src/pages/public/MfaVerify.tsx',
  },
  {
    path: '/email-mfa',
    title: 'Confirm your email code',
    description: 'Verify the code we emailed you to finish signing in.',
    index: false,
    page: 'src/pages/public/EmailMfa.tsx',
  },
  {
    path: '/auth/callback',
    title: 'Confirming your email',
    description: 'Confirming the link you opened.',
    index: false,
    page: 'src/pages/public/AuthCallback.tsx',
  },
  {
    path: '/unauthorized',
    title: 'No access',
    description: 'Your account does not have access to this area.',
    index: false,
    page: 'src/pages/errors/Unauthorized.tsx',
  },
  {
    path: '/error',
    title: 'Something went wrong',
    description: 'Something went wrong on our side. Try again in a moment.',
    index: false,
    page: 'src/pages/errors/ServerError.tsx',
  },

  /* ── Client portal routes (unindexed) ────────────────────────────── */
  {
    path: '/portal',
    title: 'Client portal',
    description: 'Your NorthForge workspace — website, leads, projects, tasks and billing.',
    index: false,
    page: 'src/pages/portal/Overview.tsx',
  },
  {
    path: '/portal/services',
    title: 'Our services',
    description: 'NorthForge service catalogue — automation, AI, CRM, builds and support, with catalog pricing.',
    index: false,
    page: 'src/pages/portal/Services.tsx',
  },
  {
    path: '/portal/profile',
    title: 'Business profile',
    description: 'Update your business name, phone, type and GST details.',
    index: false,
    page: 'src/pages/portal/Profile.tsx',
  },
  {
    path: '/portal/calendar',
    title: 'Calendar',
    description: 'Upcoming appointments and bookings.',
    index: false,
    page: 'src/pages/portal/Calendar.tsx',
  },
  {
    path: '/portal/tasks',
    title: 'Tasks',
    description: 'Open tasks and project work items.',
    index: false,
    page: 'src/pages/portal/Tasks.tsx',
  },
  {
    path: '/portal/project',
    title: 'Project',
    description: 'Project progress, milestones and deliverables.',
    index: false,
    page: 'src/pages/portal/Project.tsx',
  },
  {
    path: '/portal/employees',
    title: 'Employees',
    description: 'Team access and contribution tracking.',
    index: false,
    page: 'src/pages/portal/Employees.tsx',
  },
  {
    path: '/portal/website',
    title: 'Website',
    description: 'Your live website, staging link and maintenance status.',
    index: false,
    page: 'src/pages/portal/Website.tsx',
  },
  {
    path: '/portal/leads',
    title: 'Leads',
    description: 'Enquiries, proposals and conversion tracking.',
    index: false,
    page: 'src/pages/portal/Leads.tsx',
  },
  {
    path: '/portal/analytics',
    title: 'Analytics',
    description: 'Visitor traffic, sources and conversion funnel.',
    index: false,
    page: 'src/pages/portal/Analytics.tsx',
  },
  {
    path: '/portal/whatsapp',
    title: 'WhatsApp',
    description: 'WhatsApp Business integration, templates and conversation history.',
    index: false,
    page: 'src/pages/portal/WhatsApp.tsx',
  },
  {
    path: '/portal/bookings',
    title: 'Bookings',
    description: 'Appointment scheduling, calendar sync and reminders.',
    index: false,
    page: 'src/pages/portal/Bookings.tsx',
  },
  {
    path: '/portal/integrations',
    title: 'Integrations',
    description: 'Connected accounts: email, calendar, sheets and webhooks.',
    index: false,
    page: 'src/pages/portal/Integrations.tsx',
  },
  {
    path: '/portal/second-brain',
    title: 'Second Brain',
    description: 'Business memory: notes, SOPs, decisions and reference material.',
    index: false,
    page: 'src/pages/portal/SecondBrain.tsx',
  },
  {
    path: '/portal/requests',
    title: 'Requests',
    description: 'Raise and track work requests with the NorthForge team.',
    index: false,
    page: 'src/pages/portal/Requests.tsx',
  },
  {
    path: '/portal/announcements',
    title: 'Announcements',
    description: 'Messages from the NorthForge team.',
    index: false,
    page: 'src/pages/portal/Announcements.tsx',
  },
  {
    path: '/portal/files',
    title: 'Files',
    description: 'Uploaded documents, exports and shared assets.',
    index: false,
    page: 'src/pages/portal/Files.tsx',
  },
  {
    path: '/portal/subscription',
    title: 'Subscription',
    description: 'Your active plan, renewal date and billing history.',
    index: false,
    page: 'src/pages/portal/Subscription.tsx',
  },
  {
    path: '/portal/invoices',
    title: 'Invoices',
    description: 'Invoice history, payments and outstanding amounts.',
    index: false,
    page: 'src/pages/portal/Invoices.tsx',
  },
  {
    path: '/portal/support',
    title: 'Support',
    description: 'Open a support ticket or view existing ones.',
    index: false,
    page: 'src/pages/portal/Support.tsx',
  },
  {
    path: '/portal/settings',
    title: 'Settings',
    description: 'Account, security, notifications, 2FA and danger zone.',
    index: false,
    page: 'src/pages/portal/Settings.tsx',
  },
];

/** Routes that belong in sitemap.xml. */
export const INDEXABLE_ROUTES = ROUTES.filter((route) => route.index);

/**
 * Paths that must still be served the SPA shell rather than a static file.
 * Everything else is prerendered; an unknown URL should be a real 404, not a
 * 200 page that says "not found".
 */
export const SPA_REWRITES = ['/app', '/app/(.*)', '/portal', '/portal/(.*)', '/me'];
