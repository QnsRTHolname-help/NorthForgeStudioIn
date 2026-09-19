import type {
  ActivityRecord, Announcement, Booking, Client, ClientRequest, FileRecord, FollowUp, Invoice,
  Lead, Milestone, NotificationPreferences, NotificationRecord, Payment, Project, Proposal,
  Subscription, Task, Ticket, Website, WhatsAppMessage, WhatsAppTemplate, Workflow, WorkflowNode,
} from '@/types';

/**
 * Row → domain mappers (part 1: people, sales, delivery).
 *
 * The database speaks snake_case; the application speaks camelCase
 * (shared/types.ts). Mapping lives here so no query result ever leaks a
 * raw row into the UI, and so missing columns fail visibly instead of
 * silently producing `undefined` in components.
 */

/* ── People & accounts ──────────────────────────────────────── */

export function mapClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    businessName: String(row.business_name ?? ''),
    contactName: String(row.contact_name ?? ''),
    email: String(row.email ?? ''),
    phone: (row.phone as string) ?? null,
    businessType: (row.business_type as string) ?? null,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    planId: (row.plan_id as string) ?? null,
    status: (row.status as Client['status']) ?? 'lead',
    websiteUrl: (row.website_url as string) ?? null,
    onboardingStep: Number(row.onboarding_step ?? 0),
    onboardingCompleted: Boolean(row.onboarding_completed ?? false),
    notes: (row.notes as string) ?? null,
    isDemo: Boolean(row.is_demo ?? false),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

/* ── Sales ──────────────────────────────────────────────────── */

export function mapLead(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id),
    clientId: (row.client_id as string) ?? null,
    businessName: (row.business_name as string) ?? null,
    contactName: String(row.contact_name ?? ''),
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    source: (row.source as Lead['source']) ?? 'website',
    status: (row.status as Lead['status']) ?? 'new',
    score: Number(row.score ?? 0),
    value: (row.value as number) ?? null,
    message: (row.message as string) ?? null,
    intent: (row.intent as string) ?? null,
    nextAction: (row.next_action as string) ?? null,
    ownerId: (row.owner_id as string) ?? null,
    aiSummary: (row.ai_summary as string) ?? null,
    aiQualification: (row.ai_qualification as string) ?? null,
    isDemo: Boolean(row.is_demo ?? false),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapFollowUp(row: Record<string, unknown>): FollowUp {
  return {
    id: String(row.id),
    leadId: (row.lead_id as string) ?? null,
    clientId: (row.client_id as string) ?? null,
    title: String(row.title ?? ''),
    dueAt: String(row.due_at ?? ''),
    channel: (row.channel as FollowUp['channel']) ?? 'call',
    status: (row.status as FollowUp['status']) ?? 'pending',
    notes: (row.notes as string) ?? null,
    isDemo: Boolean(row.is_demo ?? false),
    createdAt: String(row.created_at ?? ''),
  };
}

export function mapProposal(row: Record<string, unknown>): Proposal {
  return {
    id: String(row.id),
    clientId: (row.client_id as string) ?? null,
    leadId: (row.lead_id as string) ?? null,
    title: String(row.title ?? ''),
    summary: (row.summary as string) ?? null,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'INR'),
    status: (row.status as Proposal['status']) ?? 'draft',
    validUntil: (row.valid_until as string) ?? null,
    lineItems: Array.isArray(row.line_items) ? (row.line_items as Proposal['lineItems']) : [],
    isDemo: Boolean(row.is_demo ?? false),
    createdAt: String(row.created_at ?? ''),
  };
}

/* ── Delivery ── */

export function mapProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    clientId: String(row.client_id ?? ''),
    name: String(row.name ?? ''),
    stage: (row.stage as Project['stage']) ?? 'discovery',
    status: (row.status as Project['status']) ?? 'planning',
    progress: Number(row.progress ?? 0),
    startDate: (row.start_date as string) ?? null,
    dueDate: (row.due_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    isDemo: Boolean(row.is_demo ?? false),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    description: (row.description as string) ?? null,
    status: (row.status as Task['status']) ?? 'todo',
    priority: (row.priority as Task['priority']) ?? 'medium',
    projectId: (row.project_id as string) ?? null,
    clientId: (row.client_id as string) ?? null,
    assigneeId: (row.assignee_id as string) ?? null,
    dueDate: (row.due_date as string) ?? null,
    isDemo: Boolean(row.is_demo ?? false),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapWebsite(row: Record<string, unknown>): Website {
  return {
    id: String(row.id),
    clientId: String(row.client_id ?? ''),
    name: String(row.name ?? ''),
    domain: (row.domain as string) ?? null,
    url: (row.url as string) ?? null,
    status: (row.status as Website['status']) ?? 'draft',
    deployment: (row.deployment as Website['deployment']) ?? 'pending',
    ssl: Boolean(row.ssl ?? false),
    hosting: (row.hosting as string) ?? null,
    framework: (row.framework as string) ?? null,
    lastDeployedAt: (row.last_deployed_at as string) ?? null,
    lastUpdatedAt: (row.last_updated_at as string) ?? null,
    maintenance: Boolean(row.maintenance ?? false),
    isDemo: Boolean(row.is_demo ?? false),
    createdAt: String(row.created_at ?? ''),
  };
}

export function mapBooking(row: Record<string, unknown>): Booking {
  return {
    id: String(row.id),
    clientId: String(row.client_id ?? ''),
    customerName: String(row.customer_name ?? ''),
    customerPhone: (row.customer_phone as string) ?? null,
    email: (row.email as string) ?? null,
    service: (row.service as string) ?? null,
    startsAt: String(row.starts_at ?? ''),
    durationMins: Number(row.duration_mins ?? 30),
    status: (row.status as Booking['status']) ?? 'pending',
    reminderSent: Boolean(row.reminder_sent ?? false),
    notes: (row.notes as string) ?? null,
    isDemo: Boolean(row.is_demo ?? false),
    createdAt: String(row.created_at ?? ''),
  };
}

/* ── Billing ── */

export function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.id),
    clientId: String(row.client_id ?? ''),
    planId: String(row.plan_id ?? ''),
    status: (row.status as Subscription['status']) ?? 'active',
    startedAt: String(row.started_at ?? ''),
    renewsAt: (row.renews_at as string) ?? null,
    cancelAt: (row.cancel_at as string) ?? null,
    seats: Number(row.seats ?? 1),
    isDemo: Boolean(row.is_demo ?? false),
    cancelledAt: (row.cancelled_at as string) ?? null,
    cancellationReason: (row.cancellation_reason as string) ?? null,
    cancelledBy: (row.cancelled_by as Subscription['cancelledBy']) ?? null,
  };
}

export function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    number: String(row.number ?? ''),
    clientId: String(row.client_id ?? ''),
    subscriptionId: (row.subscription_id as string) ?? null,
    amount: Number(row.amount ?? 0),
    tax: Number(row.tax ?? 0),
    total: Number(row.total ?? 0),
    currency: String(row.currency ?? 'INR'),
    status: (row.status as Invoice['status']) ?? 'draft',
    issuedAt: String(row.issued_at ?? ''),
    dueAt: String(row.due_at ?? ''),
    paidAt: (row.paid_at as string) ?? null,
    lineItems: Array.isArray(row.line_items) ? (row.line_items as Invoice['lineItems']) : [],
    isDemo: Boolean(row.is_demo ?? false),
    billedTo: (row.billed_to as string) ?? null,
  };
}

export function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: String(row.id),
    invoiceId: (row.invoice_id as string) ?? null,
    clientId: String(row.client_id ?? ''),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'INR'),
    status: (row.status as Payment['status']) ?? 'pending',
    method: (row.method as string) ?? null,
    paidAt: String(row.paid_at ?? ''),
    isDemo: Boolean(row.is_demo ?? false),
    billedTo: (row.billed_to as string) ?? null,
  };
}

/* ── Automation ── */

export function mapWorkflow(row: Record<string, unknown>, nodes?: Record<string, unknown>[]): Workflow {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: (row.description as string) ?? null,
    status: (row.status as Workflow['status']) ?? 'draft',
    trigger: String(row.trigger ?? 'lead.created'),
    runs: Number(row.runs ?? 0),
    lastRunAt: (row.last_run_at as string) ?? null,
    nodes: (nodes ?? []).map(mapWorkflowNode),
    isDemo: Boolean(row.is_demo ?? false),
    createdAt: String(row.created_at ?? ''),
  };
}

export function mapWorkflowNode(row: Record<string, unknown>): WorkflowNode {
  return {
    id: String(row.id),
    workflowId: String(row.workflow_id ?? ''),
    type: (row.type as WorkflowNode['type']) ?? 'action',
    label: String(row.label ?? ''),
    config: (row.config as Record<string, unknown>) ?? {},
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function mapWhatsAppTemplate(row: Record<string, unknown>): WhatsAppTemplate {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    category: (row.category as WhatsAppTemplate['category']) ?? 'utility',
    body: String(row.body ?? ''),
    status: (row.status as WhatsAppTemplate['status']) ?? 'pending',
    language: String(row.language ?? 'en'),
    uses: Number(row.uses ?? 0),
    isDemo: Boolean(row.is_demo ?? false),
  };
}

export function mapWhatsAppMessage(row: Record<string, unknown>): WhatsAppMessage {
  return {
    id: String(row.id),
    clientId: (row.client_id as string) ?? null,
    direction: (row.direction as WhatsAppMessage['direction']) ?? 'outbound',
    to: String(row.to_number ?? ''),
    body: String(row.body ?? ''),
    status: (row.status as WhatsAppMessage['status']) ?? 'queued',
    failureReason: (row.failure_reason as string) ?? null,
    templateId: (row.template_id as string) ?? null,
    automated: Boolean(row.automated ?? false),
    createdAt: String(row.created_at ?? ''),
    isDemo: Boolean(row.is_demo ?? false),
  };
}

/* ── Support & system ── */

export function mapRequest(row: Record<string, unknown>): ClientRequest {
  return {
    id: String(row.id),
    clientId: String(row.client_id ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    type: (row.type as ClientRequest['type']) ?? 'general',
    priority: (row.priority as ClientRequest['priority']) ?? 'medium',
    status: (row.status as ClientRequest['status']) ?? 'open',
    attachments: Array.isArray(row.attachments) ? (row.attachments as ClientRequest['attachments']) : [],
    activity: Array.isArray(row.activity) ? (row.activity as ClientRequest['activity']) : [],
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    isDemo: Boolean(row.is_demo ?? false),
  };
}

export function mapTicket(row: Record<string, unknown>): Ticket {
  return {
    id: String(row.id),
    clientId: (row.client_id as string) ?? null,
    subject: String(row.subject ?? ''),
    status: (row.status as Ticket['status']) ?? 'open',
    priority: (row.priority as Ticket['priority']) ?? 'medium',
    category: (row.category as string) ?? null,
    messages: Array.isArray(row.messages) ? (row.messages as Ticket['messages']) : [],
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    isDemo: Boolean(row.is_demo ?? false),
  };
}

export function mapActivity(row: Record<string, unknown>): ActivityRecord {
  return {
    id: String(row.id),
    type: String(row.type ?? ''),
    label: String(row.label ?? ''),
    detail: (row.detail as string) ?? null,
    actor: String(row.actor ?? 'System'),
    actorRole: ((row.actor_role as string) ?? 'system') as ActivityRecord['actorRole'],
    entityType: (row.entity_type as string) ?? null,
    entityId: (row.entity_id as string) ?? null,
    clientId: (row.client_id as string) ?? null,
    createdAt: String(row.created_at ?? ''),
    isDemo: Boolean(row.is_demo ?? false),
  };
}

export function mapNotification(row: Record<string, unknown>): NotificationRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? ''),
    kind: (row.kind as NotificationRecord['kind']) ?? 'system',
    title: String(row.title ?? ''),
    body: (row.body as string) ?? null,
    read: Boolean(row.read ?? false),
    href: (row.href as string) ?? null,
    entityType: (row.entity_type as string) ?? null,
    entityId: (row.entity_id as string) ?? null,
    createdAt: String(row.created_at ?? ''),
  };
}

/* ── Announcements, preferences, milestones & files ─────────── */

export function mapAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    message: String(row.message ?? ''),
    priority: (row.priority as Announcement['priority']) ?? 'normal',
    audience: (row.audience as Announcement['audience']) ?? 'all_clients',
    clientIds: Array.isArray(row.client_ids) ? (row.client_ids as string[]) : [],
    startsAt: String(row.starts_at ?? ''),
    endsAt: (row.ends_at as string) ?? null,
    createdAt: String(row.created_at ?? ''),
    isDemo: Boolean(row.is_demo ?? false),
  };
}

export function mapMilestone(row: Record<string, unknown>): Milestone {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    clientId: String(row.client_id ?? ''),
    title: String(row.title ?? ''),
    description: (row.description as string) ?? null,
    status: (row.status as Milestone['status']) ?? 'planning',
    sortOrder: Number(row.sort_order ?? 0),
    dueDate: (row.due_date as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    isDemo: Boolean(row.is_demo ?? false),
    createdAt: String(row.created_at ?? ''),
  };
}

export function mapFileRecord(row: Record<string, unknown>): FileRecord {
  return {
    id: String(row.id ?? ''),
    clientId: String(row.client_id ?? ''),
    name: String(row.name ?? ''),
    storagePath: String(row.storage_path ?? ''),
    sizeBytes: Number(row.size_bytes ?? 0),
    mimeType: (row.mime_type as string) ?? null,
    createdAt: String(row.created_at ?? ''),
  };
}

export function mapNotificationPreferences(row: Record<string, unknown>): NotificationPreferences {
  return {
    projectUpdates: Boolean(row.project_updates ?? true),
    leads: Boolean(row.leads ?? true),
    appointments: Boolean(row.appointments ?? true),
    billing: Boolean(row.billing ?? true),
    support: Boolean(row.support ?? true),
    marketing: Boolean(row.marketing ?? true),
    system: Boolean(row.system ?? true),
  };
}
