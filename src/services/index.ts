/**
 * Service layer (spec §81).
 *
 * UI → hooks → services → Supabase. Components never touch the Supabase
 * client directly, so session handling, row mapping and error translation
 * live in exactly one place.
 *
 * Authorisation is NOT implemented here — every query is scoped by RLS on
 * the server. A client account querying another client's rows simply gets
 * an empty or denied result, no matter what this code asks for.
 *
 * This module holds the admin and client-portal services, and re-exports the
 * public ones (auth, MFA, catalog, enquiries) so `@/services` keeps working
 * as the single import path for screens behind a login. Public pages import
 * `@/services/public` directly instead — see that file for why.
 */
export * from './public';

import { loadProfile, sessionError } from './public';
import { supabase, assertSupabaseConfigured } from '@/lib/supabase';
import { billableLines, nextInvoiceNumber, totalize, InvoiceLine } from '@/lib/billing';
import { ApiError } from '@/types';
import { authUserId, compact, run, mapDatabaseError } from '@/services/db';
import {
  mapActivity,
  mapAnnouncement,
  mapBooking,
  mapClient,
  mapFileRecord,
  mapFollowUp,
  mapInvoice,
  mapLead,
  mapMilestone,
  mapNotification,
  mapNotificationPreferences,
  mapPayment,
  mapProject,
  mapProposal,
  mapRequest,
  mapSubscription,
  mapTask,
  mapTicket,
  mapWebsite,
  mapWhatsAppMessage,
  mapWhatsAppTemplate,
  mapWorkflow,
} from '@/services/mappers';
import { CATALOG } from '@/services/catalog';
import { normalizeWhatsAppNumber, waLink } from '@/lib/whatsapp';
import { CONTACT } from '@/data/site';
import type {
  ActivityRecord,
  AdminDashboard,
  Announcement,
  Booking,
  Client,
  ClientDashboard,
  ClientRequest,
  FileRecord,
  FollowUp,
  Invoice,
  Lead,
  Milestone,
  NotificationPreferences,
  NotificationRecord,
  OnboardingDraft,
  Payment,
  Plan,
  Project,
  Proposal,
  Subscription,
  SystemHealthReport,
  Task,
  Ticket,
  Website,
  Workflow,
  WhatsAppMessage,
  WhatsAppTemplate,
} from '@/types';
import type { Paginated, PaymentStatus, Role } from '@/types';
/* ── Leads ── */

/** Lightweight client-side qualification score (0-100). */
function leadScore(lead: Partial<Lead>): number {
  let score = 20;
  if (lead.email) score += 15;
  if (lead.phone) score += 10;
  if (lead.message && lead.message.length > 80) score += 20;
  if (lead.value && lead.value > 0) score += 20;
  if (lead.intent) score += 15;
  return Math.min(100, score);
}

export const leadsService = {
  list: async (
    params: { q?: string; status?: string; source?: string; sort?: string; page?: number; pageSize?: number } = {},
    _signal?: AbortSignal,
  ): Promise<Paginated<Lead>> => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (params.status) query = query.eq('status', params.status);
    if (params.source) query = query.eq('source', params.source);
    if (params.q) query = query.or(`contact_name.ilike.%${params.q}%,business_name.ilike.%${params.q}%,email.ilike.%${params.q}%`);
    const column = params.sort === 'created_asc' ? 'created_at' : 'created_at';
    query = query.order(column, { ascending: params.sort === 'created_asc' });
    const { data, error, count } = await query;
    if (error) throw mapDatabaseError(error, 'leads.list');
    return {
      items: (data ?? []).map(mapLead),
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  pipeline: async (): Promise<{ pipeline: { status: string; count: number; value: number }[] }> => {
    const rows = await run<Record<string, unknown>[]>('leads.pipeline', () => supabase.from('leads').select('status, value'));
    const statuses = ['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'];
    const pipeline = statuses.map((status) => {
      const inStage = (rows ?? []).filter((row) => row.status === status);
      return {
        status,
        count: inStage.length,
        value: inStage.reduce((sum, row) => sum + Number(row.value ?? 0), 0),
      };
    });
    return { pipeline };
  },

  get: async (id: string): Promise<{ lead: Lead; followUps: FollowUp[]; client: { id: string; businessName: string } | null }> => {
    const rows = await run<Record<string, unknown>[]>('leads.get', () =>
      supabase.from('leads').select('*, client:clients(id, business_name)').eq('id', id).limit(1),
    );
    const row = rows?.[0];
    if (!row) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    const followUpRows = await run<Record<string, unknown>[]>('leads.getFollowUps', () =>
      supabase.from('follow_ups').select('*').eq('lead_id', id).order('due_at'),
    );
    const clientRow = (row.client as Record<string, unknown>[] | null)?.[0];
    return {
      lead: mapLead(row),
      followUps: (followUpRows ?? []).map(mapFollowUp),
      client: clientRow ? { id: String(clientRow.id), businessName: String(clientRow.business_name) } : null,
    };
  },

  create: async (input: Partial<Lead>): Promise<{ lead: Lead }> => {
    const payload: Record<string, unknown> = compact({
      client_id: input.clientId,
      business_name: input.businessName,
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone,
      source: input.source,
      status: input.status,
      value: input.value,
      message: input.message,
      intent: input.intent,
      next_action: input.nextAction,
    });
    payload.score = leadScore(input);
    const rows = await run<Record<string, unknown>[]>('leads.create', () => supabase.from('leads').insert(payload).select());
    return { lead: mapLead((rows as Record<string, unknown>[])[0]) };
  },

  update: async (id: string, input: Partial<Lead>): Promise<{ lead: Lead }> => {
    const rows = await run<Record<string, unknown>[]>('leads.update', () =>
      supabase
        .from('leads')
        .update(
          compact({
            contact_name: input.contactName,
            email: input.email,
            phone: input.phone,
            status: input.status,
            value: input.value,
            message: input.message,
            intent: input.intent,
            next_action: input.nextAction,
          }),
        )
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { lead: mapLead(rows[0]) };
  },

  remove: async (id: string): Promise<{ deleted: boolean }> => {
    await run('leads.remove', () => supabase.from('leads').delete().eq('id', id));
    return { deleted: true };
  },

  qualify: async (id: string): Promise<{ lead: Lead; qualification: unknown }> => {
    const { lead } = await leadsService.get(id);
    const score = leadScore(lead);
    const rows = await run<Record<string, unknown>[]>('leads.qualify', () =>
      supabase
        .from('leads')
        .update({ score, status: 'qualified' as const })
        .eq('id', id)
        .select(),
    );
    return { lead: mapLead(rows![0]), qualification: { score } };
  },

  addFollowUp: async (id: string, input: { title: string; dueAt: string; channel?: string }): Promise<{ followUp: FollowUp }> => {
    const lead = (await run<Record<string, unknown>[]>('leads.addFollowUp.lead', () =>
      supabase.from('leads').select('client_id').eq('id', id).limit(1),
    ))?.[0];
    const rows = await run<Record<string, unknown>[]>('leads.addFollowUp', () =>
      supabase
        .from('follow_ups')
        .insert({
          lead_id: id,
          client_id: (lead?.client_id as string) ?? null,
          title: input.title,
          due_at: input.dueAt,
          channel: input.channel ?? 'call',
        })
        .select(),
    );
    return { followUp: mapFollowUp(rows![0]) };
  },
};


/* ── Clients ── */

export interface ClientDetail {
  client: Client;
  project: Project | null;
  website: Website | null;
  subscription: Subscription | null;
  leads: Lead[];
  invoices: Invoice[];
  requests: ClientRequest[];
  bookings: Booking[];
  tasks: Task[];
  activity: ActivityRecord[];
  revenue: number;
}

export const clientsService = {
  list: async (params: { q?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<Client>> => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .range((page - 1) * pageSize, page * pageSize - 1)
      .order('created_at', { ascending: false });
    if (params.status) query = query.eq('status', params.status);
    if (params.q) query = query.or(`business_name.ilike.%${params.q}%,contact_name.ilike.%${params.q}%,email.ilike.%${params.q}%`);
    const { data, error, count } = await query;
    if (error) throw mapDatabaseError(error, 'clients.list');
    return { items: (data ?? []).map(mapClient), total: count ?? 0, page, pageSize };
  },

  get: async (id: string): Promise<ClientDetail> => {
    const rows = await run<Record<string, unknown>[]>('clients.get', () =>
      supabase.from('clients').select('*').eq('id', id).limit(1),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');

    const [projects, websites, subscriptions, leads, invoices, requests, bookings, tasks, activity] = await Promise.all([
      run<Record<string, unknown>[]>('clients.get.projects', () => supabase.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false })),
      run<Record<string, unknown>[]>('clients.get.websites', () => supabase.from('websites').select('*').eq('client_id', id).order('created_at', { ascending: false })),
      run<Record<string, unknown>[]>('clients.get.subscriptions', () => supabase.from('subscriptions').select('*').eq('client_id', id).order('started_at', { ascending: false })),
      run<Record<string, unknown>[]>('clients.get.leads', () => supabase.from('leads').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(100)),
      run<Record<string, unknown>[]>('clients.get.invoices', () => supabase.from('invoices').select('*').eq('client_id', id).order('issued_at', { ascending: false }).limit(100)),
      run<Record<string, unknown>[]>('clients.get.requests', () => supabase.from('client_requests').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(100)),
      run<Record<string, unknown>[]>('clients.get.bookings', () => supabase.from('bookings').select('*').eq('client_id', id).order('starts_at', { ascending: false }).limit(100)),
      run<Record<string, unknown>[]>('clients.get.tasks', () => supabase.from('tasks').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(100)),
      run<Record<string, unknown>[]>('clients.get.activity', () => supabase.from('activity').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(40)),
    ]);

    const invoicesMapped = (invoices ?? []).map(mapInvoice);
    return {
      client: mapClient(rows[0]),
      project: projects?.[0] ? mapProject(projects[0]) : null,
      website: websites?.[0] ? mapWebsite(websites[0]) : null,
      subscription: subscriptions?.[0] ? mapSubscription(subscriptions[0]) : null,
      leads: (leads ?? []).map(mapLead),
      invoices: invoicesMapped,
      requests: (requests ?? []).map(mapRequest),
      bookings: (bookings ?? []).map(mapBooking),
      tasks: (tasks ?? []).map(mapTask),
      activity: (activity ?? []).map(mapActivity),
      revenue: invoicesMapped.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0),
    };
  },

  create: async (input: Partial<Client>): Promise<{ client: Client }> => {
    const rows = await run<Record<string, unknown>[]>('clients.create', () =>
      supabase
        .from('clients')
        .insert(
          compact({
            business_name: input.businessName,
            contact_name: input.contactName,
            email: input.email,
            phone: input.phone,
            business_type: input.businessType,
            city: input.city,
            state: input.state,
            plan_id: input.planId,
            status: input.status ?? 'lead',
            website_url: input.websiteUrl,
            notes: input.notes,
          }),
        )
        .select(),
    );
    return { client: mapClient(rows![0]) };
  },

  update: async (id: string, input: Partial<Client>): Promise<{ client: Client }> => {
    const rows = await run<Record<string, unknown>[]>('clients.update', () =>
      supabase
        .from('clients')
        .update(
          compact({
            business_name: input.businessName,
            contact_name: input.contactName,
            email: input.email,
            phone: input.phone,
            business_type: input.businessType,
            city: input.city,
            state: input.state,
            plan_id: input.planId,
            status: input.status,
            website_url: input.websiteUrl,
            notes: input.notes,
          }),
        )
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { client: mapClient(rows[0]) };
  },

  /**
   * Delete a client and everything attached to them — websites, projects,
   * invoices, payments, requests, files. The database cascades these rows
   * (`on delete cascade`), which is exactly why the UI asks for confirmation
   * and names what disappears.
   */
  remove: async (id: string): Promise<{ deleted: boolean }> => {
    const rows = await run<Record<string, unknown>[]>('clients.remove', () =>
      supabase.from('clients').delete().eq('id', id).select(),
    );
    if (!rows?.length) throw new ApiError("We couldn't find that client.", 404, 'not_found');
    return { deleted: true };
  },

  onboarding: async (id: string): Promise<{ draft: OnboardingDraft }> => {
    const rows = await run<Record<string, unknown>[]>('clients.onboarding', () =>
      supabase.from('onboarding_drafts').select('*').eq('client_id', id).limit(1),
    );
    const row = rows?.[0];
    return {
      draft: {
        clientId: id,
        currentStep: Number(row?.current_step ?? 0),
        completed: Boolean(row?.completed ?? false),
        data: (row?.data as Record<string, unknown>) ?? {},
        updatedAt: String(row?.updated_at ?? ''),
      },
    };
  },

  saveOnboarding: async (id: string, input: { currentStep: number; completed: boolean; data: Record<string, unknown> }): Promise<{ draft: OnboardingDraft }> => {
    const userId = await authUserId();
    const existing = await run<Record<string, unknown>[]>('clients.saveOnboarding.find', () =>
      supabase.from('onboarding_drafts').select('id').eq('client_id', id).limit(1),
    );
    const values = { client_id: id, user_id: userId, current_step: input.currentStep, completed: input.completed, data: input.data };
    const rows = existing?.[0]
      ? await run<Record<string, unknown>[]>('clients.saveOnboarding.update', () =>
          supabase.from('onboarding_drafts').update(values).eq('id', existing[0].id).select(),
        )
      : await run<Record<string, unknown>[]>('clients.saveOnboarding.insert', () =>
          supabase.from('onboarding_drafts').insert(values).select(),
        );
    const row = rows![0];
    return {
      draft: {
        clientId: id,
        currentStep: Number(row.current_step ?? input.currentStep),
        completed: Boolean(row.completed ?? input.completed),
        data: (row.data as Record<string, unknown>) ?? input.data,
        updatedAt: String(row.updated_at ?? ''),
      },
    };
  },
};

/* ── Delivery ── */

export const projectsService = {
  list: async (): Promise<{ items: Project[] }> => {
    const rows = await run<Record<string, unknown>[]>('projects.list', () =>
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
    );
    return { items: (rows ?? []).map(mapProject) };
  },
  create: async (input: Partial<Project>): Promise<{ project: Project }> => {
    const rows = await run<Record<string, unknown>[]>('projects.create', () =>
      supabase
        .from('projects')
        .insert(
          compact({
            client_id: input.clientId,
            name: input.name,
            stage: input.stage,
            status: input.status,
            progress: input.progress,
            start_date: input.startDate,
            due_date: input.dueDate,
            notes: input.notes,
          }),
        )
        .select(),
    );
    return { project: mapProject(rows![0]) };
  },
  update: async (id: string, input: Partial<Project> & { feedback?: string }): Promise<{ project: Project }> => {
    const rows = await run<Record<string, unknown>[]>('projects.update', () =>
      supabase
        .from('projects')
        .update(
          compact({
            stage: input.stage,
            status: input.status,
            progress: input.progress,
            due_date: input.dueDate,
            notes: input.feedback ?? input.notes,
          }),
        )
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { project: mapProject(rows[0]) };
  },
};

export const tasksService = {
  list: async (status?: string): Promise<{ items: Task[] }> => {
    let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const rows = await run<Record<string, unknown>[]>('tasks.list', () => query);
    return { items: (rows ?? []).map(mapTask) };
  },
  create: async (input: Partial<Task>): Promise<{ task: Task }> => {
    const rows = await run<Record<string, unknown>[]>('tasks.create', () =>
      supabase
        .from('tasks')
        .insert(
          compact({
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            project_id: input.projectId,
            client_id: input.clientId,
            due_date: input.dueDate,
          }),
        )
        .select(),
    );
    return { task: mapTask(rows![0]) };
  },
  update: async (id: string, input: Partial<Task>): Promise<{ task: Task }> => {
    const rows = await run<Record<string, unknown>[]>('tasks.update', () =>
      supabase
        .from('tasks')
        .update(compact({ title: input.title, description: input.description, status: input.status, priority: input.priority, due_date: input.dueDate }))
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { task: mapTask(rows[0]) };
  },
  remove: async (id: string): Promise<{ deleted: boolean }> => {
    await run('tasks.remove', () => supabase.from('tasks').delete().eq('id', id));
    return { deleted: true };
  },
};

export const websitesService = {
  list: async (): Promise<{ items: Website[] }> => {
    const rows = await run<Record<string, unknown>[]>('websites.list', () =>
      supabase.from('websites').select('*').order('created_at', { ascending: false }),
    );
    return { items: (rows ?? []).map(mapWebsite) };
  },
  get: async (id: string): Promise<{ website: Website; analytics: unknown[]; client: { id: string; businessName: string } | null }> => {
    const rows = await run<Record<string, unknown>[]>('websites.get', () =>
      supabase.from('websites').select('*, client:clients(id, business_name)').eq('id', id).limit(1),
    );
    const row = rows?.[0];
    if (!row) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    const analytics = await run<Record<string, unknown>[]>('websites.get.analytics', () =>
      supabase.from('website_analytics').select('*').eq('website_id', id).order('date', { ascending: false }).limit(90),
    );
    const clientRow = (row.client as Record<string, unknown>[] | null)?.[0];
    return {
      website: mapWebsite(row),
      analytics: analytics ?? [],
      client: clientRow ? { id: String(clientRow.id), businessName: String(clientRow.business_name) } : null,
    };
  },
  create: async (input: Partial<Website>): Promise<{ website: Website }> => {
    const rows = await run<Record<string, unknown>[]>('websites.create', () =>
      supabase
        .from('websites')
        .insert(compact({ client_id: input.clientId, name: input.name, domain: input.domain, url: input.url, status: input.status }))
        .select(),
    );
    return { website: mapWebsite(rows![0]) };
  },
  /** Remove a website record (its analytics rows are keyed to it). */
  remove: async (id: string): Promise<{ deleted: boolean }> => {
    const rows = await run<Record<string, unknown>[]>('websites.remove', () =>
      supabase.from('websites').delete().eq('id', id).select(),
    );
    if (!rows?.length) throw new ApiError("We couldn't find that website.", 404, 'not_found');
    return { deleted: true };
  },
  update: async (id: string, input: Partial<Website>): Promise<{ website: Website }> => {
    const rows = await run<Record<string, unknown>[]>('websites.update', () =>
      supabase
        .from('websites')
        .update(
          compact({
            name: input.name,
            domain: input.domain,
            url: input.url,
            status: input.status,
            deployment: input.deployment,
            ssl: input.ssl,
            hosting: input.hosting,
            framework: input.framework,
            maintenance: input.maintenance,
            last_deployed_at: input.lastDeployedAt,
            last_updated_at: new Date().toISOString(),
          }),
        )
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { website: mapWebsite(rows[0]) };
  },
};

/* ── Calendar ── */

export interface CalendarEvent {
  id: string;
  kind: 'booking' | 'task' | 'deadline' | 'follow_up';
  title: string;
  detail: string;
  date: string;
  status: string;
  href: string;
}

export const calendarService = {
  events: async (from?: string, to?: string): Promise<{ events: CalendarEvent[] }> => {
    let bookingQuery = supabase.from('bookings').select('*').order('starts_at');
    let taskQuery = supabase.from('tasks').select('*').not('due_date', 'is', null).order('due_date');
    let projectQuery = supabase.from('projects').select('*').not('due_date', 'is', null).order('due_date');
    // Lead follow-ups are the "schedule I set on a lead" — they must surface
    // on the main calendar (spec §113). Join to leads for the contact name.
    let followUpQuery = supabase
      .from('follow_ups')
      .select('*, lead:leads(contact_name, business_name)')
      .order('due_at');
    if (from) {
      bookingQuery = bookingQuery.gte('starts_at', from);
      taskQuery = taskQuery.gte('due_date', from);
      projectQuery = projectQuery.gte('due_date', from);
      followUpQuery = followUpQuery.gte('due_at', from);
    }
    if (to) {
      bookingQuery = bookingQuery.lte('starts_at', to);
      taskQuery = taskQuery.lte('due_date', to);
      projectQuery = projectQuery.lte('due_date', to);
      followUpQuery = followUpQuery.lte('due_at', to);
    }
    const [bookings, tasks, projects, followUps] = await Promise.all([
      run<Record<string, unknown>[]>('calendar.bookings', () => bookingQuery),
      run<Record<string, unknown>[]>('calendar.tasks', () => taskQuery),
      run<Record<string, unknown>[]>('calendar.projects', () => projectQuery),
      run<Record<string, unknown>[]>('calendar.followUps', () => followUpQuery),
    ]);

    const events: CalendarEvent[] = [
      ...(bookings ?? []).map((row) => ({
        id: `booking-${row.id}`,
        kind: 'booking' as const,
        title: String(row.customer_name ?? 'Booking'),
        detail: String(row.service ?? 'Consultation'),
        date: String(row.starts_at ?? ''),
        status: String(row.status ?? 'pending'),
        href: '/portal/bookings',
      })),
      ...(tasks ?? []).map((row) => ({
        id: `task-${row.id}`,
        kind: 'task' as const,
        title: String(row.title ?? 'Task'),
        detail: String(row.priority ?? 'medium'),
        date: String(row.due_date ?? ''),
        status: String(row.status ?? 'todo'),
        href: '/app/tasks',
      })),
      ...(projects ?? []).map((row) => ({
        id: `deadline-${row.id}`,
        kind: 'deadline' as const,
        title: String(row.name ?? 'Project'),
        detail: 'Project deadline',
        date: String(row.due_date ?? ''),
        status: String(row.status ?? 'planning'),
        href: '/app/projects',
      })),
      ...(followUps ?? []).map((row) => {
        const lead = row.lead as Record<string, unknown> | null;
        const channel = String(row.channel ?? '');
        const contact = lead
          ? String(lead.contact_name ?? lead.business_name ?? '')
          : '';
        return {
          id: `followup-${row.id}`,
          kind: 'follow_up' as const,
          title: String(row.title ?? 'Follow up'),
          detail: [contact || null, channel ? `via ${channel}` : null].filter(Boolean).join(' · ') || 'Lead follow up',
          date: String(row.due_at ?? ''),
          status: String(row.status ?? 'pending'),
          href: row.lead_id ? `/app/leads/${String(row.lead_id)}` : '/app/leads',
        };
      }),
    ];
    events.sort((a, b) => a.date.localeCompare(b.date));
    return { events };
  },
};

/* ── Billing ── */

export const billingService = {
  subscriptions: async (): Promise<{ items: Subscription[] }> => {
    const rows = await run<Record<string, unknown>[]>('billing.subscriptions', () =>
      supabase.from('subscriptions').select('*').order('started_at', { ascending: false }),
    );
    return { items: (rows ?? []).map(mapSubscription) };
  },
  /**
   * Start a subscription. The renewal date follows the plan's own billing
   * interval (30 days for every catalog plan) instead of a hard-coded 30 —
   * a plan with a different cycle would otherwise renew on the wrong day.
   */
  createSubscription: async (input: {
    clientId: string;
    planId: string;
    status?: string;
    renewsAt?: string;
    seats?: number;
  }): Promise<{ subscription: Subscription }> => {
    if (!input.clientId) throw new ApiError('Choose a client for this subscription.', 400, 'validation');
    if (!input.planId) throw new ApiError('Choose a plan for this subscription.', 400, 'validation');
    const plan = CATALOG.plans.find((candidate) => candidate.id === input.planId);
    const intervalDays = plan?.intervalDays ?? 30;
    const rows = await run<Record<string, unknown>[]>('billing.createSubscription', () =>
      supabase
        .from('subscriptions')
        .insert(
          compact({
            client_id: input.clientId,
            plan_id: input.planId,
            status: input.status ?? 'active',
            seats: input.seats ?? 1,
            renews_at: input.renewsAt ?? new Date(Date.now() + intervalDays * 86400000).toISOString(),
          }),
        )
        .select(),
    );
    return { subscription: mapSubscription(rows![0]) };
  },
  updateSubscription: async (
    id: string,
    input: { planId?: string; status?: string; renewsAt?: string; cancelAt?: string | null },
  ): Promise<{ subscription: Subscription }> => {
    const rows = await run<Record<string, unknown>[]>('billing.updateSubscription', () =>
      supabase
        .from('subscriptions')
        .update(compact({ plan_id: input.planId, status: input.status, renews_at: input.renewsAt, cancel_at: input.cancelAt }))
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { subscription: mapSubscription(rows[0]) };
  },
  /** Remove a subscription record that was created by mistake. */
  deleteSubscription: async (id: string): Promise<{ deleted: boolean }> => {
    const rows = await run<Record<string, unknown>[]>('billing.deleteSubscription', () =>
      supabase.from('subscriptions').delete().eq('id', id).select(),
    );
    if (!rows?.length) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { deleted: true };
  },
  /**
   * Cancel the signed-in client's own subscription (spec §2–§4).
   *
   * Clients hold SELECT on their own subscription and nothing more, so the
   * write goes through the 0012 security-definer RPC, which resolves the
   * caller from auth.uid() and takes only the subscription id — a client can
   * never name another client's plan. The RPC stops FUTURE renewal and
   * records the cancellation; it deliberately does not touch an invoice that
   * has already been issued.
   */
  cancelSubscription: async (
    id: string,
    reason?: string,
  ): Promise<{ status: Subscription['status']; effectiveAt: string | null }> => {
    const { data, error } = await supabase.rpc('app_cancel_own_subscription', {
      p_subscription_id: id,
      p_reason: reason?.trim() ? reason.trim() : null,
    });
    if (error) {
      const hint = (error as { hint?: string }).hint ?? '';
      if (error.code === 'P0001' && hint.includes('not on your account')) {
        throw new ApiError("We couldn't find that subscription on your account.", 404, 'not_found');
      }
      if (error.code === 'P0001' && hint.includes('already ended')) {
        throw new ApiError('This subscription has already been cancelled.', 409, 'already_cancelled');
      }
      if (error.code === 'P0001' && hint.includes('Sign in')) {
        throw new ApiError('Your session expired. Sign in again to continue.', 401, 'session_expired');
      }
      throw mapDatabaseError(error, 'billing.cancelSubscription');
    }
    const payload = (data ?? {}) as { status?: Subscription['status']; effective_at?: string };
    return {
      status: payload.status ?? 'cancellation_pending',
      effectiveAt: payload.effective_at ?? null,
    };
  },
  invoices: async (): Promise<{ items: Invoice[] }> => {
    const rows = await run<Record<string, unknown>[]>('billing.invoices', () =>
      supabase.from('invoices').select('*').order('issued_at', { ascending: false }),
    );
    return { items: (rows ?? []).map(mapInvoice) };
  },
  invoice: async (id: string): Promise<{ invoice: Invoice; client: unknown }> => {
    const rows = await run<Record<string, unknown>[]>('billing.invoice', () =>
      supabase.from('invoices').select('*, client:clients(*)').eq('id', id).limit(1),
    );
    const row = rows?.[0];
    if (!row) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { invoice: mapInvoice(row), client: (row.client as Record<string, unknown>[] | null)?.[0] ?? null };
  },
  generateInvoice: async (
    subscriptionId: string,
    options: { includeSetup?: boolean; extraLines?: InvoiceLine[]; dueInDays?: number } = {},
  ): Promise<{ invoice: Invoice }> => {
    const subs = await run<Record<string, unknown>[]>('billing.generateInvoice.sub', () =>
      supabase.from('subscriptions').select('*').eq('id', subscriptionId).limit(1),
    );
    const sub = subs?.[0];
    if (!sub) throw new ApiError("We couldn't find that subscription.", 404, 'not_found');
    const plan = CATALOG.plans.find((candidate) => candidate.id === sub.plan_id);
    if (!plan) {
      throw new ApiError(
        'That subscription points at a plan that is no longer in the catalog. Bill it manually or set a current plan.',
        400,
        'validation',
      );
    }
    return billingService.createInvoice({
      clientId: String(sub.client_id ?? ''),
      planId: plan.id,
      subscriptionId,
      includeSetup: options.includeSetup,
      extraLines: options.extraLines,
      dueInDays: options.dueInDays,
    });
  },
  /**
   * Create an invoice directly for a client + plan. This is the path that
   * works even when no subscription record exists yet — the common state for
   * a new client, where the subscription-based generator has nothing to list.
   */
  /**
   * Raise an invoice from the catalog — the path that always works, with or
   * without a subscription record (a brand-new client usually has none).
   *
   * The money is computed by `src/lib/billing.ts`: line items first, then
   * 18% GST on the subtotal, then total = subtotal + tax. The optional
   * one-time setup fee is a separate line rather than a silent surcharge.
   */
  createInvoice: async (input: {
    clientId: string;
    planId: string;
    subscriptionId?: string | null;
    dueInDays?: number;
    /** First invoice for a client: add the plan's one-time build fee. */
    includeSetup?: boolean;
    extraLines?: InvoiceLine[];
  }): Promise<{ invoice: Invoice }> => {
    if (!input.clientId) throw new ApiError('Choose a client for this invoice.', 400, 'validation');
    if (!input.planId) throw new ApiError('Choose a plan for this invoice.', 400, 'validation');
    const plan = CATALOG.plans.find((candidate) => candidate.id === input.planId);
    if (!plan) throw new ApiError('That plan is not in the catalog.', 400, 'validation');
    const lines = billableLines(plan, { includeSetup: input.includeSetup, extraLines: input.extraLines });
    if (!lines.length) {
      throw new ApiError(
        'That plan has no price in the catalog — add a line item or use a priced plan.',
        400,
        'validation',
      );
    }
    const { subtotal, tax, total } = totalize(lines);
    const now = new Date();

    /**
     * Invoice numbers are `NF-YYYYMM-XXXX` with a random suffix, so a
     * collision is rare but not negligible once a month's volume is in the
     * hundreds. The UNIQUE constraint on `invoices.number` remains the
     * authority; drawing a fresh suffix on a 23505 turns a hard failure the
     * operator cannot act on into a non-event. Any other error is real.
     */
    let rows: Record<string, unknown>[] | null = null;
    for (let attempt = 0; attempt < 5 && !rows; attempt += 1) {
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          number: nextInvoiceNumber(now),
          client_id: input.clientId,
          subscription_id: input.subscriptionId ?? null,
          amount: subtotal,
          tax,
          total,
          status: 'open',
          due_at: new Date(now.getTime() + (input.dueInDays ?? 14) * 86400000).toISOString(),
          line_items: lines,
        })
        .select();

      if (!error) {
        rows = (data ?? []) as Record<string, unknown>[];
        break;
      }
      if (error.code !== '23505') throw mapDatabaseError(error, 'billing.createInvoice');
    }

    if (!rows?.[0]) {
      throw new ApiError('Could not allocate an invoice number. Please try again.', 409, 'duplicate');
    }
    return { invoice: mapInvoice(rows[0]) };
  },
  /**
   * Edit an invoice after it was raised: status, due date, line items and
   * notes. Whenever line items change the subtotal, GST and total are
   * recomputed together — three numbers that cannot drift apart.
   */
  updateInvoice: async (
    id: string,
    patch: { status?: string; dueAt?: string; lineItems?: InvoiceLine[] },
  ): Promise<{ invoice: Invoice }> => {
    const update: Record<string, unknown> = {};
    if (patch.status) {
      update.status = patch.status;
      // Only stamp paid_at when the invoice actually becomes paid, and clear
      // it again if it is re-opened (a void invoice is not a settled one).
      update.paid_at = patch.status === 'paid' ? new Date().toISOString() : null;
    }
    if (patch.dueAt) update.due_at = patch.dueAt;
    if (patch.lineItems) {
      const lines = patch.lineItems.filter((line) => line.label.trim());
      const { subtotal, tax, total } = totalize(lines);
      update.line_items = lines;
      update.amount = subtotal;
      update.tax = tax;
      update.total = total;
    }
    if (!Object.keys(update).length) throw new ApiError('Nothing changed.', 400, 'validation');
    const rows = await run<Record<string, unknown>[]>('billing.updateInvoice', () =>
      supabase.from('invoices').update(update).eq('id', id).select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { invoice: mapInvoice(rows[0]) };
  },
  /** Remove a draft or mistakenly raised invoice. */
  deleteInvoice: async (id: string): Promise<{ deleted: boolean }> => {
    const rows = await run<Record<string, unknown>[]>('billing.deleteInvoice', () =>
      supabase.from('invoices').delete().eq('id', id).select(),
    );
    if (!rows?.length) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { deleted: true };
  },
  payments: async (): Promise<{ items: Payment[] }> => {
    const rows = await run<Record<string, unknown>[]>('billing.payments', () =>
      supabase.from('payments').select('*').order('paid_at', { ascending: false }),
    );
    return { items: (rows ?? []).map(mapPayment) };
  },
  /** Record a payment received outside the app (bank transfer, UPI, cash). Never marks an invoice paid on its own — use updateInvoice for that. */
  createPayment: async (input: {
    clientId: string;
    amount: number;
    status?: PaymentStatus;
    method?: string;
    invoiceId?: string;
    /** Settle the linked invoice in the same action (default: yes). */
    markInvoicePaid?: boolean;
  }): Promise<{ payment: Payment; invoiceSettled: boolean }> => {
    if (!input.clientId) throw new ApiError('Choose the client this payment belongs to.', 400, 'validation');
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ApiError('Enter an amount greater than zero.', 400, 'validation');
    }
    const rows = await run<Record<string, unknown>[]>('billing.createPayment', () =>
      supabase
        .from('payments')
        .insert({
          client_id: input.clientId,
          amount: Math.round(input.amount),
          status: input.status ?? 'succeeded',
          method: input.method ?? 'manual',
          invoice_id: input.invoiceId ?? null,
        })
        .select(),
    );

    // Recording money and leaving the invoice "open" is how a ledger starts
    // lying. When the payment is successful and linked, settle the invoice.
    let invoiceSettled = false;
    const shouldSettle = input.invoiceId && (input.markInvoicePaid ?? true) && (input.status ?? 'succeeded') === 'succeeded';
    if (shouldSettle) {
      await billingService.updateInvoice(input.invoiceId!, { status: 'paid' });
      invoiceSettled = true;
    }

    return { payment: mapPayment(rows![0]), invoiceSettled };
  },
  /** Remove a payment recorded in error. */
  deletePayment: async (id: string): Promise<{ deleted: boolean }> => {
    const rows = await run<Record<string, unknown>[]>('billing.deletePayment', () =>
      supabase.from('payments').delete().eq('id', id).select(),
    );
    if (!rows?.length) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { deleted: true };
  },
  plans: async (): Promise<{ plans: (Plan & { subscribers: number })[] }> => {
    const rows = await run<Record<string, unknown>[]>('billing.plans', () => supabase.from('subscriptions').select('plan_id'));
    const counts = new Map<string, number>();
    for (const row of rows ?? []) counts.set(String(row.plan_id), (counts.get(String(row.plan_id)) ?? 0) + 1);
    return { plans: CATALOG.plans.map((plan) => ({ ...plan, subscribers: counts.get(plan.id) ?? 0 })) };
  },
};

/* ── Automation ── */

export const automationService = {
  workflows: async (): Promise<{ items: Workflow[] }> => {
    const rows = await run<Record<string, unknown>[]>('automation.workflows', () =>
      supabase.from('workflows').select('*, workflow_nodes(*)').order('created_at', { ascending: false }),
    );
    return {
      items: (rows ?? []).map((row) => mapWorkflow(row, (row.workflow_nodes as Record<string, unknown>[]) ?? [])),
    };
  },
  workflow: async (id: string): Promise<{ workflow: Workflow; nodes: Record<string, unknown>[] }> => {
    const rows = await run<Record<string, unknown>[]>('automation.workflow', () =>
      supabase.from('workflows').select('*, workflow_nodes(*)').eq('id', id).limit(1),
    );
    const row = rows?.[0];
    if (!row) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    const nodes = (row.workflow_nodes as Record<string, unknown>[]) ?? [];
    return { workflow: mapWorkflow(row, nodes), nodes };
  },
  createWorkflow: async (input: Partial<Workflow>): Promise<{ workflow: Workflow }> => {
    const rows = await run<Record<string, unknown>[]>('automation.createWorkflow', () =>
      supabase
        .from('workflows')
        .insert(compact({ name: input.name, description: input.description, status: input.status, trigger: input.trigger }))
        .select(),
    );
    return { workflow: mapWorkflow(rows![0], []) };
  },
  updateWorkflow: async (id: string, input: Partial<Workflow>): Promise<{ workflow: Workflow }> => {
    const rows = await run<Record<string, unknown>[]>('automation.updateWorkflow', () =>
      supabase
        .from('workflows')
        .update(compact({ name: input.name, description: input.description, status: input.status, trigger: input.trigger }))
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { workflow: mapWorkflow(rows[0], []) };
  },
  saveNodes: async (workflowId: string, nodes: Record<string, unknown>[]): Promise<{ saved: boolean }> => {
    await run('automation.saveNodes.delete', () => supabase.from('workflow_nodes').delete().eq('workflow_id', workflowId));
    if (nodes.length) {
      await run('automation.saveNodes.insert', () => supabase.from('workflow_nodes').insert(nodes.map((node) => ({ ...node, workflow_id: workflowId }))));
    }
    return { saved: true };
  },
  /** Insert one builder step; the workflow is reloaded by the caller. */
  addNode: async (
    workflowId: string,
    input: { type: string; label: string; config?: Record<string, unknown>; x?: number; y?: number },
  ): Promise<{ added: boolean }> => {
    await run('automation.addNode', () =>
      supabase.from('workflow_nodes').insert({ workflow_id: workflowId, ...compact(input) }),
    );
    return { added: true };
  },
  /** Delete a builder step by id (ownership enforced by RLS). */
  deleteNode: async (workflowId: string, nodeId: string): Promise<{ workflow: Workflow }> => {
    await run('automation.deleteNode', () =>
      supabase.from('workflow_nodes').delete().eq('id', nodeId).eq('workflow_id', workflowId),
    );
    return automationService.workflow(workflowId);
  },
};

/* ── Engagement (bookings, requests, support) ── */

/**
 * WhatsApp operations.
 *
 * Sending goes through the `whatsapp-send` Edge Function, which holds the
 * Cloud API credentials server-side and posts to Meta's Graph API — what
 * the admin types on the website is delivered by the business number. When
 * the function is not deployed or not configured, the message is recorded
 * queued and a wa.me deep link hands the exact text to the operator's own
 * WhatsApp in one click: the product never pretends a send happened
 * (spec §40, §57).
 */
export interface WhatsAppStatus {
  connected: boolean;
  mode: 'cloud_api' | 'click_to_chat';
  businessNumber: string;
  stats: { sent: number; inbound: number; automated: number; templates: number };
}

export interface WhatsAppSendResult {
  /** True when the Cloud API accepted the message — real delivery underway. */
  sent: boolean;
  /** One-click open in the business WhatsApp with the text pre-typed. */
  fallbackUrl: string | null;
  /** Why the Cloud API path did not deliver (null when sent). */
  reason: string | null;
  /**
   * The `whatsapp_messages` row this attempt produced, when the server
   * recorded one. Exactly one logical send maps to at most one row.
   */
  messageId: string | null;
}

/** Ask the Edge Function whether Cloud API credentials exist server-side. */
async function probeWhatsAppConfigured(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('whatsapp-send', { body: { probe: true } });
    if (error) return false;
    return Boolean((data as { configured?: boolean } | null)?.configured);
  } catch {
    // Function missing / network — treat as not configured (fallback applies).
    return false;
  }
}

export const whatsappService = {
  status: async (): Promise<WhatsAppStatus> => {
    const [messages, templates, configured] = await Promise.all([
      whatsappService.messages(),
      whatsappService.templates(),
      probeWhatsAppConfigured(),
    ]);
    const items = messages.items;
    return {
      // "Connected" now means the truth: the Edge Function reported real
      // Cloud API credentials. Message history can never fake this again.
      connected: configured,
      mode: configured ? 'cloud_api' : 'click_to_chat',
      businessNumber: CONTACT.whatsappDisplay,
      stats: {
        sent: items.filter((message) => message.direction === 'outbound').length,
        inbound: items.filter((message) => message.direction === 'inbound').length,
        automated: items.filter((message) => message.automated).length,
        templates: templates.items.length,
      },
    };
  },
  templates: async (): Promise<{ items: WhatsAppTemplate[] }> => {
    const rows = await run<Record<string, unknown>[]>('whatsapp.templates', () =>
      supabase.from('whatsapp_templates').select('*').order('name'),
    );
    return { items: (rows ?? []).map(mapWhatsAppTemplate) };
  },
  messages: async (): Promise<{ items: WhatsAppMessage[] }> => {
    const rows = await run<Record<string, unknown>[]>('whatsapp.messages', () =>
      supabase.from('whatsapp_messages').select('*').order('created_at', { ascending: false }).limit(500),
    );
    return { items: (rows ?? []).map(mapWhatsAppMessage) };
  },
  /**
   * Send a message: Cloud API first (real delivery), wa.me fallback always
   * available. The message is only marked sent when Meta accepted it.
   */
  send: async (input: { to: string; body: string; clientId?: string }): Promise<WhatsAppSendResult> => {
    const digits = normalizeWhatsAppNumber(input.to);
    if (!digits) {
      throw new ApiError('Enter a valid WhatsApp number — country code first, e.g. 919845012345.', 400, 'validation');
    }
    const text = input.body.trim();
    if (!text) throw new ApiError('Write the message to send.', 400, 'validation');

    let sent = false;
    let reason: string | null = null;
    /** Server-recorded row for THIS attempt, if one exists. */
    let messageId: string | null = null;
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { to: digits, body: text, clientId: input.clientId ?? null },
      });
      if (error) throw error;
      const result = data as { sent?: boolean; id?: string } | null;
      sent = Boolean(result?.sent);
      if (typeof result?.id === 'string') messageId = result.id;
      if (!sent) reason = 'The message could not be delivered — it is recorded below.';
    } catch (fnError) {
      // FunctionsHttpError carries the Response; read the human reason out of
      // it (token expired, outside the 24-hour window, not configured…).
      const httpError = fnError as { context?: { json?: () => Promise<unknown> }; message?: string };
      reason = httpError?.message ?? null;
      try {
        const body = (await httpError?.context?.json?.()) as { message?: string; id?: string } | null;
        if (body?.message) reason = String(body.message);
        // The function records the message and returns its id even when the
        // provider rejected it, so this attempt already has a row.
        if (typeof body?.id === 'string') messageId = body.id;
      } catch {
        /* body was not JSON — keep the generic reason */
      }
      if (!reason) reason = 'WhatsApp delivery is not connected yet on this project.';
      sent = false;
    }

    // ONE logical send = ONE row. The Edge Function records the row itself on
    // every path it reaches (success and provider failure alike) and returns
    // its id. Only a transport failure that never reached the function leaves
    // no record, and only then is a queued row created — previously this ran
    // unconditionally, so a rejected send produced message A (failed) followed
    // by message B (queued) and the history disagreed with the provider.
    if (!sent && !messageId) {
      await run('whatsapp.send', () =>
        supabase.from('whatsapp_messages').insert(
          compact({
            client_id: input.clientId,
            direction: 'outbound',
            to_number: digits,
            body: text,
            status: 'queued',
          }),
        ),
      );
    }

    return { sent, fallbackUrl: waLink(digits, text), reason, messageId };
  },
  /** Create a template record pending provider approval. */
  createTemplate: async (input: { name: string; body: string; category: 'utility' | 'marketing' | 'authentication' }): Promise<{ created: boolean }> => {
    await run('whatsapp.createTemplate', () =>
      supabase.from('whatsapp_templates').insert({ name: input.name, body: input.body, category: input.category, status: 'pending' }),
    );
    return { created: true };
  },
};

export const proposalsService = {
  list: async (): Promise<{ items: Proposal[] }> => {
    const rows = await run<Record<string, unknown>[]>('proposals.list', () =>
      supabase.from('proposals').select('*').order('created_at', { ascending: false }),
    );
    return { items: (rows ?? []).map(mapProposal) };
  },
  create: async (input: Partial<Proposal>): Promise<{ proposal: Proposal }> => {
    const rows = await run<Record<string, unknown>[]>('proposals.create', () =>
      supabase
        .from('proposals')
        .insert(
          compact({
            client_id: input.clientId,
            lead_id: input.leadId,
            title: input.title,
            summary: input.summary,
            amount: input.amount,
            status: input.status,
            valid_until: input.validUntil,
            line_items: input.lineItems,
          }),
        )
        .select(),
    );
    return { proposal: mapProposal(rows![0]) };
  },
  update: async (id: string, input: Partial<Proposal>): Promise<{ proposal: Proposal }> => {
    const rows = await run<Record<string, unknown>[]>('proposals.update', () =>
      supabase
        .from('proposals')
        .update(compact({ title: input.title, summary: input.summary, amount: input.amount, status: input.status, line_items: input.lineItems }))
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { proposal: mapProposal(rows[0]) };
  },
};

export const bookingsService = {
  list: async (upcoming = false): Promise<{ items: Booking[] }> => {
    let query = supabase.from('bookings').select('*').order('starts_at');
    if (upcoming) query = query.gte('starts_at', new Date().toISOString());
    const rows = await run<Record<string, unknown>[]>('bookings.list', () => query);
    return { items: (rows ?? []).map(mapBooking) };
  },
  create: async (input: Partial<Booking> & { clientId?: string }): Promise<{ booking: Booking }> => {
    const rows = await run<Record<string, unknown>[]>('bookings.create', () =>
      supabase
        .from('bookings')
        .insert(
          compact({
            client_id: input.clientId,
            customer_name: input.customerName,
            customer_phone: input.customerPhone,
            email: input.email,
            service: input.service,
            starts_at: input.startsAt,
            duration_mins: input.durationMins,
            status: input.status,
            notes: input.notes,
          }),
        )
        .select(),
    );
    return { booking: mapBooking(rows![0]) };
  },
  update: async (id: string, input: Partial<Booking>): Promise<{ booking: Booking }> => {
    const rows = await run<Record<string, unknown>[]>('bookings.update', () =>
      supabase
        .from('bookings')
        .update(compact({ status: input.status, notes: input.notes, customer_name: input.customerName, customer_phone: input.customerPhone }))
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { booking: mapBooking(rows[0]) };
  },
};

export const requestsService = {
  list: async (): Promise<{ items: ClientRequest[] }> => {
    const rows = await run<Record<string, unknown>[]>('requests.list', () =>
      supabase.from('client_requests').select('*').order('created_at', { ascending: false }),
    );
    return { items: (rows ?? []).map(mapRequest) };
  },
  create: async (input: { title: string; description: string; type?: string; priority?: string }): Promise<{ request: ClientRequest }> => {
    // The client id is derived from the profile — never taken from the
    // browser payload (spec §74).
    const session = await loadProfile();
    if (!session.user.clientId) throw new ApiError('No business profile is linked to this account.', 400, 'no_client');
    const rows = await run<Record<string, unknown>[]>('requests.create', () =>
      supabase
        .from('client_requests')
        .insert({
          client_id: session.user.clientId!,
          title: input.title,
          description: input.description,
          type: input.type ?? 'general',
          priority: input.priority ?? 'medium',
        })
        .select(),
    );
    return { request: mapRequest(rows![0]) };
  },
  update: async (id: string, input: { status?: string; priority?: string; comment?: string }): Promise<{ request: ClientRequest }> => {
    const activity = input.comment
      ? [{ id: `cmt-${Date.now()}`, label: 'Comment added', detail: input.comment, actor: 'You', createdAt: new Date().toISOString() }]
      : undefined;
    const rows = await run<Record<string, unknown>[]>('requests.update', () =>
      supabase
        .from('client_requests')
        .update(compact({ status: input.status, priority: input.priority, ...(activity ? { activity } : {}) }))
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that record.", 404, 'not_found');
    return { request: mapRequest(rows[0]) };
  },
};

export const ticketsService = {
  /**
   * Tickets, with internal notes REMOVED IN THE DATABASE for non-admins
   * (migration 0013, `app_ticket_threads`). Reading the table directly would
   * hand a client the very notes the admin marked "not visible to the
   * client", so the mask is applied server-side — filtering it in the
   * browser would be a promise, not a boundary.
   */
  list: async (): Promise<{ items: Ticket[] }> => {
    const rows = await readTicketThreads('tickets.list');
    return { items: (rows ?? []).map(mapTicket) };
  },
  get: async (id: string): Promise<{ ticket: Ticket }> => {
    const rows = await readTicketThreads('tickets.get', id);
    if (!rows?.[0]) throw new ApiError("We couldn't find that ticket.", 404, 'not_found');
    return { ticket: mapTicket(rows[0]) };
  },
  create: async (input: { subject: string; message: string; priority?: string; category?: string }): Promise<{ ticket: Ticket }> => {
    const session = await loadProfile();
    const message = { id: `msg-${Date.now()}`, author: session.user.name, authorRole: session.user.role, body: input.message, createdAt: new Date().toISOString() };
    const rows = await run<Record<string, unknown>[]>('tickets.create', () =>
      supabase
        .from('tickets')
        .insert({
          client_id: session.user.clientId,
          subject: input.subject,
          priority: input.priority ?? 'medium',
          category: input.category ?? null,
          messages: [message],
        })
        .select(),
    );
    return { ticket: mapTicket(rows![0]) };
  },
  /**
   * Append a message to a ticket (migration 0013, `app_add_ticket_message`).
   *
   * The database, not the browser, decides whether a message is an internal
   * note: a client's message is always `internal = false` and only staff can
   * set a status. It also fixes the client reply path, which previously
   * needed a table UPDATE no policy granted — so a client replying to their
   * own ticket silently failed.
   */
  message: async (
    id: string,
    input: { body: string; internal?: boolean; status?: string },
  ): Promise<{ ticket: Ticket }> => {
    const { data, error } = await supabase.rpc('app_add_ticket_message', {
      p_ticket_id: id,
      p_body: input.body,
      p_internal: Boolean(input.internal),
      p_status: input.status ?? null,
    });
    if (error) throw mapDatabaseError(error, 'tickets.message');
    if (!data) throw new ApiError("We couldn't update that ticket.", 400, 'update_failed');
    return { ticket: mapTicket(data as Record<string, unknown>) };
  },
};

/**
 * Ticket threads via the masking RPC (migration 0013).
 *
 * There is deliberately NO fallback. An earlier version fell back to reading
 * the raw `tickets` table and dropping internal notes in JavaScript — but by
 * then the notes have already been sent to the browser, so the "filter" is a
 * promise rather than a boundary, and it silently fails open whenever the
 * role mapping or the field name drifts. If the masking function is not
 * available we report that support is unavailable instead of leaking.
 */
async function readTicketThreads(
  context: string,
  ticketId?: string,
): Promise<Record<string, unknown>[]> {
  const call = await supabase.rpc('app_ticket_threads', { p_ticket_id: ticketId ?? null });
  if (!call.error) return (call.data as Record<string, unknown>[]) ?? [];

  // PGRST202 = no such function in the schema cache; 42883 = undefined_function.
  const missing =
    call.error.code === 'PGRST202' || call.error.code === '42883' || /function .* does not exist/i.test(call.error.message ?? '');
  if (missing) {
    throw new ApiError(
      'Support is unavailable right now because the database is not fully migrated. Please try again shortly.',
      503,
      'support_unavailable',
    );
  }
  throw mapDatabaseError(call.error, context);
}

/* ── Announcements, preferences, milestones & files ─────────── */

/**
 * Announcements (spec §18). The database decides what the caller may see:
 * clients read only published announcements addressed to them, admins read
 * everything — same query, different RLS result.
 */
export const announcementsService = {
  list: async (): Promise<{ items: Announcement[] }> => {
    const rows = await run<Record<string, unknown>[]>('announcements.list', () =>
      supabase.from('announcements').select('*').order('starts_at', { ascending: false }).limit(50),
    );
    return { items: (rows ?? []).map(mapAnnouncement) };
  },
  create: async (input: {
    title: string;
    message: string;
    priority?: string;
    audience?: string;
    clientIds?: string[];
    startsAt?: string;
    endsAt?: string | null;
  }): Promise<{ announcement: Announcement }> => {
    const session = await loadProfile();
    const rows = await run<Record<string, unknown>[]>('announcements.create', () =>
      supabase
        .from('announcements')
        .insert({
          title: input.title,
          message: input.message,
          priority: input.priority ?? 'normal',
          audience: input.audience ?? 'all_clients',
          client_ids: input.clientIds ?? [],
          starts_at: input.startsAt ?? new Date().toISOString(),
          ...(input.endsAt ? { ends_at: input.endsAt } : {}),
          created_by: session.user.id,
        })
        .select(),
    );
    return { announcement: mapAnnouncement(rows![0]) };
  },
  remove: async (id: string): Promise<void> => {
    await run('announcements.remove', () => supabase.from('announcements').delete().eq('id', id));
  },
};

/** Per-user notification preferences (spec §6) — stored in the database. */
export const preferencesService = {
  get: async (): Promise<NotificationPreferences> => {
    const userId = await authUserId();
    if (!userId) throw sessionError();
    const rows = await run<Record<string, unknown>[]>('preferences.get', () =>
      supabase.from('notification_preferences').select('*').eq('user_id', userId).limit(1),
    );
    if (rows?.[0]) return mapNotificationPreferences(rows[0]);
    // Missing row (accounts created before migration 0004) → all on.
    return {
      projectUpdates: true, leads: true, appointments: true, billing: true,
      support: true, marketing: true, system: true,
    };
  },
  save: async (input: NotificationPreferences): Promise<NotificationPreferences> => {
    const userId = await authUserId();
    if (!userId) throw sessionError();
    const rows = await run<Record<string, unknown>[]>('preferences.save', () =>
      supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          project_updates: input.projectUpdates,
          leads: input.leads,
          appointments: input.appointments,
          billing: input.billing,
          support: input.support,
          marketing: input.marketing,
          system: input.system,
        })
        .select(),
    );
    return mapNotificationPreferences(rows![0]);
  },
};

/* ── Milestones & files ─────────────────────────────────────── */

/** Project milestones (spec §25). Clients read; admins manage. */
export const milestonesService = {
  listByProject: async (projectId: string): Promise<{ items: Milestone[] }> => {
    const rows = await run<Record<string, unknown>[]>('milestones.list', () =>
      supabase
        .from('milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true }),
    );
    return { items: (rows ?? []).map(mapMilestone) };
  },
  create: async (input: {
    projectId: string;
    clientId: string;
    title: string;
    description?: string | null;
    dueDate?: string | null;
    sortOrder?: number;
  }): Promise<{ milestone: Milestone }> => {
    const rows = await run<Record<string, unknown>[]>('milestones.create', () =>
      supabase
        .from('milestones')
        .insert({
          project_id: input.projectId,
          client_id: input.clientId,
          title: input.title,
          description: input.description ?? null,
          due_date: input.dueDate ?? null,
          sort_order: input.sortOrder ?? 0,
        })
        .select(),
    );
    return { milestone: mapMilestone(rows![0]) };
  },
  update: async (id: string, input: { status?: string; title?: string; dueDate?: string | null }): Promise<{ milestone: Milestone }> => {
    const rows = await run<Record<string, unknown>[]>('milestones.update', () =>
      supabase
        .from('milestones')
        .update(compact({ status: input.status, title: input.title, due_date: input.dueDate }))
        .eq('id', id)
        .select(),
    );
    if (!rows?.[0]) throw new ApiError("We couldn't find that milestone.", 404, 'not_found');
    return { milestone: mapMilestone(rows[0]) };
  },
  remove: async (id: string): Promise<void> => {
    await run('milestones.remove', () => supabase.from('milestones').delete().eq('id', id));
  },
};

/**
 * Files (spec §26, §27). Private 'client-files' bucket; objects live under
 * `{client_id}/…` and every access is authorised by RLS-derived storage
 * policies. Downloads use short-lived signed URLs — never public paths.
 */
export const filesService = {
  list: async (): Promise<{ items: FileRecord[] }> => {
    const rows = await run<Record<string, unknown>[]>('files.list', () =>
      supabase.from('files').select('*').order('created_at', { ascending: false }).limit(100),
    );
    return { items: (rows ?? []).map(mapFileRecord) };
  },
  upload: async (file: File): Promise<{ record: FileRecord }> => {
    const session = await loadProfile();
    const clientId = session.user.clientId;
    if (!clientId) throw new ApiError('No business profile is linked to this account.', 400, 'no_client');

    const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(-80);
    const path = `${clientId}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage.from('client-files').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw new ApiError(error.message, 400, 'upload_failed');

    try {
      const rows = await run<Record<string, unknown>[]>('files.upload', () =>
        supabase
          .from('files')
          .insert({
            client_id: clientId,
            uploaded_by: session.user.id,
            name: file.name,
            storage_path: path,
            size_bytes: file.size,
            mime_type: file.type || null,
          })
          .select(),
      );
      return { record: mapFileRecord(rows![0]) };
    } catch (cause) {
      // Registry write failed — remove the orphaned object so storage and
      // the table never disagree.
      await supabase.storage.from('client-files').remove([path]);
      throw cause;
    }
  },
  downloadUrl: async (storagePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('client-files')
      .createSignedUrl(storagePath, 300);
    if (error || !data) throw new ApiError('The file link could not be created.', 400, 'sign_failed');
    return data.signedUrl;
  },
  remove: async (record: FileRecord): Promise<void> => {
    const { error } = await supabase.storage.from('client-files').remove([record.storagePath]);
    if (error) throw new ApiError(error.message, 400, 'delete_failed');
    await run('files.remove', () => supabase.from('files').delete().eq('id', record.id));
  },
};

export const insightsService = {
  clientDashboard: async (): Promise<{ dashboard: ClientDashboard | null }> => {
    const session = await loadProfile();
    if (!session.user.clientId) return { dashboard: null };
    const clientId = session.user.clientId;

    const clientRow = (await run<Record<string, unknown>[]>('dashboard.client.client', () =>
      supabase.from('clients').select('*').eq('id', clientId).limit(1),
    ))?.[0];
    if (!clientRow) return { dashboard: null };

    // Website first: the analytics query depends on which website exists.
    const websites = await run<Record<string, unknown>[]>('dashboard.client.websites', () =>
      supabase.from('websites').select('*').eq('client_id', clientId).limit(1),
    );

    const [projects, subscriptions, leads, bookings, requests, analytics] = await Promise.all([
      run<Record<string, unknown>[]>('dashboard.client.projects', () => supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1)),
      run<Record<string, unknown>[]>('dashboard.client.subscriptions', () => supabase.from('subscriptions').select('*').eq('client_id', clientId).order('started_at', { ascending: false }).limit(1)),
      run<Record<string, unknown>[]>('dashboard.client.leads', () => supabase.from('leads').select('status, created_at').eq('client_id', clientId)),
      run<Record<string, unknown>[]>('dashboard.client.bookings', () => supabase.from('bookings').select('*').eq('client_id', clientId).gte('starts_at', new Date().toISOString()).order('starts_at').limit(10)),
      run<Record<string, unknown>[]>('dashboard.client.requests', () => supabase.from('client_requests').select('status').eq('client_id', clientId)),
      websites?.[0]
        ? run<Record<string, unknown>[]>('dashboard.client.analytics', () =>
            supabase.from('website_analytics').select('*').eq('website_id', (websites[0] as { id: string }).id).order('date', { ascending: true }).limit(90),
          )
        : Promise.resolve([] as Record<string, unknown>[]),
    ]);

    const leadRows = leads ?? [];
    const statusCount = (status: string) => leadRows.filter((row) => row.status === status).length;
    const leadsConverted = statusCount('won');
    const visitors = (analytics ?? []).reduce((sum, row) => sum + Number(row.visitors ?? 0), 0);
    const whatsappClicks = (analytics ?? []).reduce((sum, row) => sum + Number(row.whatsapp_clicks ?? 0), 0);
    const conversionRate = visitors > 0 ? (leadsConverted / visitors) * 100 : null;

    const plan = CATALOG.plans.find((candidate) => candidate.id === (subscriptions?.[0] as { plan_id?: string } | undefined)?.plan_id) ?? null;

    return {
      dashboard: {
        client: mapClient(clientRow),
        website: websites?.[0] ? mapWebsite(websites[0]) : null,
        project: projects?.[0] ? mapProject(projects[0]) : null,
        subscription: subscriptions?.[0] ? mapSubscription(subscriptions[0]) : null,
        plan,
        metrics: {
          leadsTotal: leadRows.length,
          leadsNew: statusCount('new'),
          leadsQualified: statusCount('qualified'),
          leadsContacted: statusCount('contacted'),
          leadsConverted,
          conversionRate,
          visitors: visitors || null,
          whatsappClicks: whatsappClicks || null,
          bookings: (bookings ?? []).length,
          openRequests: (requests ?? []).filter((row) => row.status === 'open' || row.status === 'in_progress').length,
        },
        series: (analytics ?? []).map((row) => ({ date: String(row.date), value: Number(row.visitors ?? 0) })),
        upcomingBookings: (bookings ?? []).map(mapBooking),
        recentActivity: [],
        hasData: leadRows.length > 0 || visitors > 0 || (bookings ?? []).length > 0,
      },
    };
  },

  adminDashboard: async (): Promise<{ dashboard: AdminDashboard | null }> => {
    const [clients, leads, projects, tasks, subscriptions, invoices, workflows, activity] = await Promise.all([
      run<Record<string, unknown>[]>('dashboard.admin.clients', () => supabase.from('clients').select('status')),
      run<Record<string, unknown>[]>('dashboard.admin.leads', () => supabase.from('leads').select('status, value, created_at')),
      run<Record<string, unknown>[]>('dashboard.admin.projects', () => supabase.from('projects').select('status')),
      run<Record<string, unknown>[]>('dashboard.admin.tasks', () => supabase.from('tasks').select('id, title, status, priority, due_date').neq('status', 'done').limit(20)),
      run<Record<string, unknown>[]>('dashboard.admin.subscriptions', () => supabase.from('subscriptions').select('status, plan_id')),
      run<Record<string, unknown>[]>('dashboard.admin.invoices', () => supabase.from('invoices').select('total, status, paid_at')),
      run<Record<string, unknown>[]>('dashboard.admin.workflows', () => supabase.from('workflows').select('*').order('created_at', { ascending: false }).limit(10)),
      run<Record<string, unknown>[]>('dashboard.admin.activity', () => supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(20)),
    ]);

    const paidInvoices = (invoices ?? []).filter((row) => row.status === 'paid');
    const revenue = paidInvoices.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
    const activeSubs = (subscriptions ?? []).filter((row) => row.status === 'active');
    const recurringRevenue = activeSubs.reduce((sum, row) => {
      const plan = CATALOG.plans.find((candidate) => candidate.id === row.plan_id);
      return sum + (plan?.amount ?? 0);
    }, 0);

    const statuses: Lead['status'][] = ['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'];
    const leadRows = leads ?? [];
    const won = leadRows.filter((row) => row.status === 'won').length;
    const closed = leadRows.filter((row) => row.status === 'won' || row.status === 'lost').length;

    return {
      dashboard: {
        metrics: {
          revenue,
          recurringRevenue,
          leads: leadRows.length,
          conversionRate: closed > 0 ? (won / closed) * 100 : null,
          activeClients: (clients ?? []).filter((row) => row.status === 'active').length,
          activeProjects: (projects ?? []).filter((row) => row.status === 'active').length,
          openTasks: (tasks ?? []).length,
          systemHealth: 'unknown',
        },
        pipeline: statuses.map((status) => {
          const inStage = leadRows.filter((row) => row.status === status);
          return { status, count: inStage.length, value: inStage.reduce((sum, row) => sum + Number(row.value ?? 0), 0) };
        }),
        series: paidInvoices
          .map((row) => ({ date: String(row.paid_at ?? '').slice(0, 10), value: Number(row.total ?? 0) }))
          .filter((point) => point.date)
          .sort((a, b) => a.date.localeCompare(b.date)),
        recentActivity: (activity ?? []).map(mapActivity),
        openTasks: (tasks ?? []).map(mapTask),
        workflows: (workflows ?? []).map((row) => mapWorkflow(row, [])),
        hasData: leadRows.length > 0 || (clients ?? []).length > 0,
      },
    };
  },

  analytics: async (clientId?: string): Promise<AnalyticsResponse> => {
    let query = supabase.from('websites').select('*, client:clients(id)').limit(1);
    if (clientId) query = query.eq('client_id', clientId);
    const sites = await run<Record<string, unknown>[]>('insights.analytics.site', () => query);
    const website = sites?.[0];
    if (!website) return { analytics: null };

    const rows = await run<Record<string, unknown>[]>('insights.analytics.rows', () =>
      supabase.from('website_analytics').select('*').eq('website_id', (website as { id: string }).id).order('date', { ascending: true }).limit(90),
    );
    const mapped = rows ?? [];
    const totals = {
      visitors: mapped.reduce((sum, row) => sum + Number(row.visitors ?? 0), 0),
      sessions: mapped.reduce((sum, row) => sum + Number(row.sessions ?? 0), 0),
      leads: mapped.reduce((sum, row) => sum + Number(row.leads ?? 0), 0),
      whatsappClicks: mapped.reduce((sum, row) => sum + Number(row.whatsapp_clicks ?? 0), 0),
      bookings: mapped.reduce((sum, row) => sum + Number(row.bookings ?? 0), 0),
    };
    return {
      analytics: {
        website: mapWebsite(website),
        hasData: mapped.length > 0,
        totals,
        conversionRate: totals.visitors > 0 ? (totals.leads / totals.visitors) * 100 : null,
        series: mapped.map((row) => ({
          date: String(row.date),
          visitors: Number(row.visitors ?? 0),
          leads: Number(row.leads ?? 0),
          whatsappClicks: Number(row.whatsapp_clicks ?? 0),
          bookings: Number(row.bookings ?? 0),
        })),
        sources: [],
        pages: [],
      },
    };
  },

  conversions: async (): Promise<{ funnel: { key: string; label: string; value: number }[]; hasData: boolean }> => {
    const rows = await run<Record<string, unknown>[]>('insights.conversions', () => supabase.from('leads').select('status, created_at'));
    const stages: { key: string; label: string }[] = [
      { key: 'new', label: 'Captured' },
      { key: 'contacted', label: 'Contacted' },
      { key: 'proposal', label: 'Proposal' },
      { key: 'won', label: 'Converted' },
    ];
    const funnel = stages.map((stage) => ({
      ...stage,
      value: (rows ?? []).filter((row) => row.status === stage.key).length,
    }));
    return { funnel, hasData: (rows ?? []).length > 0 };
  },

  seo: async (): Promise<SeoResponse> => {
    const rows = await run<Record<string, unknown>[]>('insights.seo', () => supabase.from('websites').select('*'));
    const sites = (rows ?? []).map((row) => {
      const website = mapWebsite(row);
      const issues: SeoResponse['sites'][number]['issues'] = [];
      if (!website.domain) issues.push({ severity: 'high' as const, issue: 'No custom domain connected', recommendation: 'Connect a custom domain.' });
      if (!website.ssl) issues.push({ severity: 'high' as const, issue: 'SSL not enabled', recommendation: 'Enable HTTPS.' });
      if (website.status !== 'live') issues.push({ severity: 'medium' as const, issue: 'Site is not live', recommendation: 'Publish the website.' });
      const score = Math.max(0, 100 - issues.length * 15);
      return { website, score, issues, rankings: [], indexed: website.status === 'live' && website.ssl };
    });
    return { sites, hasData: sites.length > 0 };
  },

  activity: async (limit = 40): Promise<{ items: ActivityRecord[] }> => {
    const rows = await run<Record<string, unknown>[]>('insights.activity', () =>
      supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(limit),
    );
    return { items: (rows ?? []).map(mapActivity) };
  },

  notifications: async (): Promise<{ items: NotificationRecord[]; unread: number }> => {
    const rows = await run<Record<string, unknown>[]>('insights.notifications', () =>
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
    );
    const items = (rows ?? []).map(mapNotification);
    return { items, unread: items.filter((item) => !item.read).length };
  },

  markRead: async (id?: string): Promise<{ unread: number }> => {
    const query = id
      ? supabase.from('notifications').update({ read: true }).eq('id', id)
      : supabase.from('notifications').update({ read: true }).eq('read', false);
    await run('insights.markRead', () => query);
    const { items } = await insightsService.notifications();
    return { unread: items.filter((item) => !item.read).length };
  },

  search: async (q: string, _signal?: AbortSignal): Promise<{ results: SearchResult[] }> => {
    const term = `%${q}%`;
    const [clients, leads, projects, invoices] = await Promise.all([
      run<Record<string, unknown>[]>('search.clients', () =>
        supabase.from('clients').select('id, business_name').or(`business_name.ilike.${term},email.ilike.${term}`).limit(5),
      ),
      run<Record<string, unknown>[]>('search.leads', () =>
        supabase.from('leads').select('id, contact_name, business_name').or(`contact_name.ilike.${term},business_name.ilike.${term}`).limit(5),
      ),
      run<Record<string, unknown>[]>('search.projects', () =>
        supabase.from('projects').select('id, name').ilike('name', term).limit(5),
      ),
      run<Record<string, unknown>[]>('search.invoices', () =>
        supabase.from('invoices').select('id, number').ilike('number', term).limit(5),
      ),
    ]);
    return {
      results: [
        ...(clients ?? []).map((row) => ({ id: String(row.id), type: 'client', title: String(row.business_name), subtitle: 'Client', href: `/app/clients/${row.id}` })),
        ...(leads ?? []).map((row) => ({ id: String(row.id), type: 'lead', title: String(row.contact_name), subtitle: String(row.business_name ?? 'Lead'), href: `/app/leads/${row.id}` })),
        ...(projects ?? []).map((row) => ({ id: String(row.id), type: 'project', title: String(row.name), subtitle: 'Project', href: '/app/projects' })),
        ...(invoices ?? []).map((row) => ({ id: String(row.id), type: 'invoice', title: String(row.number), subtitle: 'Invoice', href: '/app/invoices' })),
      ],
    };
  },
};

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface AnalyticsResponse {
  analytics: {
    website: Website;
    hasData: boolean;
    totals: { visitors: number; sessions: number; leads: number; whatsappClicks: number; bookings: number };
    conversionRate: number | null;
    series: { date: string; visitors: number; leads: number; whatsappClicks: number; bookings: number }[];
    sources: { source: string; count: number }[];
    pages: { path: string; views: number }[];
  } | null;
}

export interface SeoResponse {
  sites: {
    website: Website;
    score: number;
    issues: { severity: 'high' | 'medium' | 'low'; issue: string; recommendation: string }[];
    rankings: { keyword: string; position: number }[];
    indexed: boolean;
  }[];
  hasData: boolean;
}

/* ── System (spec §69, §70) ── */

export const systemService = {
  /**
   * Real health checks only — nothing is reported HEALTHY that has not
   * actually been verified against the live services.
   */
  health: async (): Promise<SystemHealthReport> => {
    const started = Date.now();
    const components: SystemHealthReport['components'] = [];

    // 1. Authentication service.
    try {
      const { error } = await supabase.auth.getSession();
      components.push({
        key: 'auth',
        label: 'Authentication',
        state: error ? 'degraded' : 'operational',
        detail: error ? 'Auth responded with an error.' : 'Auth session service is responding.',
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      components.push({
        key: 'auth',
        label: 'Authentication',
        state: 'offline',
        detail: 'Authentication service is unreachable.',
        latencyMs: null,
        checkedAt: new Date().toISOString(),
      });
    }

    // 2. Database connectivity + critical table access (RLS-aware).
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from('clients').select('id', { count: 'exact', head: true });
      const denied = error?.code === '42501';
      components.push({
        key: 'database',
        label: 'Database',
        state: error && !denied ? 'degraded' : 'operational',
        detail: error ? 'A table check failed.' : 'Connectivity and table access verified.',
        latencyMs: Date.now() - dbStart,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      components.push({
        key: 'database',
        label: 'Database',
        state: 'offline',
        detail: 'Database is unreachable.',
        latencyMs: null,
        checkedAt: new Date().toISOString(),
      });
    }

    // 3. Storage / API / deployment: not auditable from the browser —
    //    reported as UNKNOWN rather than falsely healthy (spec §69).
    for (const [key, label, detail] of [
      ['storage', 'Storage', 'Storage health is checked server-side.'],
      ['api', 'API', 'No dedicated API is deployed for this surface.'],
      ['automation', 'Automation', 'Workflow engine status is unknown from this view.'],
      ['deployment', 'Website deployment', 'Deployment status is managed in Vercel.'],
    ] as const) {
      components.push({ key, label, state: 'unknown', detail, latencyMs: null, checkedAt: new Date().toISOString() });
    }

    const states = components.map((component) => component.state);
    const state = states.includes('offline') ? 'offline' : states.includes('degraded') ? 'degraded' : 'operational';
    return { state, checkedAt: new Date().toISOString(), components };
  },

  status: async (): Promise<SystemHealthReport & { counts: Record<string, number> }> => {
    const report = await systemService.health();
    const [clients, leads, projects] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }),
    ]);
    return {
      ...report,
      counts: {
        clients: clients.count ?? 0,
        leads: leads.count ?? 0,
        projects: projects.count ?? 0,
      },
    };
  },

  mine: async (): Promise<SystemHealthReport> => systemService.health(),

  ping: async (): Promise<{ pong: boolean }> => {
    const { error } = await supabase.from('clients').select('id', { head: true, count: 'exact' }).limit(0);
    return { pong: !error };
  },
};

export type { Proposal };

/* ── Role management (spec §7: super_admin only) ── */

export interface ProfileRole {
  id: string;
  email: string;
  name: string;
  role: Role;
  clientId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export const rolesService = {
  /** Every profile with its application role. Admin-readable via RLS. */
  list: async (): Promise<ProfileRole[]> => {
    const rows = await run<Record<string, unknown>[]>('roles.list', () =>
      supabase
        .from('profiles')
        .select('id, email, name, role, client_id, created_at, last_login_at')
        .order('created_at', { ascending: true }),
    );
    return rows.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      name: String(row.name ?? ''),
      role: (row.role as Role | null) ?? 'client',
      clientId: (row.client_id as string | null) ?? null,
      createdAt: String(row.created_at),
      lastLoginAt: (row.last_login_at as string | null) ?? null,
    }));
  },

  /**
   * Change a user's application role.
   *
   * The DATABASE is the boundary (guard_profile_update, migration 0003):   * only a super_admin JWT — or a trusted no-JWT operator context — is
   * allowed to change `role`. An ordinary admin calling this gets an RLS
   * denial surfaced as a permission error, never a silent write.
   */
  setRole: async (userId: string, role: Role): Promise<void> => {
    await run('roles.setRole', () => supabase.from('profiles').update({ role }).eq('id', userId));
  },
};

/* ── Data export — "Download my data" (spec §54) ── */

export interface DataExport {
  filename: string;
  generatedAt: string;
  /** Table name → the rows the caller is entitled to read. */
  data: Record<string, unknown>;
  /** Tables that could not be read — reported, never silently swallowed. */
  warnings: string[];
}

/**
 * The signed-in user's own data export (spec §54).
 *
 * Every read below runs as the CALLER, under the same RLS policies as the
 * rest of the app, so an export can only ever contain rows this account is
 * already allowed to see: its own profile, its own client workspace and the
 * records attached to it. Another client's rows, internal admin notes on
 * other accounts, secrets and system configuration are not reachable from
 * here — not filtered out after the fact, but never returned in the first
 * place.
 *
 * A table that is missing or unreadable is reported in `warnings` rather
 * than failing the whole export; a partial, honest export beats none.
 */
export const dataExportService = {
  collect: async (): Promise<DataExport> => {
    assertSupabaseConfigured();
    const userId = await authUserId();
    if (!userId) throw sessionError();

    const warnings: string[] = [];
    const data: Record<string, unknown> = {};

    /** Read one table; a failure is recorded, never thrown away. */
    const grab = async (
      name: string,
      query: () => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>,
    ) => {
      try {
        const { data: rows, error } = await query();
        if (error) {
          warnings.push(`${name} could not be read (${error.code ?? 'error'}).`);
          return;
        }
        data[name] = rows ?? [];
      } catch {
        warnings.push(`${name} could not be read.`);
      }
    };

    const clientId = (await run<{ client_id: string | null }[]>('export.profile', () =>
      supabase.from('profiles').select('client_id').eq('id', userId).limit(1),
    ))?.[0]?.client_id ?? null;

    await grab('profile', () =>
      supabase.from('profiles').select('id, email, name, role, phone, age_verified, age_verified_at, created_at').eq('id', userId),
    );
    await grab('notification_preferences', () =>
      supabase.from('notification_preferences').select('*').eq('user_id', userId),
    );
    await grab('notifications', () => supabase.from('notifications').select('*').eq('user_id', userId));
    await grab('client', () => supabase.from('clients').select('*'));
    await grab('leads', () => supabase.from('leads').select('*'));
    await grab('projects', () => supabase.from('projects').select('*'));
    await grab('milestones', () => supabase.from('milestones').select('*'));
    await grab('websites', () => supabase.from('websites').select('*'));
    await grab('bookings', () => supabase.from('bookings').select('*'));
    await grab('client_requests', () => supabase.from('client_requests').select('*'));
    // Tickets go through the masking RPC, never the table. A client's own
    // export must not contain an internal admin note — reading `tickets`
    // directly would put those notes in the downloaded file.
    await grab('tickets', () => supabase.rpc('app_ticket_threads', { p_ticket_id: null }));
    await grab('files', () => supabase.from('files').select('*'));
    await grab('subscriptions', () => supabase.from('subscriptions').select('*'));
    await grab('invoices', () => supabase.from('invoices').select('*'));
    await grab('payments', () => supabase.from('payments').select('*'));
    await grab('whatsapp_messages', () => supabase.from('whatsapp_messages').select('*'));
    await grab('activity', () => supabase.from('activity').select('*'));

    const generatedAt = new Date().toISOString();
    const stamp = generatedAt.slice(0, 10);
    // The client id is not personal data on its own, but the filename is
    // visible to whoever handles the file — keep it impersonal.
    const filename = `northforge-export-${stamp}.json`;

    return {
      filename,
      generatedAt,
      data: {
        exported_at: generatedAt,
        export_scope: clientId ? 'client_account' : 'account',
        tables: data,
      },
      warnings,
    };
  },
};



