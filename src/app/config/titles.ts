/** Human page titles for document metadata and layout headers. */
export const TITLES: Record<string, string> = {
  '/': 'Websites that work',
  '/how-it-works': 'How it works',
  '/pricing': 'Pricing',
  '/faq': 'Frequently asked questions',
  '/contact': 'Contact',
  '/login': 'Sign in',
  '/register': 'Create your account',
  '/forgot-password': 'Reset password',
  '/reset-password': 'Set a new password',
  '/privacy': 'Privacy policy',
  '/terms': 'Terms of service',

  '/portal': 'Overview',
  '/portal/profile': 'Business profile',
  '/portal/website': 'My website',
  '/portal/project': 'My project',
  '/portal/leads': 'Enquiries',
  '/portal/analytics': 'Analytics',
  '/portal/whatsapp': 'WhatsApp',
  '/portal/bookings': 'Bookings',
  '/portal/subscription': 'Subscription',
  '/portal/invoices': 'Invoices',
  '/portal/requests': 'Requests',
  '/portal/support': 'Support',
  '/portal/announcements': 'Announcements',
  '/portal/files': 'Files',
  '/portal/settings': 'Settings',

  '/app': 'Dashboard',
  '/app/leads': 'Leads',
  '/app/pipeline': 'Pipeline',
  '/app/proposals': 'Proposals',
  '/app/follow-ups': 'Follow-ups',
  '/app/outreach': 'Outreach',
  '/app/clients': 'Clients',
  '/app/requests': 'Client requests',
  '/app/onboarding': 'Onboarding',
  '/app/projects': 'Projects',
  '/app/websites': 'Websites',
  '/app/tasks': 'Tasks',
  '/app/calendar': 'Calendar',
  '/app/analytics': 'Analytics',
  '/app/seo': 'SEO',
  '/app/conversions': 'Conversions',
  '/app/whatsapp': 'WhatsApp',
  '/app/workflows': 'Workflows',
  '/app/bookings': 'Bookings',
  '/app/subscriptions': 'Subscriptions',
  '/app/payments': 'Payments',
  '/app/invoices': 'Invoices',
  '/app/plans': 'Plans',
  '/app/services': 'Services',
  '/app/notifications': 'Notifications',
  '/app/announcements': 'Announcements',
  '/app/activity': 'Activity',
  '/app/support': 'Support',
  '/app/system-health': 'System health',
  '/app/settings': 'Settings',
};

export function titleForPath(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  // Detail routes: /app/leads/:id, /app/clients/:id, /app/workflows/:id
  const match = Object.keys(TITLES)
    .filter((key) => key.includes(':id'))
    .find((key) => {
      const pattern = new RegExp(`^${key.replace(/:[^/]+/g, '[^/]+')}$`);
      return pattern.test(pathname);
    });
  return match ? TITLES[match] : null;
}
