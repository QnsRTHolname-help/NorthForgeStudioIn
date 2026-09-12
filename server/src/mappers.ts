import { parseJson, toBool } from './db';
import type {
  ActivityEntry,
  Attachment,
  Booking,
  Client,
  ClientRequest,
  FollowUp,
  Invoice,
  Lead,
  OutreachSequence,
  OutreachStep,
  Payment,
  Project,
  Proposal,
  ProposalLineItem,
  Subscription,
  Task,
  Ticket,
  TicketMessage,
  User,
  Website,
  WebsiteAnalytics,
  WhatsAppMessage,
  WhatsAppTemplate,
  Workflow,
  WorkflowNode,
  Plan,
} from '@shared/types';
import type { Role } from '@shared/types';

type Row = Record<string, unknown>;

const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
const n = (v: unknown) => Number(v ?? 0);
const b = (v: unknown) => toBool(v);
const d = (v: unknown) => (v ? String(v) : null);

export function mapUser(row: Row): User {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as Role,
    clientId: s(row.client_id),
    avatarUrl: s(row.avatar_url),
    phone: s(row.phone),
    lastLoginAt: d(row.last_login_at),
    createdAt: String(row.created_at),
  };
}

/** Public-safe user projection — never includes password_hash. */
export function publicUser(row: Row) {
  const user = mapUser(row);
  return user;
}

export function mapClient(row: Row): Client {
  return {
    id: String(row.id),
    businessName: String(row.business_name),
    contactName: String(row.contact_name),
    email: String(row.email),
    phone: s(row.phone),
    businessType: s(row.business_type),
    city: s(row.city),
    state: s(row.state),
    planId: s(row.plan_id),
    status: String(row.status) as Client['status'],
    websiteUrl: s(row.website_url),
    onboardingStep: n(row.onboarding_step),
    onboardingCompleted: b(row.onboarding_completed),
    notes: s(row.notes),
    isDemo: b(row.is_demo),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapLead(row: Row): Lead {
  return {
    id: String(row.id),
    clientId: s(row.client_id),
    businessName: s(row.business_name),
    contactName: String(row.contact_name),
    email: s(row.email),
    phone: s(row.phone),
    source: String(row.source) as Lead['source'],
    status: String(row.status) as Lead['status'],
    score: n(row.score),
    value: row.value === null || row.value === undefined ? null : n(row.value),
    message: s(row.message),
    intent: s(row.intent),
    nextAction: s(row.next_action),
    ownerId: s(row.owner_id),
    aiSummary: s(row.ai_summary),
    aiQualification: s(row.ai_qualification),
    isDemo: b(row.is_demo),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapFollowUp(row: Row): FollowUp {
  return {
    id: String(row.id),
    leadId: s(row.lead_id),
    clientId: s(row.client_id),
    title: String(row.title),
    dueAt: String(row.due_at),
    channel: String(row.channel) as FollowUp['channel'],
    status: String(row.status) as FollowUp['status'],
    notes: s(row.notes),
    isDemo: b(row.is_demo),
    createdAt: String(row.created_at),
  };
}

export function mapProposal(row: Row): Proposal {
  return {
    id: String(row.id),
    clientId: s(row.client_id),
    leadId: s(row.lead_id),
    title: String(row.title),
    summary: s(row.summary),
    amount: n(row.amount),
    currency: String(row.currency ?? 'INR'),
    status: String(row.status) as Proposal['status'],
    validUntil: d(row.valid_until),
    lineItems: parseJson<ProposalLineItem[]>(row.line_items, []),
    isDemo: b(row.is_demo),
    createdAt: String(row.created_at),
  };
}

export function mapOutreach(row: Row): OutreachSequence {
  return {
    id: String(row.id),
    name: String(row.name),
    channel: String(row.channel) as OutreachSequence['channel'],
    status: String(row.status) as OutreachSequence['status'],
    contacts: n(row.contacts),
    replied: n(row.replied),
    steps: parseJson<OutreachStep[]>(row.steps, []),
    isDemo: b(row.is_demo),
    createdAt: String(row.created_at),
  };
}

export function mapProject(row: Row): Project {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    name: String(row.name),
    stage: String(row.stage) as Project['stage'],
    status: String(row.status) as Project['status'],
    progress: n(row.progress),
    startDate: d(row.start_date),
    dueDate: d(row.due_date),
    notes: s(row.notes),
    isDemo: b(row.is_demo),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapTask(row: Row): Task {
  return {
    id: String(row.id),
    title: String(row.title),
    description: s(row.description),
    status: String(row.status) as Task['status'],
    priority: String(row.priority) as Task['priority'],
    projectId: s(row.project_id),
    clientId: s(row.client_id),
    assigneeId: s(row.assignee_id),
    dueDate: d(row.due_date),
    isDemo: b(row.is_demo),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapWebsite(row: Row): Website {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    name: String(row.name),
    domain: s(row.domain),
    url: s(row.url),
    status: String(row.status) as Website['status'],
    deployment: String(row.deployment) as Website['deployment'],
    ssl: b(row.ssl),
    hosting: s(row.hosting),
    framework: s(row.framework),
    lastDeployedAt: d(row.last_deployed_at),
    lastUpdatedAt: d(row.last_updated_at),
    maintenance: b(row.maintenance),
    isDemo: b(row.is_demo),
    createdAt: String(row.created_at),
  };
}

export function mapAnalytics(row: Row): WebsiteAnalytics {
  return {
    id: String(row.id),
    websiteId: String(row.website_id),
    date: String(row.date),
    visitors: n(row.visitors),
    sessions: n(row.sessions),
    leads: n(row.leads),
    whatsappClicks: n(row.whatsapp_clicks),
    bookings: n(row.bookings),
  };
}

export function mapBooking(row: Row): Booking {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    customerName: String(row.customer_name),
    customerPhone: s(row.customer_phone),
    email: s(row.email),
    service: s(row.service),
    startsAt: String(row.starts_at),
    durationMins: n(row.duration_mins),
    status: String(row.status) as Booking['status'],
    reminderSent: b(row.reminder_sent),
    notes: s(row.notes),
    isDemo: b(row.is_demo),
    createdAt: String(row.created_at),
  };
}

export function mapSubscription(row: Row): Subscription {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    planId: String(row.plan_id),
    status: String(row.status) as Subscription['status'],
    startedAt: String(row.started_at),
    renewsAt: d(row.renews_at),
    cancelAt: d(row.cancel_at),
    seats: n(row.seats),
    isDemo: b(row.is_demo),
  };
}

export function mapInvoice(row: Row): Invoice {
  return {
    id: String(row.id),
    number: String(row.number),
    clientId: String(row.client_id),
    subscriptionId: s(row.subscription_id),
    amount: n(row.amount),
    tax: n(row.tax),
    total: n(row.total),
    currency: String(row.currency ?? 'INR'),
    status: String(row.status) as Invoice['status'],
    issuedAt: String(row.issued_at),
    dueAt: String(row.due_at),
    paidAt: d(row.paid_at),
    lineItems: parseJson<ProposalLineItem[]>(row.line_items, []),
    isDemo: b(row.is_demo),
  };
}

export function mapPayment(row: Row): Payment {
  return {
    id: String(row.id),
    invoiceId: s(row.invoice_id),
    clientId: String(row.client_id),
    amount: n(row.amount),
    currency: String(row.currency ?? 'INR'),
    status: String(row.status) as Payment['status'],
    method: s(row.method),
    paidAt: String(row.paid_at),
    isDemo: b(row.is_demo),
  };
}

export function mapWorkflow(row: Row): Workflow {
  return {
    id: String(row.id),
    name: String(row.name),
    description: s(row.description),
    status: String(row.status) as Workflow['status'],
    trigger: String(row.trigger),
    runs: n(row.runs),
    lastRunAt: d(row.last_run_at),
    isDemo: b(row.is_demo),
    createdAt: String(row.created_at),
    nodes: [],
  };
}

export function mapWorkflowNode(row: Row): WorkflowNode {
  return {
    id: String(row.id),
    workflowId: String(row.workflow_id),
    type: String(row.type) as WorkflowNode['type'],
    label: String(row.label),
    config: parseJson<Record<string, unknown>>(row.config, {}),
    x: n(row.x),
    y: n(row.y),
    sortOrder: n(row.sort_order),
  };
}

export function mapTemplate(row: Row): WhatsAppTemplate {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category) as WhatsAppTemplate['category'],
    body: String(row.body),
    status: String(row.status) as WhatsAppTemplate['status'],
    language: String(row.language ?? 'en'),
    uses: n(row.uses),
    isDemo: b(row.is_demo),
  };
}

export function mapMessage(row: Row): WhatsAppMessage {
  return {
    id: String(row.id),
    clientId: s(row.client_id),
    direction: String(row.direction) as WhatsAppMessage['direction'],
    to: String(row.to_number),
    body: String(row.body),
    status: String(row.status) as WhatsAppMessage['status'],
    templateId: s(row.template_id),
    automated: b(row.automated),
    createdAt: String(row.created_at),
    isDemo: b(row.is_demo),
  };
}


export function mapRequest(row: Row): ClientRequest {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    title: String(row.title),
    description: String(row.description ?? ''),
    type: String(row.type) as ClientRequest['type'],
    priority: String(row.priority) as ClientRequest['priority'],
    status: String(row.status) as ClientRequest['status'],
    attachments: parseJson<Attachment[]>(row.attachments, []),
    activity: parseJson<ActivityEntry[]>(row.activity, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    isDemo: b(row.is_demo),
  };
}

export function mapTicket(row: Row): Ticket {
  return {
    id: String(row.id),
    clientId: s(row.client_id),
    subject: String(row.subject),
    status: String(row.status) as Ticket['status'],
    priority: String(row.priority) as Ticket['priority'],
    category: s(row.category),
    messages: parseJson<TicketMessage[]>(row.messages, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    isDemo: b(row.is_demo),
  };
}

export function mapPlan(plan: Plan): Plan {
  return plan;
}
