import { Router } from 'express';
import { queryAll, queryOne, nowIso } from '../db';
import { clientScope, isAdmin, requireAuth, requireCsrf, requireRole } from '../auth';
import { asyncHandler, ok } from '../lib/http';
import { mapBooking, mapClient, mapLead, mapProject, mapSubscription, mapTask, mapWebsite } from '../mappers';
import { listActivity } from '../services/activity';
import { listNotifications, unreadCount } from '../services/notify';
import { getPlanById, PLANS } from '@shared/catalog';
import { checkHealthState } from '../services/health';
import type { AdminDashboard, ClientDashboard, LeadStatus, SeriesPoint } from '@shared/types';

const router = Router();
router.use(requireAuth);

const LEAD_STATUSES: LeadStatus[] = ['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'];

function last30DaysSeries(rows: { date: string; value: number }[]): SeriesPoint[] {
  const map = new Map(rows.map((r) => [r.date.slice(0, 10), r.value]));
  const out: SeriesPoint[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, value: map.get(key) ?? 0 });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   CLIENT DASHBOARD — "what is happening with my business?"
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/dashboard/client',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const clientId = session.clientId;
    if (!clientId) return ok(res, { dashboard: null });

    const clientRow = queryOne<Record<string, unknown>>('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (!clientRow) return ok(res, { dashboard: null });

    const website = queryOne<Record<string, unknown>>('SELECT * FROM websites WHERE client_id = ? ORDER BY created_at DESC LIMIT 1', [clientId]);
    const project = queryOne<Record<string, unknown>>('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC LIMIT 1', [clientId]);
    const subscription = queryOne<Record<string, unknown>>('SELECT * FROM subscriptions WHERE client_id = ? ORDER BY started_at DESC LIMIT 1', [clientId]);

    const leadRows = queryAll<Record<string, unknown>>('SELECT * FROM leads WHERE client_id = ?', [clientId]);
    const leads = leadRows.map(mapLead);

    const analytics = website
      ? queryAll<{ date: string; visitors: number; leads: number; whatsapp_clicks: number; bookings: number }>(
          'SELECT date, visitors, leads, whatsapp_clicks, bookings FROM website_analytics WHERE website_id = ? ORDER BY date DESC LIMIT 90',
          [String(website.id)],
        )
      : [];

    const visitors = analytics.reduce((sum, a) => sum + a.visitors, 0);
    const whatsappClicks = analytics.reduce((sum, a) => sum + a.whatsapp_clicks, 0);
    const bookingsCount = queryAll<{ id: string }>('SELECT id FROM bookings WHERE client_id = ?', [clientId]).length;
    const openRequests = queryAll<{ id: string }>(
      "SELECT id FROM client_requests WHERE client_id = ? AND status IN ('open','in_progress','blocked')",
      [clientId],
    ).length;

    const leadsNew = leads.filter((l) => l.status === 'new').length;
    const leadsQualified = leads.filter((l) => ['qualified', 'contacted', 'proposal'].includes(l.status)).length;
    const leadsContacted = leads.filter((l) => ['contacted', 'proposal'].includes(l.status)).length;
    const leadsConverted = leads.filter((l) => l.status === 'won').length;

    // Conversion is only reported when there is a real denominator (spec §104).
    const conversionRate = visitors > 0 ? Number(((leads.length / visitors) * 100).toFixed(2)) : null;

    const seriesRows = analytics.length
      ? analytics.map((a) => ({ date: a.date, value: a.leads }))
      : queryAll<{ date: string; value: number }>(
          "SELECT substr(created_at, 1, 10) as date, COUNT(*) as value FROM leads WHERE client_id = ? GROUP BY substr(created_at, 1, 10)",
          [clientId],
        );

    const upcomingBookings = queryAll<Record<string, unknown>>(
      'SELECT * FROM bookings WHERE client_id = ? AND starts_at >= ? ORDER BY starts_at ASC LIMIT 5',
      [clientId, new Date().toISOString()],
    ).map(mapBooking);

    const dashboard: ClientDashboard = {
      client: mapClient(clientRow),
      website: website ? mapWebsite(website) : null,
      project: project ? mapProject(project) : null,
      subscription: subscription ? mapSubscription(subscription) : null,
      plan: subscription ? getPlanById(String(subscription.plan_id)) : null,
      metrics: {
        leadsTotal: leads.length,
        leadsNew,
        leadsQualified,
        leadsContacted,
        leadsConverted,
        conversionRate,
        visitors: analytics.length ? visitors : null,
        whatsappClicks: analytics.length ? whatsappClicks : null,
        bookings: bookingsCount,
        openRequests,
      },
      series: last30DaysSeries(seriesRows),
      upcomingBookings,
      recentActivity: listActivity(session, 8),
      hasData: leads.length > 0 || analytics.length > 0 || bookingsCount > 0,
    };

    return ok(res, { dashboard });
  }),
);

/* ═══════════════════════════════════════════════════════════════
   ADMIN DASHBOARD — agency command centre
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/dashboard/admin',
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const session = req.auth!;

    const revenue = queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'succeeded'",
    )?.total ?? 0;

    const activeSubs = queryAll<{ plan_id: string }>("SELECT plan_id FROM subscriptions WHERE status = 'active'");
    const recurringRevenue = activeSubs.reduce((sum, s) => sum + (getPlanById(s.plan_id)?.amount ?? 0), 0);

    const leads = queryAll<{ status: LeadStatus; c: number }>(
      'SELECT status, COUNT(*) as c FROM leads GROUP BY status',
    );
    const leadCount = leads.reduce((sum, l) => sum + l.c, 0);
    const won = leads.find((l) => l.status === 'won')?.c ?? 0;
    const conversionRate = leadCount > 0 ? Number(((won / leadCount) * 100).toFixed(1)) : null;

    const activeClients = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM clients WHERE status = 'active'")?.c ?? 0;
    const activeProjects = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM projects WHERE status = 'active'")?.c ?? 0;
    const openTasks = queryAll<Record<string, unknown>>(
      "SELECT * FROM tasks WHERE status != 'done' ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 8",
    ).map(mapTask);

    const pipelineRows = queryAll<{ status: LeadStatus; c: number; v: number }>(
      'SELECT status, COUNT(*) as c, COALESCE(SUM(value), 0) as v FROM leads GROUP BY status',
    );
    const pipelineMap = new Map(pipelineRows.map((p) => [p.status, p]));

    const seriesRows = queryAll<{ date: string; value: number }>(
      "SELECT substr(created_at, 1, 10) as date, COUNT(*) as value FROM leads GROUP BY substr(created_at, 1, 10)",
    );

    const workflows = queryAll<Record<string, unknown>>('SELECT * FROM workflows ORDER BY created_at DESC LIMIT 5').map((w) => ({
      id: String(w.id),
      name: String(w.name),
      status: String(w.status),
      trigger: String(w.trigger),
      runs: Number(w.runs ?? 0),
    })) as AdminDashboard['workflows'];

    const dashboard: AdminDashboard = {
      metrics: {
        revenue,
        recurringRevenue,
        leads: leadCount,
        conversionRate,
        activeClients,
        activeProjects,
        openTasks: queryOne<{ c: number }>("SELECT COUNT(*) as c FROM tasks WHERE status != 'done'")?.c ?? 0,
        systemHealth: checkHealthState(),
      },
      pipeline: LEAD_STATUSES.map((status) => ({
        status,
        count: pipelineMap.get(status)?.c ?? 0,
        value: pipelineMap.get(status)?.v ?? 0,
      })),
      series: last30DaysSeries(seriesRows),
      recentActivity: listActivity(session, 12),
      openTasks,
      workflows,
      hasData: leadCount > 0 || activeClients > 0 || revenue > 0,
    };

    return ok(res, { dashboard });
  }),
);

/* ═══════════════════════════════════════════════════════════════
   ANALYTICS — only real recorded data
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const clientId = session.role === 'client' ? session.clientId : String(req.query.clientId ?? '');
    if (!clientId) return ok(res, { analytics: null });

    const website = queryOne<Record<string, unknown>>('SELECT * FROM websites WHERE client_id = ? ORDER BY created_at DESC LIMIT 1', [clientId]);
    if (!website) return ok(res, { analytics: null });

    const rows = queryAll<Record<string, unknown>>(
      'SELECT * FROM website_analytics WHERE website_id = ? ORDER BY date ASC LIMIT 180',
      [String(website.id)],
    );

    interface AnalyticsTotals {
      visitors: number;
      sessions: number;
      leads: number;
      whatsappClicks: number;
      bookings: number;
    }

    const totals = rows.reduce<AnalyticsTotals>(
      (acc, r) => ({
        visitors: acc.visitors + Number(r.visitors ?? 0),
        sessions: acc.sessions + Number(r.sessions ?? 0),
        leads: acc.leads + Number(r.leads ?? 0),
        whatsappClicks: acc.whatsappClicks + Number(r.whatsapp_clicks ?? 0),
        bookings: acc.bookings + Number(r.bookings ?? 0),
      }),
      { visitors: 0, sessions: 0, leads: 0, whatsappClicks: 0, bookings: 0 },
    );

    // Real source attribution, derived from recorded lead sources.
    const sources = queryAll<{ source: string; c: number }>(
      'SELECT source, COUNT(*) as c FROM leads WHERE client_id = ? GROUP BY source ORDER BY c DESC',
      [clientId],
    ).map((s) => ({ source: s.source, count: s.c }));

    return ok(res, {
      analytics: {
        website: mapWebsite(website),
        hasData: rows.length > 0,
        totals,
        conversionRate: totals.visitors > 0 ? Number(((totals.leads / totals.visitors) * 100).toFixed(2)) : null,
        series: rows.map((r) => ({
          date: String(r.date),
          visitors: Number(r.visitors ?? 0),
          leads: Number(r.leads ?? 0),
          whatsappClicks: Number(r.whatsapp_clicks ?? 0),
          bookings: Number(r.bookings ?? 0),
        })),
        sources,
        // Page-level reporting requires a connected analytics source.
        pages: [],
      },
    });
  }),
);

/* ── Conversion funnel from real records ─────────────────────── */
router.get(
  '/conversions',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);

    const websiteRows = queryAll<{ visitors: number; leads: number }>(
      `SELECT COALESCE(SUM(a.visitors), 0) as visitors, COALESCE(SUM(a.leads), 0) as leads
       FROM website_analytics a JOIN websites w ON w.id = a.website_id WHERE 1=1${clause}`,
      params,
    );
    const visitors = websiteRows[0]?.visitors ?? 0;

    const counts = queryAll<{ status: LeadStatus; c: number }>(
      `SELECT status, COUNT(*) as c FROM leads WHERE 1=1${clause} GROUP BY status`,
      params,
    );
    const byStatus = new Map(counts.map((c) => [c.status, c.c]));

    const totalLeads = counts.reduce((sum, c) => sum + c.c, 0);
    const qualified = (byStatus.get('qualified') ?? 0) + (byStatus.get('contacted') ?? 0) + (byStatus.get('proposal') ?? 0);
    const booked = queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM bookings WHERE 1=1${clause}`, params)?.c ?? 0;
    const converted = byStatus.get('won') ?? 0;

    return ok(res, {
      funnel: [
        { key: 'visitors', label: 'Visitors', value: visitors },
        { key: 'leads', label: 'Leads', value: totalLeads },
        { key: 'qualified', label: 'Qualified', value: qualified },
        { key: 'booked', label: 'Booked', value: booked },
        { key: 'converted', label: 'Converted', value: converted },
      ],
      hasData: visitors > 0 || totalLeads > 0,
    });
  }),
);

/* ── SEO health: checks we can actually perform ───────────────── */
router.get(
  '/seo',
  requireRole('admin', 'super_admin'),
  asyncHandler(async (_req, res) => {
    const websites = queryAll<Record<string, unknown>>('SELECT * FROM websites').map(mapWebsite);

    const sites = websites.map((site) => {
      const issues: { severity: 'high' | 'medium' | 'low'; issue: string; recommendation: string }[] = [];

      if (!site.ssl) {
        issues.push({ severity: 'high', issue: 'SSL is not active on this domain.', recommendation: 'Provision a certificate and force HTTPS redirects.' });
      }
      if (!site.domain) {
        issues.push({ severity: 'medium', issue: 'No primary domain configured.', recommendation: 'Set a canonical domain to avoid duplicate URLs.' });
      }
      if (site.status !== 'live') {
        issues.push({ severity: 'medium', issue: `Site status is "${site.status}".`, recommendation: 'Launch the site so search engines can index it.' });
      }
      if (!site.lastDeployedAt) {
        issues.push({ severity: 'low', issue: 'No deployment recorded.', recommendation: 'Deploy at least once to validate the build.' });
      } else {
        const ageDays = Math.round((Date.now() - new Date(site.lastDeployedAt).getTime()) / 86_400_000);
        if (ageDays > 90) {
          issues.push({ severity: 'low', issue: `Last deployed ${ageDays} days ago.`, recommendation: 'Ship a content or performance update.' });
        }
      }

      const analyticsRows = queryOne<{ c: number }>('SELECT COUNT(*) as c FROM website_analytics WHERE website_id = ?', [site.id])?.c ?? 0;
      if (analyticsRows === 0) {
        issues.push({ severity: 'medium', issue: 'No analytics data recorded yet.', recommendation: 'Connect the analytics collector to start measuring traffic.' });
      }

      const score = Math.max(0, 100 - issues.reduce((sum, i) => sum + (i.severity === 'high' ? 30 : i.severity === 'medium' ? 12 : 5), 0));

      return {
        website: site,
        score,
        issues,
        // Rankings are never fabricated — this is where a real
        // Search Console / rank-tracker integration would populate them.
        rankings: [] as { keyword: string; position: number }[],
        indexed: site.status === 'live',
      };
    });

    return ok(res, { sites, hasData: sites.length > 0 });
  }),
);

/* ═══════════════════════════════════════════════════════════════
   ACTIVITY + NOTIFICATIONS + GLOBAL SEARCH
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 40)));
    return ok(res, { items: listActivity(session, limit) });
  }),
);

router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    return ok(res, {
      items: listNotifications(session.userId),
      unread: unreadCount(session.userId),
    });
  }),
);

router.post(
  '/notifications/read',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = req.body?.id ? String(req.body.id) : null;
    if (id) {
      queryOne('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [id, session.userId]);
    } else {
      queryOne('UPDATE notifications SET read = 1 WHERE user_id = ?', [session.userId]);
    }
    return ok(res, { unread: unreadCount(session.userId) });
  }),
);

/** Global search — every result is re-scoped to the caller (spec §72, §83). */
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return ok(res, { results: [] });

    const like = `%${q}%`;
    const { clause, params } = clientScope(session);
    const results: { id: string; type: string; title: string; subtitle: string; href: string }[] = [];

    const push = (
      rows: Record<string, unknown>[],
      type: string,
      title: (r: Record<string, unknown>) => string,
      subtitle: (r: Record<string, unknown>) => string,
      href: (r: Record<string, unknown>) => string,
    ) => {
      for (const row of rows) {
        results.push({ id: String(row.id), type, title: title(row), subtitle: subtitle(row), href: href(row) });
      }
    };

    if (isAdmin(session)) {
      push(
        queryAll<Record<string, unknown>>('SELECT * FROM clients WHERE business_name LIKE ? OR email LIKE ? LIMIT 5', [like, like]),
        'client',
        (r) => String(r.business_name),
        (r) => String(r.email),
        (r) => `/app/clients/${r.id}`,
      );
    }

    push(
      queryAll<Record<string, unknown>>(`SELECT * FROM leads WHERE (contact_name LIKE ? OR business_name LIKE ? OR email LIKE ?)${clause} LIMIT 6`, [like, like, like, ...params]),
      'lead',
      (r) => String(r.business_name || r.contact_name),
      (r) => `${String(r.status)} lead · ${String(r.source)}`,
      (r) => `/app/leads/${r.id}`,
    );

    push(
      queryAll<Record<string, unknown>>(`SELECT * FROM projects WHERE name LIKE ?${clause} LIMIT 5`, [like, ...params]),
      'project',
      (r) => String(r.name),
      (r) => `Project · ${String(r.stage)}`,
      () => `/app/projects`,
    );

    push(
      queryAll<Record<string, unknown>>(`SELECT * FROM websites WHERE name LIKE ? OR domain LIKE ?${clause} LIMIT 5`, [like, like, ...params]),
      'website',
      (r) => String(r.name),
      (r) => (r.domain ? String(r.domain) : 'No domain'),
      (r) => `/app/websites/${r.id}`,
    );

    push(
      queryAll<Record<string, unknown>>(`SELECT * FROM tasks WHERE title LIKE ?${clause} LIMIT 5`, [like, ...params]),
      'task',
      (r) => String(r.title),
      (r) => `Task · ${String(r.status).replace('_', ' ')}`,
      () => `/app/tasks`,
    );

    push(
      queryAll<Record<string, unknown>>(`SELECT * FROM invoices WHERE number LIKE ?${clause} LIMIT 5`, [like, ...params]),
      'invoice',
      (r) => String(r.number),
      (r) => `Invoice · ${String(r.status)}`,
      () => `/app/invoices`,
    );

    push(
      queryAll<Record<string, unknown>>(`SELECT * FROM client_requests WHERE title LIKE ?${clause} LIMIT 5`, [like, ...params]),
      'request',
      (r) => String(r.title),
      (r) => `Request · ${String(r.status).replace('_', ' ')}`,
      () => `/app/requests`,
    );

    // Clients never receive admin-only deep links.
    const safe = isAdmin(session)
      ? results
      : results.map((r) => ({ ...r, href: r.href.replace(/^\/app\//, '/portal/') }));

    return ok(res, { results: safe.slice(0, 20) });
  }),
);

/** Plan + service catalogue metrics for admin billing views. */
router.get(
  '/catalog-stats',
  requireRole('admin', 'super_admin'),
  asyncHandler(async (_req, res) => {
    const subs = queryAll<{ plan_id: string; c: number }>(
      "SELECT plan_id, COUNT(*) as c FROM subscriptions WHERE status = 'active' GROUP BY plan_id",
    );
    const map = new Map(subs.map((s) => [s.plan_id, s.c]));
    return ok(res, {
      plans: PLANS.map((p) => ({ ...p, subscribers: map.get(p.id) ?? 0 })),
      updatedAt: nowIso(),
    });
  }),
);

export default router;
