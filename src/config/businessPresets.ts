/**
 * Business-Specific Dashboard Presets (spec §115, R6).
 *
 * 10 tailored business presets led by Interior Design (flagship), Architecture, and Startup.
 * Configures custom pipeline stages, calendar bookings, daily routines, task categories,
 * tailored modules, and app integrations (Gmail, WhatsApp, Calendar, Slack).
 */

export type PresetModule =
  | 'clients'
  | 'projects'
  | 'calendar'
  | 'tasks'
  | 'bookings'
  | 'employee_activity';

export interface PipelineStage {
  id: string;
  name: string;
  description: string;
}

export interface AppointmentType {
  id: string;
  name: string;
  durationMins: number;
  description: string;
}

export interface AppIntegration {
  id: 'gmail' | 'whatsapp' | 'calendar' | 'slack';
  name: string;
  description: string;
  recommended: boolean;
}

export interface DailyRoutineItem {
  id: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  label: string;
  description: string;
}

export interface BusinessPreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  isFlagship?: boolean;
  tailoredModules: PresetModule[];
  pipelineStages: PipelineStage[];
  appointmentTypes: AppointmentType[];
  dailyRoutine: DailyRoutineItem[];
  taskCategories: string[];
  integrations: AppIntegration[];
  kpis: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
}

export const BUSINESS_PRESETS: BusinessPreset[] = [
  // ── 1. INTERIOR DESIGN (FLAGSHIP) ────────────────────────────
  {
    id: 'interior_design',
    name: 'Interior Design',
    tagline: '3D pipelines, site surveys, material selections & client approvals.',
    description:
      'Purpose-built for interior design studios. Manage moodboards, site surveys, 3D renderings, material approvals, and vendor executions in one unified command center.',
    isFlagship: true,
    tailoredModules: ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'],
    pipelineStages: [
      { id: 'enquiry', name: 'Enquiry & Moodboard', description: 'Initial aesthetic discovery and preliminary space brief.' },
      { id: 'site_survey', name: 'Site Survey & Measurements', description: 'Laser measurement, site photography, and MEP verification.' },
      { id: 'design_3d', name: '3D Design & Space Planning', description: 'Floor plans, elevations, photorealistic 3D renders.' },
      { id: 'quotation', name: 'Quotation & Materials', description: 'Itemized BOQ, finishes, veneer/tile selections.' },
      { id: 'client_approval', name: 'Client Approval & Signoff', description: 'Final WhatsApp approval, token payment, contract signoff.' },
      { id: 'execution', name: 'Execution & Site Work', description: 'Carpentry, electrical, false ceiling, and contractor milestones.' },
      { id: 'handover', name: 'Styling & Handover', description: 'Deep clean, art placement, punch-list signoff, client review.' },
    ],
    appointmentTypes: [
      { id: 'initial_consult', name: 'Initial Site Consultation', durationMins: 60, description: 'On-site walk-through and client requirement intake.' },
      { id: 'design_presentation', name: '3D Concept Presentation', durationMins: 45, description: 'Walk-through of 3D layout options and moodboard.' },
      { id: 'material_selection', name: 'Material & Sample Selection', durationMins: 60, description: 'Showroom or office swatch selection for laminates and fabrics.' },
      { id: 'final_handover', name: 'Final Site Handover', durationMins: 90, description: 'Punch list signoff and project delivery.' },
    ],
    dailyRoutine: [
      { id: 'm1', timeOfDay: 'morning', label: 'Site Measurements & WhatsApp Enquiries', description: 'Review overnight client feedback and site visit schedules.' },
      { id: 'a1', timeOfDay: 'afternoon', label: '3D Render & Material Progress', description: 'Check 3D pipeline deliverables and verify vendor dispatch notes.' },
      { id: 'e1', timeOfDay: 'evening', label: 'Client Approvals & Site Logs', description: 'Collect contractor photo logs and verify pending client approvals.' },
    ],
    taskCategories: ['Site Visits', '3D Renders', 'Material Sourcing', 'Client Approvals', 'Contractors'],
    integrations: [
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'Instant client 3D render sharing & approval receipts.', recommended: true },
      { id: 'calendar', name: 'Google Calendar', description: 'Site survey bookings & design walkthrough schedules.', recommended: true },
      { id: 'gmail', name: 'Gmail Workspace', description: 'Vendor quotes, contractor tenders & formal agreements.', recommended: true },
      { id: 'slack', name: 'Slack', description: 'Internal team notifications on milestone completion.', recommended: false },
    ],
    kpis: {
      primary: 'Active 3D Projects',
      secondary: 'Pending Client Approvals',
      tertiary: 'Site Visits This Week',
    },
  },

  // ── 2. ARCHITECTURE ──────────────────────────────────────────
  {
    id: 'architecture',
    name: 'Architecture',
    tagline: 'Concept schematics, municipal sanctions, CAD revisions & site supervision.',
    description:
      'Engineered for architectural practices. Track schematic design, structural compliance, municipal sanctions, contractor tenders, and site audits.',
    tailoredModules: ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'],
    pipelineStages: [
      { id: 'brief', name: 'Client Brief & Feasibility', description: 'Site orientation, zoning laws, and spatial program.' },
      { id: 'schematic', name: 'Schematic Design', description: 'Massing models, conceptual sections, and layout options.' },
      { id: 'sanctions', name: 'Municipal & Sanction Drawings', description: 'Local authority submissions, bylaws compliance, NOC approvals.' },
      { id: 'working_drawings', name: 'Working Drawings & MEP', description: 'Detailed GFC drawings, structural coordination, electrical layouts.' },
      { id: 'tendering', name: 'Contractor Tendering', description: 'Tender issue, BOQ comparison, contractor selection.' },
      { id: 'supervision', name: 'Site Supervision', description: 'Foundation audits, slab checks, structural signoffs.' },
      { id: 'completion', name: 'Completion & Occupancy', description: 'Occupancy certificate, snagging, archival.' },
    ],
    appointmentTypes: [
      { id: 'briefing', name: 'Feasibility Briefing', durationMins: 60, description: 'Zoning review and client program intake.' },
      { id: 'schematic_review', name: 'Schematic Design Review', durationMins: 60, description: 'Review concept schemes with stakeholders.' },
      { id: 'site_audit', name: 'Structural Site Audit', durationMins: 90, description: 'Periodic structural compliance check on site.' },
    ],
    dailyRoutine: [
      { id: 'm_arch', timeOfDay: 'morning', label: 'Structural Review & Consultant Notes', description: 'Inspect structural consultant revisions and markups.' },
      { id: 'a_arch', timeOfDay: 'afternoon', label: 'On-Site Structural Supervision', description: 'Inspect ongoing slab casting and MEP routing.' },
      { id: 'e_arch', timeOfDay: 'evening', label: 'Municipal Logs & Milestone Updates', description: 'Record compliance updates and issue revised GFC sheets.' },
    ],
    taskCategories: ['Schematics', 'Municipal Sanctions', 'GFC Drawings', 'Site Inspections', 'Consultants'],
    integrations: [
      { id: 'gmail', name: 'Gmail Workspace', description: 'Consultant coordination, tender bids, and authority correspondence.', recommended: true },
      { id: 'calendar', name: 'Google Calendar', description: 'Site audits, municipal hearings, and client coordination.', recommended: true },
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'Quick contractor on-site photo updates.', recommended: true },
      { id: 'slack', name: 'Slack', description: 'Studio design sprint updates and CAD revision alerts.', recommended: false },
    ],
    kpis: {
      primary: 'Sanction Approvals',
      secondary: 'Active Site Builds',
      tertiary: 'Inspections Scheduled',
    },
  },

  // ── 3. STARTUP ───────────────────────────────────────────────
  {
    id: 'startup',
    name: 'Startup',
    tagline: 'Product sprints, customer discovery, investor updates & automated growth.',
    description:
      'Built for tech startups and software ventures. Coordinate agile sprints, beta feedback, customer interviews, and investor milestones.',
    tailoredModules: ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'],
    pipelineStages: [
      { id: 'discovery', name: 'Customer Discovery', description: 'User research, problem validation, prototype testing.' },
      { id: 'sprint_backlog', name: 'Sprint Backlog', description: 'User stories, acceptance criteria, story pointing.' },
      { id: 'build_qa', name: 'Build & QA', description: 'Code implementation, code review, automated testing.' },
      { id: 'beta_release', name: 'Beta Release & Staging', description: 'Deploy to beta cohort, collect telemetry.' },
      { id: 'activation', name: 'Onboarding & Activation', description: 'User activation funnels, feature adoption tracking.' },
      { id: 'growth_loop', name: 'Retention & Growth Loop', description: 'Cohort analytics, upsells, referrals.' },
    ],
    appointmentTypes: [
      { id: 'user_interview', name: 'Customer Discovery Interview', durationMins: 30, description: 'Qualitative user feedback and friction discovery.' },
      { id: 'sprint_demo', name: 'Sprint Demo & Retrospective', durationMins: 45, description: 'Bi-weekly sprint review with engineering.' },
      { id: 'investor_sync', name: 'Investor & Advisory Sync', durationMins: 30, description: 'Monthly KPI update and runway governance.' },
    ],
    dailyRoutine: [
      { id: 'm_start', timeOfDay: 'morning', label: 'Standup & Blocker Triage', description: 'Review engineering sprint blockers and system health.' },
      { id: 'a_start', timeOfDay: 'afternoon', label: 'Customer Discovery & Churn Analysis', description: 'Interview active users and analyze dropoff logs.' },
      { id: 'e_start', timeOfDay: 'evening', label: 'Telemetry & Deployment Audit', description: 'Review automated release alerts and daily MRR movements.' },
    ],
    taskCategories: ['Sprint Backlog', 'Bug Triage', 'Customer Discovery', 'Growth Experiments', 'Infra'],
    integrations: [
      { id: 'slack', name: 'Slack', description: 'GitHub releases, Sentry alerts, and team standups.', recommended: true },
      { id: 'calendar', name: 'Google Calendar', description: 'Investor calls and user interview slots.', recommended: true },
      { id: 'gmail', name: 'Gmail Workspace', description: 'Enterprise lead follow-ups and advisory updates.', recommended: true },
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'High-touch founder concierge support.', recommended: false },
    ],
    kpis: {
      primary: 'Monthly Recurring Revenue',
      secondary: 'Sprint Velocity',
      tertiary: 'User Activation Rate',
    },
  },

  // ── 4. CONSULTING ────────────────────────────────────────────
  {
    id: 'consulting',
    name: 'Consulting',
    tagline: 'Advisory sessions, diagnostic audits, client notes & billable hours.',
    description:
      'Tailored for management consultants, financial strategists, and executive advisors. Track diagnostic reports, strategy decks, and client retainer milestones.',
    tailoredModules: ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'],
    pipelineStages: [
      { id: 'lead_inquiry', name: 'Discovery Intake', description: 'Initial qualification and business assessment.' },
      { id: 'diagnostic', name: 'Diagnostic Audit', description: 'Operational deep dive, stakeholder interviews.' },
      { id: 'proposal', name: 'Proposal & Scope', description: 'Statement of Work, retainer terms, deliverable roadmap.' },
      { id: 'synthesis', name: 'Strategy Synthesis', description: 'Data modeling, benchmarking, recommendations.' },
      { id: 'executive_review', name: 'Executive Presentation', description: 'Board/leadership readout and strategy alignment.' },
      { id: 'governance', name: 'Implementation Governance', description: 'Monthly oversight, KPI tracking, review cycles.' },
    ],
    appointmentTypes: [
      { id: 'diagnostic_session', name: 'Strategic Diagnostic Session', durationMins: 60, description: 'Executive stakeholder interview.' },
      { id: 'retainer_sync', name: 'Monthly Governance Review', durationMins: 45, description: 'Review KPI scorecard and operational progress.' },
    ],
    dailyRoutine: [
      { id: 'm_con', timeOfDay: 'morning', label: 'Deliverable Review & Agendas', description: 'Prepare executive agendas and review slide deck updates.' },
      { id: 'a_con', timeOfDay: 'afternoon', label: 'Client Advisory Sessions', description: 'Lead scheduled executive working sessions.' },
      { id: 'e_con', timeOfDay: 'evening', label: 'Action Items & Retainer Logs', description: 'Send synthesis notes and log billable advisory hours.' },
    ],
    taskCategories: ['Diagnostic Audits', 'Strategy Decks', 'Client Interviews', 'Retainer Governance'],
    integrations: [
      { id: 'calendar', name: 'Google Calendar', description: 'Executive advisory sessions and board meetings.', recommended: true },
      { id: 'gmail', name: 'Gmail Workspace', description: 'Executive briefing memos and deliverable submissions.', recommended: true },
      { id: 'slack', name: 'Slack', description: 'Client channel check-ins and asynchronous feedback.', recommended: true },
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'Urgent stakeholder messaging.', recommended: false },
    ],
    kpis: {
      primary: 'Active Advisory Retainers',
      secondary: 'Deliverables Due This Week',
      tertiary: 'Billed Advisory Hours',
    },
  },

  // ── 5. REAL ESTATE ───────────────────────────────────────────
  {
    id: 'real_estate',
    name: 'Real Estate',
    tagline: 'Property listings, buyer qualification, site visits & deed closings.',
    description:
      'Optimized for real estate brokerages and property developers. Manage property viewings, buyer pipelines, token agreements, and registry handovers.',
    tailoredModules: ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'],
    pipelineStages: [
      { id: 'lead_capture', name: 'Buyer & Seller Intake', description: 'Inbound property inquiry and budget qualification.' },
      { id: 'shortlist', name: 'Property Matching & Shortlist', description: 'Matching inventory to buyer preferences.' },
      { id: 'site_visit', name: 'Site Visit & Walkthrough', description: 'In-person viewing, builder amenity inspection.' },
      { id: 'token_negotiation', name: 'Token & Commercial Negotiation', description: 'Price negotiation, payment schedule agreement.' },
      { id: 'due_diligence', name: 'Legal Due Diligence', description: 'Title verification, NOCs, encumbrance certificate.' },
      { id: 'registry_handover', name: 'Registry & Deed Handover', description: 'Stamp duty payment, registration, key handover.' },
    ],
    appointmentTypes: [
      { id: 'property_walkthrough', name: 'Property Site Walkthrough', durationMins: 60, description: 'Guided tour of shortlisted unit.' },
      { id: 'closing_meeting', name: 'Agreement Signing & Token', durationMins: 45, description: 'Commercial terms finalization.' },
    ],
    dailyRoutine: [
      { id: 'm_re', timeOfDay: 'morning', label: 'Listing Inquiries & Leads', description: 'Follow up on incoming WhatsApp and portal leads.' },
      { id: 'a_re', timeOfDay: 'afternoon', label: 'Client Site Visits', description: 'Host scheduled property inspections with prospective buyers.' },
      { id: 'e_re', timeOfDay: 'evening', label: 'Token Updates & Deal Pipeline', description: 'Record buyer feedback and advance closing contracts.' },
    ],
    taskCategories: ['Property Tours', 'Title Searches', 'Token Closings', 'Registry Deadlines'],
    integrations: [
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'Instant property brochure dispatch and site visit confirmations.', recommended: true },
      { id: 'calendar', name: 'Google Calendar', description: 'Scheduled property walkthroughs and registry slots.', recommended: true },
      { id: 'gmail', name: 'Gmail Workspace', description: 'Sale deeds, title search documents, and bank loan approvals.', recommended: true },
      { id: 'slack', name: 'Slack', description: 'Brokerage team commission alerts and inventory updates.', recommended: false },
    ],
    kpis: {
      primary: 'Site Visits Scheduled',
      secondary: 'Active Buyer Pipeline',
      tertiary: 'Deals in Closing',
    },
  },

  // ── 6. CREATIVE STUDIO ───────────────────────────────────────
  {
    id: 'creative_studio',
    name: 'Creative Studio',
    tagline: 'Brand identity, creative campaigns, revision rounds & asset handoff.',
    description:
      'Engineered for design agencies, branding studios, and video production houses. Manage moodboards, feedback rounds, and finalized asset packages.',
    tailoredModules: ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'],
    pipelineStages: [
      { id: 'brand_brief', name: 'Brand Brief & Research', description: 'Visual audit, competitor analysis, creative direction.' },
      { id: 'concept_dev', name: 'Concept Exploration', description: 'Moodboards, style frames, initial directions.' },
      { id: 'review_r1', name: 'Round 1 Client Review', description: 'Present concepts and consolidate stakeholder feedback.' },
      { id: 'revisions', name: 'Refinement & Revisions', description: 'Typography, color palettes, motion asset polish.' },
      { id: 'brand_guidelines', name: 'Brand Guidelines', description: 'Comprehensive design system and usage rules.' },
      { id: 'asset_delivery', name: 'Asset Delivery & Archive', description: 'Export vector files, motion exports, cloud handover.' },
    ],
    appointmentTypes: [
      { id: 'creative_kickoff', name: 'Creative Kickoff & Briefing', durationMins: 45, description: 'Establish tone, audience, and creative goals.' },
      { id: 'concept_presentation', name: 'Concept Review Presentation', durationMins: 60, description: 'Walk through brand routes and visual assets.' },
    ],
    dailyRoutine: [
      { id: 'm_cs', timeOfDay: 'morning', label: 'Design Queue & Feedback Triage', description: 'Review client feedback notes and assign designer tickets.' },
      { id: 'a_cs', timeOfDay: 'afternoon', label: 'Asset Production & Direction', description: 'Art direction sessions and prototype reviews.' },
      { id: 'e_cs', timeOfDay: 'evening', label: 'Handoff Links & Status Updates', description: 'Share staging review links and update delivery calendar.' },
    ],
    taskCategories: ['Concepts', 'Revisions', 'Motion Assets', 'Deliverables', 'Client Reviews'],
    integrations: [
      { id: 'slack', name: 'Slack', description: 'Figma comments, revision alerts, and creative team sync.', recommended: true },
      { id: 'calendar', name: 'Google Calendar', description: 'Client review meetings and delivery milestones.', recommended: true },
      { id: 'gmail', name: 'Gmail Workspace', description: 'Formal briefs, contract signoffs, and invoice delivery.', recommended: true },
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'Quick creative asset sneak peeks.', recommended: false },
    ],
    kpis: {
      primary: 'Active Campaigns',
      secondary: 'Feedback Turnaround',
      tertiary: 'Delivered Packages',
    },
  },

  // ── 7. E-COMMERCE ────────────────────────────────────────────
  {
    id: 'ecommerce',
    name: 'E-commerce',
    tagline: 'Order processing, fulfillment tracking, support tickets & cart recovery.',
    description:
      'Crafted for direct-to-consumer (D2C) brands and online retailers. Track order fulfillment, returns, customer support tickets, and repeat purchase workflows.',
    tailoredModules: ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'],
    pipelineStages: [
      { id: 'order_inflow', name: 'Order Received', description: 'Payment verified, inventory allocated.' },
      { id: 'packaging', name: 'Pick & Pack', description: 'Warehouse pick list, packing, shipping label created.' },
      { id: 'dispatched', name: 'Dispatched & Tracking Sent', description: 'Carrier pickup, automated WhatsApp tracking notification.' },
      { id: 'in_transit', name: 'In Transit', description: 'Monitoring carrier delays, proactive exception alerts.' },
      { id: 'delivered', name: 'Delivered', description: 'Delivery confirmation, NPS review request sent.' },
      { id: 'returns_support', name: 'Returns & Exchange Triage', description: 'Reverse pickup, refund processing or replacement.' },
    ],
    appointmentTypes: [
      { id: 'vendor_sync', name: 'Supplier & Inventory Review', durationMins: 30, description: 'Weekly stock replenishment and lead times.' },
      { id: 'marketing_review', name: 'Campaign & Ad Spend Review', durationMins: 45, description: 'ROAS and CAC optimization check.' },
    ],
    dailyRoutine: [
      { id: 'm_eco', timeOfDay: 'morning', label: 'Dispatch Queue & Inventory', description: 'Verify yesterday shipping throughput and low-stock alerts.' },
      { id: 'a_eco', timeOfDay: 'afternoon', label: 'Customer Support & Returns', description: 'Clear priority customer tickets and return authorizations.' },
      { id: 'e_eco', timeOfDay: 'evening', label: 'Campaign ROI & Abandoned Carts', description: 'Audit recovery automation metrics and daily gross margin.' },
    ],
    taskCategories: ['Fulfillment', 'Stock Reorders', 'Support Tickets', 'Marketing Campaigns'],
    integrations: [
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'Automated order confirmations, tracking links, and review requests.', recommended: true },
      { id: 'gmail', name: 'Gmail Workspace', description: 'Vendor invoices and supplier communications.', recommended: true },
      { id: 'slack', name: 'Slack', description: 'Warehouse dispatch alerts and inventory thresholds.', recommended: true },
      { id: 'calendar', name: 'Google Calendar', description: 'Supplier delivery schedules and promotional launches.', recommended: false },
    ],
    kpis: {
      primary: 'Daily Order Volume',
      secondary: 'Fulfillment Time (hrs)',
      tertiary: 'Open Support Tickets',
    },
  },

  // ── 8. LEGAL ─────────────────────────────────────────────────
  {
    id: 'legal',
    name: 'Legal Practice',
    tagline: 'Case intake, contract clause review, court filings & compliance deadlines.',
    description:
      'Structured for law firms and corporate legal counsels. Track client matter files, contract review cycles, limitation dates, and confidential filings.',
    tailoredModules: ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'],
    pipelineStages: [
      { id: 'intake', name: 'Matter Intake & Conflict Check', description: 'Client intake, adverse party conflict check, retainer.' },
      { id: 'discovery_docs', name: 'Document Discovery & Brief', description: 'Evidence gathering, witness statements, brief synthesis.' },
      { id: 'drafting', name: 'Drafting & Pleadings', description: 'Plaint, written statements, affidavit drafting.' },
      { id: 'client_review', name: 'Client Review & Notarization', description: 'Client verification, signing, sworn affidavits.' },
      { id: 'filing_hearing', name: 'Filing & Court Hearing', description: 'Registry filing, hearing dates, court appearances.' },
      { id: 'resolution', name: 'Order & Matter Archival', description: 'Certified copy retrieval, judgment compliance, archival.' },
    ],
    appointmentTypes: [
      { id: 'legal_consultation', name: 'Initial Legal Consultation', durationMins: 45, description: 'Matter evaluation and legal merit assessment.' },
      { id: 'matter_briefing', name: 'Deposition & Briefing Prep', durationMins: 60, description: 'Witness preparation and case strategy sync.' },
    ],
    dailyRoutine: [
      { id: 'm_leg', timeOfDay: 'morning', label: 'Court List & Filing Deadlines', description: 'Review daily cause list and limitation deadlines.' },
      { id: 'a_leg', timeOfDay: 'afternoon', label: 'Hearings & Client Conferences', description: 'Represent matters and conduct client consultations.' },
      { id: 'e_leg', timeOfDay: 'evening', label: 'Order Sheets & Research Notes', description: 'Record daily proceedings and update matter files.' },
    ],
    taskCategories: ['Court Filings', 'Contract Reviews', 'Affidavits', 'Client Consultations'],
    integrations: [
      { id: 'calendar', name: 'Google Calendar', description: 'Court hearings, filing dates, and client appointments.', recommended: true },
      { id: 'gmail', name: 'Gmail Workspace', description: 'Privileged correspondence, court orders, and formal notices.', recommended: true },
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'Urgent hearing updates and reminder notices.', recommended: true },
      { id: 'slack', name: 'Slack', description: 'Associate research coordination.', recommended: false },
    ],
    kpis: {
      primary: 'Active Matters',
      secondary: 'Hearings Scheduled',
      tertiary: 'Pending Contract Drafts',
    },
  },

  // ── 9. FITNESS ───────────────────────────────────────────────
  {
    id: 'fitness',
    name: 'Fitness & Studio',
    tagline: 'Trial bookings, trainer schedules, membership renewals & assessments.',
    description:
      'Tailored for gyms, yoga studios, and personal training facilities. Coordinate member onboarding, class attendance, body composition audits, and automated renewals.',
    tailoredModules: ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'],
    pipelineStages: [
      { id: 'trial_inquiry', name: 'Trial Pass Inquiry', description: 'Lead intake from Instagram or walk-in, trial pass booked.' },
      { id: 'assessment', name: 'Fitness Assessment', description: 'Body composition scan, goal setting, trainer match.' },
      { id: 'membership', name: 'Membership Conversion', description: 'Plan selection, payment processing, access card issued.' },
      { id: 'active_training', name: 'Active Routine & Classes', description: 'Attendance tracking, milestone achievement.' },
      { id: 'checkin', name: 'Quarterly Goal Review', description: 'Measurement re-check, workout progression review.' },
      { id: 'renewal', name: 'Renewal & Referral', description: 'Early renewal discount, friend referral reward.' },
    ],
    appointmentTypes: [
      { id: 'trial_session', name: 'Free Studio Trial Session', durationMins: 60, description: 'Introductory workout with a certified trainer.' },
      { id: 'fitness_assessment', name: 'Body Assessment & Goal Sync', durationMins: 30, description: 'Detailed scan and custom workout blueprint.' },
    ],
    dailyRoutine: [
      { id: 'm_fit', timeOfDay: 'morning', label: 'Floor Readiness & Class Bookings', description: 'Check trainer schedules and morning class reservations.' },
      { id: 'a_fit', timeOfDay: 'afternoon', label: 'Trial Leads & Member Check-ins', description: 'Call prospective leads and check on inactive members.' },
      { id: 'e_fit', timeOfDay: 'evening', label: 'Renewals & Trainer Logs', description: 'Process daily renewals and log trainer hours.' },
    ],
    taskCategories: ['Trials', 'Assessments', 'Renewals', 'Equipment Maintenance'],
    integrations: [
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'Class slot confirmations, reminder alerts, and renewal links.', recommended: true },
      { id: 'calendar', name: 'Google Calendar', description: 'Studio schedule and personal training calendar.', recommended: true },
      { id: 'gmail', name: 'Gmail Workspace', description: 'Membership invoices and studio newsletters.', recommended: false },
      { id: 'slack', name: 'Slack', description: 'Trainer shift handovers and maintenance alerts.', recommended: false },
    ],
    kpis: {
      primary: 'Active Members',
      secondary: 'Monthly Renewals Due',
      tertiary: 'Trial Conversion Rate',
    },
  },

  // ── 10. HEALTHCARE ───────────────────────────────────────────
  {
    id: 'healthcare',
    name: 'Healthcare & Clinic',
    tagline: 'Patient consultations, treatment records, lab follow-ups & appointment reminders.',
    description:
      'Engineered for medical clinics, dental practices, and wellness centers. Manage patient appointments, treatment plans, lab diagnostics, and recall alerts.',
    tailoredModules: ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'],
    pipelineStages: [
      { id: 'patient_intake', name: 'Appointment Booking', description: 'Symptom inquiry, doctor slot selection, confirmation.' },
      { id: 'consultation', name: 'Doctor Consultation', description: 'Clinical examination, diagnosis, digital prescription.' },
      { id: 'diagnostics', name: 'Diagnostic Tests', description: 'Blood work, imaging, specialist referral.' },
      { id: 'treatment_plan', name: 'Treatment & Procedure', description: 'Follow-up procedure, in-clinic treatment session.' },
      { id: 'post_care', name: 'Post-Care Checkup', description: 'Recovery monitoring, prescription refill verification.' },
      { id: 'recall', name: 'Preventative Recall', description: '6-month dental cleaning, annual health check reminder.' },
    ],
    appointmentTypes: [
      { id: 'consultation_slot', name: 'General Consultation', durationMins: 30, description: 'Clinical checkup and prescription.' },
      { id: 'procedure_slot', name: 'Clinical Procedure / Therapy', durationMins: 60, description: 'Specialized clinical treatment or therapy.' },
    ],
    dailyRoutine: [
      { id: 'm_hc', timeOfDay: 'morning', label: 'Patient Queue & Lab Reports', description: 'Review overnight diagnostic reports and morning appointments.' },
      { id: 'a_hc', timeOfDay: 'afternoon', label: 'Patient Consultations & Procedures', description: 'Conduct clinical sessions and update treatment records.' },
      { id: 'e_hc', timeOfDay: 'evening', label: 'Follow-up Recalls & Schedule Prep', description: 'Send automated medication reminders and review tomorrow list.' },
    ],
    taskCategories: ['Consultations', 'Lab Reports', 'Prescriptions', 'Patient Recalls'],
    integrations: [
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'Appointment reminder pings and digital prescription dispatch.', recommended: true },
      { id: 'calendar', name: 'Google Calendar', description: 'Doctor consulting slots and procedure room availability.', recommended: true },
      { id: 'gmail', name: 'Gmail Workspace', description: 'Diagnostic lab results and specialist referrals.', recommended: true },
      { id: 'slack', name: 'Slack', description: 'Clinic front desk and nursing staff alerts.', recommended: false },
    ],
    kpis: {
      primary: 'Appointments Today',
      secondary: 'Lab Reports Pending',
      tertiary: 'Patient Recalls Due',
    },
  },
];

/** Flagship preset: Interior Design */
export const FLAGSHIP_PRESET: BusinessPreset = BUSINESS_PRESETS[0]!;

/** Lookup preset by exact id */
export function getPresetById(presetId: string | null | undefined): BusinessPreset | undefined {
  if (!presetId) return undefined;
  return BUSINESS_PRESETS.find((p) => p.id === presetId.toLowerCase());
}

/**
 * Infer or match preset from client businessType string,
 * defaulting to Interior Design flagship if unknown.
 */
export function getPresetByBusinessType(businessType: string | null | undefined): BusinessPreset {
  if (!businessType) return FLAGSHIP_PRESET;
  const normalized = businessType.toLowerCase().trim();

  // Exact ID check
  const exact = BUSINESS_PRESETS.find((p) => p.id === normalized);
  if (exact) return exact;

  // Fuzzy keyword matching (specific industry keywords first)
  if (normalized.includes('interior') || normalized.includes('decor') || normalized.includes('furnish')) {
    return BUSINESS_PRESETS.find((p) => p.id === 'interior_design')!;
  }
  if (normalized.includes('arch') || normalized.includes('civil') || normalized.includes('construction')) {
    return BUSINESS_PRESETS.find((p) => p.id === 'architecture')!;
  }
  if (normalized.includes('ecom') || normalized.includes('commerce') || normalized.includes('retail') || normalized.includes('shop') || normalized.includes('d2c') || normalized.includes('store')) {
    return BUSINESS_PRESETS.find((p) => p.id === 'ecommerce')!;
  }
  if (normalized.includes('start') || normalized.includes('tech') || normalized.includes('saas') || normalized.includes('software')) {
    return BUSINESS_PRESETS.find((p) => p.id === 'startup')!;
  }
  if (normalized.includes('estate') || normalized.includes('realt') || normalized.includes('propert') || normalized.includes('broker')) {
    return BUSINESS_PRESETS.find((p) => p.id === 'real_estate')!;
  }
  if (normalized.includes('law') || normalized.includes('legal') || normalized.includes('court') || normalized.includes('attorney')) {
    return BUSINESS_PRESETS.find((p) => p.id === 'legal')!;
  }
  if (normalized.includes('fit') || normalized.includes('gym') || normalized.includes('yoga') || normalized.includes('workout')) {
    return BUSINESS_PRESETS.find((p) => p.id === 'fitness')!;
  }
  if (normalized.includes('health') || normalized.includes('clinic') || normalized.includes('medic') || normalized.includes('doctor') || normalized.includes('dent')) {
    return BUSINESS_PRESETS.find((p) => p.id === 'healthcare')!;
  }
  if (normalized.includes('consult') || normalized.includes('advis') || normalized.includes('strat')) {
    return BUSINESS_PRESETS.find((p) => p.id === 'consulting')!;
  }
  if (normalized.includes('creat') || normalized.includes('brand') || normalized.includes('design') || normalized.includes('agency') || normalized.includes('studio')) {
    return BUSINESS_PRESETS.find((p) => p.id === 'creative_studio')!;
  }

  // Fallback to flagship Interior Design
  return FLAGSHIP_PRESET;
}

/** Get all presets */
export function getAllPresets(): BusinessPreset[] {
  return BUSINESS_PRESETS;
}
