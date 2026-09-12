import { Router } from 'express';
import { db, newId, nowIso, queryAll, queryOne } from '../db';
import { assertCanAccessClient, isAdmin, requireAuth, requireCsrf, requireRole } from '../auth';
import { asyncHandler, badRequest, conflict, notFound, ok } from '../lib/http';
import { parseBody, clientCreateSchema, onboardingSaveSchema } from '../lib/validate';
import {
  mapBooking,
  mapClient,
  mapInvoice,
  mapLead,
  mapProject,
  mapRequest,
  mapSubscription,
  mapTask,
  mapWebsite,
} from '../mappers';
import { listActivity, recordActivity } from '../services/activity';
import { notifyClientMembers } from '../services/notify';
import type { Client, OnboardingDraft } from '@shared/types';

const router = Router();
router.use(requireAuth);

/* ── List ─────────────────────────────────────────────────────── */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const q = String(req.query.q ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 25)));

    if (session.role === 'client') {
      const row = session.clientId
        ? queryOne<Record<string, unknown>>('SELECT * FROM clients WHERE id = ?', [session.clientId])
        : null;
      return ok(res, { items: row ? [mapClient(row)] : [], total: row ? 1 : 0, page: 1, pageSize });
    }

    const where: string[] = [];
    const args: unknown[] = [];
    if (q) {
      where.push('(business_name LIKE ? OR contact_name LIKE ? OR email LIKE ?)');
      const like = `%${q}%`;
      args.push(like, like, like);
    }
    if (status) {
      where.push('status = ?');
      args.push(status);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const total = queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM clients${whereSql}`, args)?.c ?? 0;
    const rows = queryAll<Record<string, unknown>>(
      `SELECT * FROM clients${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...args, pageSize, (page - 1) * pageSize],
    );

    return ok(res, { items: rows.map(mapClient), total, page, pageSize });
  }),
);

/* ── Detail with real aggregates ──────────────────────────────── */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    assertCanAccessClient(session, id);

    const row = queryOne<Record<string, unknown>>('SELECT * FROM clients WHERE id = ?', [id]);
    if (!row) throw notFound('That client does not exist.');
    const client = mapClient(row);

    const project = queryOne<Record<string, unknown>>('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC LIMIT 1', [id]);
    const website = queryOne<Record<string, unknown>>('SELECT * FROM websites WHERE client_id = ? ORDER BY created_at DESC LIMIT 1', [id]);
    const subscription = queryOne<Record<string, unknown>>('SELECT * FROM subscriptions WHERE client_id = ? ORDER BY started_at DESC LIMIT 1', [id]);
    const leads = queryAll<Record<string, unknown>>('SELECT * FROM leads WHERE client_id = ? ORDER BY created_at DESC LIMIT 8', [id]).map(mapLead);
    const invoices = queryAll<Record<string, unknown>>('SELECT * FROM invoices WHERE client_id = ? ORDER BY issued_at DESC LIMIT 8', [id]).map(mapInvoice);
    const requests = queryAll<Record<string, unknown>>('SELECT * FROM client_requests WHERE client_id = ? ORDER BY created_at DESC LIMIT 8', [id]).map(mapRequest);
    const bookings = queryAll<Record<string, unknown>>('SELECT * FROM bookings WHERE client_id = ? ORDER BY starts_at DESC LIMIT 8', [id]).map(mapBooking);
    const tasks = queryAll<Record<string, unknown>>('SELECT * FROM tasks WHERE client_id = ? ORDER BY due_date IS NULL, due_date ASC LIMIT 12', [id]).map(mapTask);
    const activity = listActivity({ ...session, role: 'admin' }, 20, id);

    const revenue = queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE client_id = ? AND status = 'succeeded'",
      [id],
    )?.total ?? 0;

    return ok(res, {
      client,
      project: project ? mapProject(project) : null,
      website: website ? mapWebsite(website) : null,
      subscription: subscription ? mapSubscription(subscription) : null,
      leads,
      invoices,
      requests,
      bookings,
      tasks,
      activity,
      revenue,
    });
  }),
);

/* ── Create (admin) ───────────────────────────────────────────── */
router.post(
  '/',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const input = parseBody(clientCreateSchema, req.body);

    const existing = queryOne<{ id: string }>('SELECT id FROM clients WHERE email = ?', [input.email]);
    if (existing) throw conflict('A client with that email already exists.');

    const id = newId('cl');
    const now = nowIso();

    db.prepare(
      `INSERT INTO clients (id, business_name, contact_name, email, phone, business_type, city, state, plan_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.businessName,
      input.contactName,
      input.email,
      input.phone || null,
      input.businessType || null,
      input.city || null,
      input.state || null,
      input.planId || null,
      input.status,
      now,
      now,
    );

    recordActivity({
      type: 'client.created',
      label: 'Client created',
      detail: input.businessName,
      actor: session.name,
      actorRole: session.role,
      entityType: 'client',
      entityId: id,
      clientId: id,
    });

    const row = queryOne<Record<string, unknown>>('SELECT * FROM clients WHERE id = ?', [id]);
    return ok(res, { client: row ? mapClient(row) : null }, 201);
  }),
);

/* ── Update ───────────────────────────────────────────────────── */
router.patch(
  '/:id',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    assertCanAccessClient(session, id);

    const row = queryOne<Record<string, unknown>>('SELECT * FROM clients WHERE id = ?', [id]);
    if (!row) throw notFound('That client does not exist.');

    const isAdminUser = isAdmin(session);
    const columnMap: Record<string, string> = {
      businessName: 'business_name',
      contactName: 'contact_name',
      phone: 'phone',
      businessType: 'business_type',
      city: 'city',
      state: 'state',
      websiteUrl: 'website_url',
      notes: 'notes',
      // Admin-managed fields only.
      status: 'status',
      planId: 'plan_id',
    };

    const updates: string[] = [];
    const params: unknown[] = [];

    for (const [key, column] of Object.entries(columnMap)) {
      const value = req.body?.[key];
      if (value === undefined) continue;
      if (!isAdminUser && ['status', 'planId', 'notes'].includes(key)) continue;
      updates.push(`${column} = ?`);
      params.push(typeof value === 'string' ? value.trim() : value);
    }

    if (updates.length) {
      params.push(nowIso(), id);
      db.prepare(`UPDATE clients SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...(params as never[]));
    }

    recordActivity({
      type: 'client.updated',
      label: 'Client profile updated',
      detail: String(row.business_name),
      actor: session.name,
      actorRole: session.role,
      entityType: 'client',
      entityId: id,
      clientId: id,
    });

    const updated = queryOne<Record<string, unknown>>('SELECT * FROM clients WHERE id = ?', [id]);
    return ok(res, { client: updated ? mapClient(updated) : null });
  }),
);

/* ── Onboarding (11-step flow, draft persisted per step) ──────── */
router.get(
  '/:id/onboarding',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const clientId = String(req.params.id);
    assertCanAccessClient(session, clientId);

    const row = queryOne<Record<string, unknown>>(
      'SELECT * FROM onboarding_drafts WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1',
      [clientId],
    );

    const client = queryOne<Record<string, unknown>>('SELECT onboarding_step, onboarding_completed FROM clients WHERE id = ?', [clientId]);

    const draft: OnboardingDraft = row
      ? {
          clientId,
          currentStep: Number(row.current_step),
          completed: Boolean(Number(row.completed)),
          data: JSON.parse(String(row.data ?? '{}')) as Record<string, unknown>,
          updatedAt: String(row.updated_at),
        }
      : {
          clientId,
          currentStep: Number(client?.onboarding_step ?? 0),
          completed: Boolean(Number(client?.onboarding_completed ?? 0)),
          data: {},
          updatedAt: nowIso(),
        };

    return ok(res, { draft });
  }),
);

router.post(
  '/:id/onboarding',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const clientId = String(req.params.id);
    assertCanAccessClient(session, clientId);

    const input = parseBody(onboardingSaveSchema, req.body);
    const existing = queryOne<{ id: string }>(
      'SELECT id FROM onboarding_drafts WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1',
      [clientId],
    );

    if (existing) {
      db.prepare('UPDATE onboarding_drafts SET current_step = ?, completed = ?, data = ?, updated_at = ? WHERE id = ?').run(
        input.currentStep,
        input.completed ? 1 : 0,
        JSON.stringify(input.data),
        nowIso(),
        existing.id,
      );
    } else {
      db.prepare(
        'INSERT INTO onboarding_drafts (id, client_id, user_id, current_step, completed, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(newId('ob'), clientId, session.userId, input.currentStep, input.completed ? 1 : 0, JSON.stringify(input.data), nowIso());
    }

    db.prepare('UPDATE clients SET onboarding_step = ?, onboarding_completed = ?, updated_at = ? WHERE id = ?').run(
      input.currentStep,
      input.completed ? 1 : 0,
      nowIso(),
      clientId,
    );

    if (input.completed) {
      recordActivity({
        type: 'client.onboarding_completed',
        label: 'Onboarding completed',
        actor: session.name,
        actorRole: session.role,
        entityType: 'client',
        entityId: clientId,
        clientId,
      });
      notifyClientMembers(clientId, {
        kind: 'system',
        title: 'Onboarding complete',
        body: 'Your business profile is ready. We will be in touch with next steps.',
        href: '/portal',
      });
    }

    const draft: OnboardingDraft = {
      clientId,
      currentStep: input.currentStep,
      completed: input.completed,
      data: input.data,
      updatedAt: nowIso(),
    };
    return ok(res, { draft });
  }),
);

export default router;

export function clientExists(id: string): Client | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM clients WHERE id = ?', [id]);
  return row ? mapClient(row) : null;
}

export function assertValidClientId(id: string) {
  if (!id) throw badRequest('Choose a client.');
}
