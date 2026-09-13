/**
 * NorthForge domain model.
 *
 * These types mirror `server/src/schema.sql` exactly. If a field is added
 * to the database it must be added here (and vice versa) — the service
 * layer is typed against both.
 */

export type ID = string;

/* ── Enums ───────────────────────────────────────────────────── */

export type Role = 'client' | 'admin' | 'super_admin';

export type LeadStatus = 'new' | 'qualified' | 'contacted' | 'proposal' | 'won' | 'lost';
export type LeadSource = 'website' | 'whatsapp' | 'referral' | 'outreach' | 'manual' | 'call' | 'other';

export type ProjectStage = 'discovery' | 'design' | 'development' | 'review' | 'launch' | 'optimization';
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type WebsiteStatus = 'draft' | 'building' | 'review' | 'live' | 'paused' | 'offline';
export type DeploymentStatus = 'pending' | 'building' | 'live' | 'failed';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export type RequestType = 'website_change' | 'content_change' | 'technical_issue' | 'automation' | 'general';
export type RequestStatus = 'open' | 'in_progress' | 'blocked' | 'resolved' | 'closed';

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'error';
export type WorkflowNodeType =
  | 'trigger'
  | 'condition'
  | 'ai'
  | 'action'
  | 'notification'
  | 'whatsapp'
  | 'delay'
  | 'update_record'
  | 'create_task'
  | 'book_appointment';

export type HealthState = 'operational' | 'degraded' | 'offline' | 'checking' | 'unknown';
export type NotificationKind = 'lead' | 'task' | 'billing' | 'system' | 'request' | 'automation' | 'message';

export type AIRole = 'user' | 'assistant' | 'system';
export type AIActionKind = 'read' | 'write' | 'navigate';

/* ── People & accounts ───────────────────────────────────────── */

export interface User {
  id: ID;
  email: string;
  name: string;
  role: Role;
  clientId: ID | null;
  avatarUrl: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Client {
  id: ID;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  businessType: string | null;
  city: string | null;
  state: string | null;
  planId: ID | null;
  status: 'lead' | 'onboarding' | 'active' | 'paused' | 'churned';
  websiteUrl: string | null;
  onboardingStep: number;
  onboardingCompleted: boolean;
  notes: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ── Sales ───────────────────────────────────────────────────── */

export interface Lead {
  id: ID;
  clientId: ID | null;
  businessName: string | null;
  contactName: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  score: number;
  value: number | null;
  message: string | null;
  intent: string | null;
  nextAction: string | null;
  ownerId: ID | null;
  aiSummary: string | null;
  aiQualification: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: ID;
  leadId: ID | null;
  clientId: ID | null;
  title: string;
  dueAt: string;
  channel: 'call' | 'whatsapp' | 'email' | 'meeting';
  status: 'pending' | 'done' | 'missed';
  notes: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface Proposal {
  id: ID;
  clientId: ID | null;
  leadId: ID | null;
  title: string;
  summary: string | null;
  amount: number;
  currency: string;
  status: ProposalStatus;
  validUntil: string | null;
  lineItems: ProposalLineItem[];
  isDemo: boolean;
  createdAt: string;
}

export interface ProposalLineItem {
  label: string;
  description?: string;
  amount: number;
}

export interface OutreachSequence {
  id: ID;
  name: string;
  channel: 'email' | 'whatsapp' | 'mixed';
  status: 'draft' | 'active' | 'paused' | 'completed';
  contacts: number;
  replied: number;
  steps: OutreachStep[];
  isDemo: boolean;
  createdAt: string;
}

export interface OutreachStep {
  label: string;
  delay: string;
  template: string;
}

/* ── Delivery ────────────────────────────────────────────────── */

export interface Project {
  id: ID;
  clientId: ID;
  name: string;
  stage: ProjectStage;
  status: ProjectStatus;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  notes: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: ID;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  projectId: ID | null;
  clientId: ID | null;
  assigneeId: ID | null;
  dueDate: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Website {
  id: ID;
  clientId: ID;
  name: string;
  domain: string | null;
  url: string | null;
  status: WebsiteStatus;
  deployment: DeploymentStatus;
  ssl: boolean;
  hosting: string | null;
  framework: string | null;
  lastDeployedAt: string | null;
  lastUpdatedAt: string | null;
  maintenance: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface WebsiteAnalytics {
  id: ID;
  websiteId: ID;
  date: string;
  visitors: number;
  sessions: number;
  leads: number;
  whatsappClicks: number;
  bookings: number;
}

export interface Booking {
  id: ID;
  clientId: ID;
  customerName: string;
  customerPhone: string | null;
  email: string | null;
  service: string | null;
  startsAt: string;
  durationMins: number;
  status: AppointmentStatus;
  reminderSent: boolean;
  notes: string | null;
  isDemo: boolean;
  createdAt: string;
}

/* ── Billing ─────────────────────────────────────────────────── */

export interface Plan {
  id: ID;
  slug: 'lead' | 'convert' | 'autopilot' | 'custom';
  name: string;
  /** Recurring amount in the smallest currency unit (paise) — avoids float drift. */
  amount: number | null;
  /**
   * One-time setup fee in paise, charged before the first billing cycle.
   * Covers discovery, workflow mapping, configuration, integrations,
   * testing, deployment and staff handover.
   */
  setupAmount: number | null;
  currency: string;
  /** Billing interval in days. NorthForge bills monthly (30 days). */
  intervalDays: number;
  tagline: string;
  /** The business outcome this plan is sold on — not a feature list. */
  outcome: string;
  description: string;
  features: string[];
  /** Scope matrix shown as a comparison table. Values are display strings. */
  scope: Record<string, string>;
  limits: PlanLimits;
  recommended: boolean;
  sortOrder: number;
}

export interface PlanLimits {
  /** Active automated workflows. -1 means "scoped / unlimited by agreement". */
  workflows: number;
  integrations: number;
  aiAgents: number;
  automationRuns: number;
  users: number;
}

export interface Service {
  id: ID;
  slug: string;
  name: string;
  group: 'automation' | 'ai' | 'crm' | 'build' | 'support';
  description: string;
  /** One-time price in paise; null means "included" or "quoted". */
  priceFrom: number | null;
  unit: 'one_time' | 'monthly' | 'included' | 'quoted';
  active: boolean;
}

export interface Subscription {
  id: ID;
  clientId: ID;
  planId: ID;
  status: SubscriptionStatus;
  startedAt: string;
  renewsAt: string | null;
  cancelAt: string | null;
  seats: number;
  isDemo: boolean;
}

export interface Invoice {
  id: ID;
  number: string;
  clientId: ID;
  subscriptionId: ID | null;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  lineItems: ProposalLineItem[];
  isDemo: boolean;
}

export interface Payment {
  id: ID;
  invoiceId: ID | null;
  clientId: ID;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  paidAt: string;
  isDemo: boolean;
}

/* ── Automation ──────────────────────────────────────────────── */

export interface Workflow {
  id: ID;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  trigger: string;
  runs: number;
  lastRunAt: string | null;
  nodes: WorkflowNode[];
  isDemo: boolean;
  createdAt: string;
}

export interface WorkflowNode {
  id: ID;
  workflowId: ID;
  type: WorkflowNodeType;
  label: string;
  config: Record<string, unknown>;
  x: number;
  y: number;
  sortOrder: number;
}

export interface WhatsAppTemplate {
  id: ID;
  name: string;
  category: 'utility' | 'marketing' | 'authentication';
  body: string;
  status: 'approved' | 'pending' | 'rejected';
  language: string;
  uses: number;
  isDemo: boolean;
}

export interface WhatsAppMessage {
  id: ID;
  clientId: ID | null;
  direction: 'inbound' | 'outbound';
  to: string;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  templateId: ID | null;
  automated: boolean;
  createdAt: string;
  isDemo: boolean;
}


/* ── Support, requests, system ───────────────────────────────── */

export interface ClientRequest {
  id: ID;
  clientId: ID;
  title: string;
  description: string;
  type: RequestType;
  priority: Priority;
  status: RequestStatus;
  attachments: Attachment[];
  activity: ActivityEntry[];
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
}

export interface Ticket {
  id: ID;
  clientId: ID | null;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  category: string | null;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
}

export interface TicketMessage {
  id: ID;
  author: string;
  authorRole: 'client' | 'admin' | 'ai';
  body: string;
  internal: boolean;
  createdAt: string;
}

export interface Attachment {
  id: ID;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface ActivityEntry {
  id: ID;
  /** Human-readable, e.g. "Lead qualified". */
  label: string;
  detail: string | null;
  actor: string;
  createdAt: string;
}

export interface ActivityRecord {
  id: ID;
  type: string;
  label: string;
  detail: string | null;
  actor: string;
  actorRole: Role | 'system';
  entityType: string | null;
  entityId: ID | null;
  clientId: ID | null;
  createdAt: string;
  isDemo: boolean;
}

export interface NotificationRecord {
  id: ID;
  userId: ID;
  kind: NotificationKind;
  title: string;
  body: string | null;
  read: boolean;
  href: string | null;
  entityType: string | null;
  entityId: ID | null;
  createdAt: string;
}

export interface SystemHealthComponent {
  key: string;
  label: string;
  state: HealthState;
  detail: string;
  latencyMs: number | null;
  checkedAt: string;
}

export interface SystemHealthReport {
  state: HealthState;
  checkedAt: string;
  components: SystemHealthComponent[];
}

export interface OnboardingDraft {
  clientId: ID | null;
  currentStep: number;
  completed: boolean;
  data: Record<string, unknown>;
  updatedAt: string;
}

/* ── Announcements (§18) ─────────────────────────────────────── */

export type AnnouncementPriority = 'normal' | 'high' | 'critical';
export type AnnouncementAudience = 'all_clients' | 'selected_clients' | 'internal_admins';

export interface Announcement {
  id: ID;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  clientIds: ID[];
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  isDemo: boolean;
}

/* ── Notification preferences (§6) ───────────────────────────── */

export interface NotificationPreferences {
  projectUpdates: boolean;
  leads: boolean;
  appointments: boolean;
  billing: boolean;
  support: boolean;
  marketing: boolean;
  system: boolean;
}

/* ── Milestones (§25) ────────────────────────────────────────── */

export type MilestoneStatus = 'planning' | 'in_progress' | 'completed';

export interface Milestone {
  id: ID;
  projectId: ID;
  clientId: ID;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  sortOrder: number;
  dueDate: string | null;
  completedAt: string | null;
  isDemo: boolean;
  createdAt: string;
}

/* ── Files (§26) ─────────────────────────────────────────────── */

export interface FileRecord {
  id: ID;
  clientId: ID;
  name: string;
  storagePath: string;
  sizeBytes: number;
  mimeType: string | null;
  createdAt: string;
}


/* ── Metrics & API envelope ──────────────────────────────────── */

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface ClientDashboard {
  client: Client;
  website: Website | null;
  project: Project | null;
  subscription: Subscription | null;
  plan: Plan | null;
  metrics: {
    leadsTotal: number;
    leadsNew: number;
    leadsQualified: number;
    leadsContacted: number;
    leadsConverted: number;
    conversionRate: number | null;
    visitors: number | null;
    whatsappClicks: number | null;
    bookings: number;
    openRequests: number;
  };
  series: SeriesPoint[];
  upcomingBookings: Booking[];
  recentActivity: ActivityRecord[];
  hasData: boolean;
}

export interface AdminDashboard {
  metrics: {
    revenue: number;
    recurringRevenue: number;
    leads: number;
    conversionRate: number | null;
    activeClients: number;
    activeProjects: number;
    openTasks: number;
    systemHealth: HealthState;
  };
  pipeline: { status: LeadStatus; count: number; value: number }[];
  series: SeriesPoint[];
  recentActivity: ActivityRecord[];
  openTasks: Task[];
  workflows: Workflow[];
  hasData: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Every API response uses this shape so the client never guesses. */
export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  fields?: Record<string, string>;
}

export class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status = 400, code = 'error', fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
