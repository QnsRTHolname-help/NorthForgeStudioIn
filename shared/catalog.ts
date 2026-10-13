import type { AddOn, Plan, Service } from './types';

/**
 * NORTHFORGE BUSINESS CATALOG — SINGLE SOURCE OF TRUTH (spec §105).
 *
 * Every price rendered anywhere in the product — homepage, pricing page,
 * client portal, invoices, admin billing, proposals — reads from this file.
 * Never hard-code an amount in a component.
 *
 * Money is stored in paise (₹1 = 100) as integers.
 *
 * Commercial model: one-time setup fee + monthly management subscription.
 */

export const CURRENCY = 'INR';
export const BILLING_INTERVAL_DAYS = 30;

/**
 * Scope rows for the plan comparison matrix. The key order is the display
 * order, so the table and the card copy can never drift apart.
 */
export const PLAN_SCOPE_ROWS = [
  'Active workflows',
  'AI assistant',
  'CRM',
  'WhatsApp automation',
  'Follow-ups',
  'Integrations',
  'Employee portal',
  'Daily OS',
  'Second Brain',
  'AI agents',
  'Voice AI',
  'Analytics',
  'Monthly optimisation',
  'Support',
] as const;

export const PLANS: Plan[] = [
  {
    id: 'plan_lead',
    slug: 'lead',
    name: 'LEAD',
    amount: 750_000,
    setupAmount: 1_500_000,
    currency: CURRENCY,
    intervalDays: BILLING_INTERVAL_DAYS,
    tagline: 'Capture and qualify every opportunity.',
    outcome: 'Capture, qualify and organize every opportunity.',
    description:
      'Stop losing enquiries to slow replies and forgotten follow-ups. Basic lead qualification, proper categorized CRM, basic calendar appointment scheduling, basic analytics, employee slot add-on (+₹600/employee/month), and Company Second Brain add-on tab (₹2,000/month).',
    features: [
      'Lead capture from your existing website, WhatsApp, form or chosen channel',
      'Automated enquiry acknowledgement',
      'Basic AI FAQ assistant using your business information',
      'Basic lead qualification and proper categorized CRM',
      'Lead notifications to the owner or team',
      'Basic calendar appointment scheduling and calendar view',
      'Tasks, todo list and owner dashboard',
      'Basic analytics and monthly monitoring',
      'Basic follow-up automation',
      'Up to 2 active workflows and 1 integration',
      '3 included users; employee slot add-on (+₹600/employee/month)',
      'Company Second Brain add-on tab (₹2,000/month)',
    ],
    scope: {
      'Active workflows': '2',
      'AI assistant': 'Basic',
      CRM: 'Proper categorized CRM',
      'WhatsApp automation': 'Basic',
      'Follow-ups': 'Basic',
      Integrations: '1',
      'Employee portal': '3 users (+₹600/seat add-on)',
      'Daily OS': 'Tasks + calendar',
      'Second Brain': 'Add-on',
      'AI agents': '—',
      'Voice AI': 'Add-on',
      Analytics: 'Basic',
      'Monthly optimisation': 'Monitoring + small changes',
      Support: 'Standard',
    },
    limits: { workflows: 2, integrations: 1, aiAgents: 0, automationRuns: 2_000, users: 3 },
    recommended: false,
    sortOrder: 1,
  },
  {
    id: 'plan_convert',
    slug: 'convert',
    name: 'CONVERT',
    amount: 1_500_000,
    setupAmount: 3_000_000,
    currency: CURRENCY,
    intervalDays: BILLING_INTERVAL_DAYS,
    tagline: 'Turn more enquiries into customers.',
    outcome: 'Turn more enquiries into customers.',
    description:
      'Everything in LEAD, plus advanced AI customer assistant (email & WhatsApp), lead scoring & CRM pipeline, multi-step follow-up sequences, dedicated Employee Portal (up to 15 employees, password-based sub-portal with contribution tracking, +₹500/employee/month add-on), and Company Second Brain included.',
    features: [
      'Everything in LEAD',
      'Advanced AI customer assistant (email & WhatsApp)',
      'Lead scoring & CRM pipeline (New Lead → Contacted → Interested → Follow-up → Converted)',
      'Multi-step WhatsApp and email follow-up sequences',
      'Appointment scheduling and calendar reminders',
      'Dedicated Employee Portal (up to 15 employees, password-based sub-portal with contribution tracking)',
      'Employee slot add-on (+₹500/employee/month)',
      'Up to 5 active workflows and 3 integrations',
      'Conversion analytics and monthly optimisation',
      'Company Second Brain included',
    ],
    scope: {
      'Active workflows': '5',
      'AI assistant': 'Advanced (email & WhatsApp)',
      CRM: 'Lead scoring & pipeline',
      'WhatsApp automation': 'Advanced',
      'Follow-ups': 'Multi-step sequences',
      Integrations: 'Up to 3',
      'Employee portal': '15 users (+₹500/seat add-on)',
      'Daily OS': 'Tasks, calendar, projects',
      'Second Brain': 'Included',
      'AI agents': '1',
      'Voice AI': 'Add-on',
      Analytics: 'Advanced',
      'Monthly optimisation': 'Included',
      Support: 'Standard',
    },
    limits: { workflows: 5, integrations: 3, aiAgents: 1, automationRuns: 20_000, users: 15 },
    recommended: true,
    sortOrder: 2,
  },
  {
    id: 'plan_autopilot',
    slug: 'autopilot',
    name: 'AUTOPILOT',
    amount: 3_000_000,
    setupAmount: 6_000_000,
    currency: CURRENCY,
    intervalDays: BILLING_INTERVAL_DAYS,
    tagline: 'Automate the repetitive parts of the business.',
    outcome: 'Automate the repetitive parts of the business.',
    description:
      'Everything in CONVERT, plus custom AI workflows across multiple business processes, multiple AI agents, AI voice receptionist where suitable, custom customer onboarding automation, priority workflow request automation, dedicated Employee Portal (up to 30 employees, +₹500/employee/month add-on), and Company Second Brain included.',
    features: [
      'Everything in CONVERT',
      'Custom AI workflows across multiple business processes',
      'Multiple AI agents for specialized departmental tasks',
      'AI voice receptionist where suitable',
      'Custom customer onboarding automation',
      'Priority workflow request automation',
      'Dedicated Employee Portal (up to 30 employees, +₹500/employee/month add-on)',
      'Advanced WhatsApp & email automation',
      'Automated operational reports and owner command center',
      '10+ active workflows with continuous optimisation and priority support',
      'Company Second Brain included',
    ],
    scope: {
      'Active workflows': '10+',
      'AI assistant': 'Custom',
      CRM: 'Custom automation',
      'WhatsApp automation': 'Advanced',
      'Follow-ups': 'Multi-step / custom',
      Integrations: '5+',
      'Employee portal': '30 users (+₹500/seat add-on)',
      'Daily OS': 'Custom owner command center',
      'Second Brain': 'Included',
      'AI agents': 'Multiple',
      'Voice AI': 'Included where suitable',
      Analytics: 'Custom',
      'Monthly optimisation': 'Continuous, priority',
      Support: 'Priority',
    },
    limits: { workflows: 10, integrations: 5, aiAgents: 5, automationRuns: 100_000, users: 30 },
    recommended: false,
    sortOrder: 3,
  },
  {
    id: 'plan_custom',
    slug: 'custom',
    name: 'CUSTOM QUOTE',
    amount: null,
    setupAmount: null,
    currency: CURRENCY,
    intervalDays: BILLING_INTERVAL_DAYS,
    tagline: 'Scoped around your business.',
    outcome: 'Larger or unusually complex projects.',
    description:
      'For larger or unusually complex projects — multiple locations, legacy systems, bespoke software, or compliance constraints. Scoped and quoted after discovery.',
    features: [
      'Discovery and process mapping across teams',
      'Bespoke workflow design and build',
      'Legacy system and API integration',
      'Custom dashboards and reporting',
      'Migration from existing tools',
      'Service level agreement',
      'Named contact and quarterly review',
      'Custom quoted',
    ],
    scope: {
      'Active workflows': 'Scoped',
      'AI assistant': 'Scoped',
      CRM: 'Scoped',
      'WhatsApp automation': 'Scoped',
      'Follow-ups': 'Scoped',
      Integrations: 'Scoped',
      'Employee portal': 'Scoped',
      'Daily OS': 'Scoped',
      'Second Brain': 'Scoped',
      'AI agents': 'Scoped',
      'Voice AI': 'Scoped',
      Analytics: 'Scoped',
      'Monthly optimisation': 'Scoped',
      Support: 'Scoped',
    },
    limits: { workflows: -1, integrations: -1, aiAgents: -1, automationRuns: -1, users: -1 },
    recommended: false,
    sortOrder: 4,
  },
];

/* ── Add-ons ───────────────────────────────────────────────────── */

/**
 * Employee seats and capabilities sold ON TOP of a plan.
 *
 * Seat allowances: LEAD 3, CONVERT 15, AUTOPILOT 30.
 * Add-on rates:
 * - Employee seats: +₹600/seat/mo on Lead, +₹500/seat/mo on Convert & Autopilot.
 * - Second Brain: ₹2,000/mo add-on on Lead, included on Convert & Autopilot.
 */
export const ADD_ONS: AddOn[] = [
  {
    id: 'addon_employee_seats',
    slug: 'extra-employee-seats',
    name: 'Extra Employee Seats',
    description:
      'Add dedicated team member seats beyond included allowance (+₹600/seat/mo for Lead, +₹500/seat/mo for Convert & Autopilot). Each member gets private password login and contribution tracking.',
    amount: 50_000,
    unit: 'per seat / month',
    availableOn: ['lead', 'convert', 'autopilot'],
  },
  {
    id: 'addon_second_brain',
    slug: 'company-second-brain',
    name: 'Company Second Brain',
    description:
      'A structured business memory for customer, project and sales context. ₹2,000/month add-on for LEAD; included on CONVERT and AUTOPILOT.',
    amount: 200_000,
    unit: 'per month',
    availableOn: ['lead'],
  },
  {
    id: 'addon_voice_receptionist',
    slug: 'ai-voice-receptionist',
    name: 'AI Voice Receptionist',
    description:
      'Answers calls, captures the enquiry and books the appointment where a phone line still matters.',
    amount: null,
    unit: 'per month',
    availableOn: ['lead', 'convert'],
  },
];

export const SERVICES: Service[] = [
  // ── AUTOMATION ─────────────────────────────────────────────
  {
    id: 'svc_whatsapp_automation',
    slug: 'ai-whatsapp-automation',
    name: 'AI WhatsApp Automation',
    group: 'automation',
    description: 'Instant, intelligent replies on the channel your customers already use — with clean handover to a human.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },
  {
    id: 'svc_business_process',
    slug: 'business-process-automation',
    name: 'Business Process Automation',
    group: 'automation',
    description: 'The repetitive, slow or error-prone work in your business, mapped and automated end to end.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },
  {
    id: 'svc_voice_receptionist',
    slug: 'ai-voice-receptionist',
    name: 'AI Voice Receptionist',
    group: 'automation',
    description: 'Answers calls, captures the enquiry and books the appointment when nobody is free to pick up.',
    priceFrom: null,
    unit: 'quoted',
    active: true,
  },
  {
    id: 'svc_workflow_design',
    slug: 'workflow-mapping',
    name: 'Workflow Mapping & Templates',
    group: 'automation',
    description: 'Reusable industry templates, customised for your business, deployed and improved over time.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },

  // ── AI ─────────────────────────────────────────────────────
  {
    id: 'svc_ai_support',
    slug: 'ai-customer-support',
    name: 'AI Customer Support',
    group: 'ai',
    description: 'Handles repetitive questions accurately and hands off to a human with the full conversation attached.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },
  {
    id: 'svc_ai_qualification',
    slug: 'ai-lead-qualification',
    name: 'AI Lead Qualification',
    group: 'ai',
    description: 'Reads each enquiry, asks the missing questions and scores it before anyone opens it.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },
  {
    id: 'svc_ai_operations',
    slug: 'ai-operations-assistant',
    name: 'AI Operations Assistant',
    group: 'ai',
    description: 'Internal assistant for your team: statuses, records, reports and routine updates on request.',
    priceFrom: null,
    unit: 'quoted',
    active: true,
  },

  // ── CRM ────────────────────────────────────────────────────
  {
    id: 'svc_crm_development',
    slug: 'crm-development',
    name: 'CRM Development',
    group: 'crm',
    description: 'A pipeline built around how your business actually sells — not a generic contact list.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },
  {
    id: 'svc_lead_pipeline',
    slug: 'lead-pipeline-setup',
    name: 'Lead Pipeline & Scoring',
    group: 'crm',
    description: 'New Lead → Contacted → Interested → Follow-up → Converted, with ownership and next action on every record.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },
  {
    id: 'svc_followup_sequences',
    slug: 'follow-up-sequences',
    name: 'Follow-up Sequences',
    group: 'crm',
    description: 'Multi-step WhatsApp and email sequences that run until a human replies or the lead converts.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },

  // ── BUILD ──────────────────────────────────────────────────
  {
    id: 'svc_custom_saas',
    slug: 'custom-saas',
    name: 'Custom SaaS',
    group: 'build',
    description: 'Bespoke software when off-the-shelf tools force your business to work around them.',
    priceFrom: null,
    unit: 'quoted',
    active: true,
  },
  {
    id: 'svc_client_portals',
    slug: 'client-portals',
    name: 'Client Portals',
    group: 'build',
    description: 'A secure space where customers see their status, documents, invoices and requests.',
    priceFrom: null,
    unit: 'quoted',
    active: true,
  },
  {
    id: 'svc_internal_dashboards',
    slug: 'internal-dashboards',
    name: 'Internal Dashboards',
    group: 'build',
    description: 'One operational view of the numbers that matter, updated without anyone building a report.',
    priceFrom: null,
    unit: 'quoted',
    active: true,
  },
  {
    id: 'svc_ecommerce',
    slug: 'ecommerce-systems',
    name: 'E-commerce Systems',
    group: 'build',
    description: 'Catalogue, orders, payments and fulfilment connected to the rest of your operations.',
    priceFrom: null,
    unit: 'quoted',
    active: true,
  },
  {
    id: 'svc_website_addon',
    slug: 'website-build',
    name: 'Website Build (add-on)',
    group: 'build',
    description: 'Optional. We connect the system to your existing website and only rebuild it when that is genuinely the best fix.',
    priceFrom: null,
    unit: 'quoted',
    active: true,
  },

  // ── SUPPORT ────────────────────────────────────────────────
  {
    id: 'svc_monitoring',
    slug: 'monitoring',
    name: 'Monitoring & Maintenance',
    group: 'support',
    description: 'Every workflow watched. Failures surfaced and fixed before your team notices anything is wrong.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },
  {
    id: 'svc_reporting',
    slug: 'reporting',
    name: 'Reporting',
    group: 'support',
    description: 'Plain-language monthly reporting on response times, conversions, time saved and revenue influenced.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },
  {
    id: 'svc_optimization',
    slug: 'continuous-optimization',
    name: 'Continuous Optimisation',
    group: 'support',
    description: 'Ongoing improvements based on what the data shows, not on what was assumed at the start.',
    priceFrom: null,
    unit: 'included',
    active: true,
  },
];

export const SERVICE_GROUPS = [
  { key: 'automation', label: 'AUTOMATION', blurb: 'The repetitive work, handled without being chased.' },
  { key: 'ai', label: 'AI', blurb: 'Assistants that answer, qualify and escalate with context.' },
  { key: 'crm', label: 'CRM & LEADS', blurb: 'Every opportunity recorded, owned and followed up.' },
  { key: 'build', label: 'BUILD', blurb: 'Software when the standard tools are not enough.' },
  { key: 'support', label: 'SUPPORT', blurb: 'Monitored, maintained and measurably improving.' },
] as const;

/* ── Selectors ─────────────────────────────────────────────────── */

export const getPlan = (slug: string) => PLANS.find((p) => p.slug === slug) ?? null;
export const getPlanById = (id: string | null) => (id ? PLANS.find((p) => p.id === id) ?? null : null);
export const recommendedPlan = () => PLANS.find((p) => p.recommended) ?? PLANS[1]!;
export const servicesByGroup = (group: Service['group']) => SERVICES.filter((s) => s.group === group && s.active);

/** "₹15,000" — amount only, for tight UI. */
export function planAmountLabel(plan: Plan) {
  if (plan.amount === null) return 'Custom';
  return `₹${(plan.amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** "₹30,000 setup" — the one-time fee, or null when custom-quoted. */
export function planSetupLabel(plan: Plan) {
  if (plan.setupAmount === null) return 'Setup quoted after discovery';
  return `₹${(plan.setupAmount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} setup`;
}

export function planIntervalLabel(plan: Plan) {
  return plan.amount === null ? '' : '/ month';
}

/** "3 seats" / "Scoped by agreement" — the employee allowance a plan grants. */
export function planSeatLabel(plan: Plan) {
  if (plan.limits.users < 0) return 'Scoped by agreement';
  return `${plan.limits.users} seat${plan.limits.users === 1 ? '' : 's'}`;
}

/** The add-ons a client on this plan can buy on top of it. */
export const addOnsForPlan = (slug: string) =>
  ADD_ONS.filter((addOn) => addOn.availableOn.includes(slug as Plan['slug']));

export const EMPLOYEE_SEAT_RATES: Record<'lead' | 'convert' | 'autopilot', number> = {
  lead: 60_000, // +₹600/seat/mo
  convert: 50_000, // +₹500/seat/mo
  autopilot: 50_000, // +₹500/seat/mo
};

export const SECOND_BRAIN_RATE = 200_000; // ₹2,000/mo on Lead

/** Returns the add-on price in paise for a specific plan tier, or null if quoted/free */
export function addOnAmountForPlan(addOnSlug: string, planSlug: Plan['slug'] | string): number | null {
  if (addOnSlug === 'extra-employee-seats') {
    if (planSlug === 'lead') return EMPLOYEE_SEAT_RATES.lead;
    if (planSlug === 'convert') return EMPLOYEE_SEAT_RATES.convert;
    if (planSlug === 'autopilot') return EMPLOYEE_SEAT_RATES.autopilot;
    return 50_000;
  }
  if (addOnSlug === 'company-second-brain') {
    if (planSlug === 'lead') return SECOND_BRAIN_RATE;
    return 0; // included on convert and autopilot
  }
  const addOn = ADD_ONS.find((a) => a.slug === addOnSlug);
  return addOn?.amount ?? null;
}

/** "₹500 per seat / month", or "Quoted per seat / month" while undecided. Supports optional planSlug for tier-aware pricing. */
export function addOnAmountLabel(addOn: AddOn, planSlug?: Plan['slug'] | string) {
  const amount = planSlug ? addOnAmountForPlan(addOn.slug, planSlug) : addOn.amount;
  if (amount === null) return `Quoted ${addOn.unit}`;
  return `₹${(amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ${addOn.unit}`;
}

/** Psychological pricing hooks and commercial incentives (R6) */
export const PSYCHOLOGICAL_PRICING = {
  founderDiscountPaise: 500_000, // ₹5,000 off setup fee for first-time partners
  founderPromoCode: 'FOUNDER5K',
  cohortMonth: 'October',
  monthlyCohortSpotsRemaining: 3, // "Only 3 onboarding spots left this month"
  rapidDeploymentHours: 48, // "48-Hour Rapid Workflow Deployment"
  quarterlyDiscountPercent: 15, // 15% discount on quarterly commitment
  quarterlyFreeSeats: 1, // 1 extra employee seat included for free
  annualFreeMonths: 2, // 2 months free on annual commitment
} as const;

/** Calculate discounted setup fee with founder coupon */
export function getDiscountedSetupAmount(plan: Plan, promoCode?: string): number | null {
  if (plan.setupAmount === null) return null;
  if (promoCode?.trim().toUpperCase() === PSYCHOLOGICAL_PRICING.founderPromoCode) {
    return Math.max(0, plan.setupAmount - PSYCHOLOGICAL_PRICING.founderDiscountPaise);
  }
  return plan.setupAmount;
}

/** Calculate quarterly total in paise (3 months with 15% retention discount) */
export function getQuarterlySavings(plan: Plan): { quarterlyTotal: number; savings: number } | null {
  if (plan.amount === null) return null;
  const threeMonths = plan.amount * 3;
  const discounted = Math.round(threeMonths * (1 - PSYCHOLOGICAL_PRICING.quarterlyDiscountPercent / 100));
  return {
    quarterlyTotal: discounted,
    savings: threeMonths - discounted,
  };
}

/** Honest billing copy (spec §123–124): separates our price from third-party costs. */
export const THIRD_PARTY_COSTS = [
  { label: 'WhatsApp / messaging charges', note: 'Billed by Meta or your messaging provider on a usage basis.' },
  { label: 'AI model usage', note: 'Above your plan allowance, passed through at the provider’s cost.' },
  { label: 'Domains, hosting, phone numbers', note: 'Billed by the registrar or carrier, usually yearly.' },
  { label: 'Third-party SaaS', note: 'Any external tool you choose to connect.' },
];

export const BILLING_FACTS = [
  'One-time setup fee covers discovery, workflow mapping, configuration, integrations, testing, deployment and staff handover.',
  'The monthly fee covers monitoring, maintenance, support, reporting and the optimisation included in your plan.',
  'NorthForge is free and open-source first — paid services are introduced only when necessary and explained first.',
  'Third-party costs are passed through at cost, never marked up.',
  'Workflow limits are confirmed after discovery, and can be revised as infrastructure and third-party costs change.',
];
