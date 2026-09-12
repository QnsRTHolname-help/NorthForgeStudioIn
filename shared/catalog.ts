import type { Plan, Service } from './types';

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
    tagline: 'Capture every opportunity.',
    outcome: 'Capture and respond to more opportunities.',
    description:
      'Stop losing enquiries to slow replies and forgotten follow-ups. Lead capture, instant acknowledgement, a basic AI assistant and a lead database — running without anyone watching it.',
    features: [
      'Lead capture from your existing website, WhatsApp, form or chosen channel',
      'Automated enquiry acknowledgement',
      'Basic AI FAQ assistant using your business information',
      'Lead database or simple CRM',
      'Lead notifications to the owner or team',
      'Basic follow-up automation',
      'Up to 2 active workflows and 1 integration',
      'Monthly monitoring, basic reporting and small workflow changes',
    ],
    scope: {
      'Active workflows': '2',
      'AI assistant': 'Basic',
      CRM: 'Basic',
      'WhatsApp automation': 'Basic',
      'Follow-ups': 'Basic',
      Integrations: '1',
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
      'Everything in LEAD, plus qualification and scoring, a real pipeline, multi-step follow-up sequences, appointment booking with reminders, and the analytics to see which enquiries actually convert.',
    features: [
      'Everything in LEAD',
      'Advanced AI customer assistant',
      'Lead qualification, scoring and segmentation',
      'CRM pipeline: New Lead → Contacted → Interested → Follow-up → Converted',
      'Multi-step WhatsApp and email follow-up sequences',
      'Appointment scheduling and reminders',
      'Up to 5 active workflows and 3 integrations',
      'Google Sheets or CRM integrations where suitable',
      'Conversion analytics and monthly optimisation',
    ],
    scope: {
      'Active workflows': '5',
      'AI assistant': 'Advanced',
      CRM: 'Advanced',
      'WhatsApp automation': 'Advanced',
      'Follow-ups': 'Multi-step',
      Integrations: 'Up to 3',
      'AI agents': '1',
      'Voice AI': 'Add-on',
      Analytics: 'Advanced',
      'Monthly optimisation': 'Included',
      Support: 'Standard',
    },
    limits: { workflows: 5, integrations: 3, aiAgents: 1, automationRuns: 20_000, users: 10 },
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
      'Everything in CONVERT, plus multiple AI agents, custom workflows across departments, an AI voice receptionist where it fits, customer onboarding automation, automated reporting and priority support.',
    features: [
      'Everything in CONVERT',
      'Custom AI workflows across multiple business processes',
      'Multiple AI agents where appropriate',
      'Advanced WhatsApp automation',
      'AI voice receptionist where suitable',
      'Customer onboarding automation',
      'Internal workflow and notification automation',
      'Advanced CRM automation and custom integrations',
      'Automated reports and owner dashboard',
      '10+ active workflows, subject to discovery and infrastructure limits',
      'Priority support, continuous optimisation and new workflow development within agreed scope',
    ],
    scope: {
      'Active workflows': '10+',
      'AI assistant': 'Custom',
      CRM: 'Custom',
      'WhatsApp automation': 'Advanced',
      'Follow-ups': 'Multi-step / custom',
      Integrations: '5+',
      'AI agents': 'Multiple',
      'Voice AI': 'Included where suitable',
      Analytics: 'Custom',
      'Monthly optimisation': 'Continuous, priority',
      Support: 'Priority',
    },
    limits: { workflows: 10, integrations: 5, aiAgents: 5, automationRuns: 100_000, users: 25 },
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
