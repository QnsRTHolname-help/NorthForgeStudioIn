import { Router } from 'express';
import { db, newId, nowIso, queryAll, queryOne } from '../db';
import { assertCanAccessClient, clientScope, isAdmin, requireAuth, requireCsrf, requireRole } from '../auth';
import { asyncHandler, badRequest, notFound, ok } from '../lib/http';
import { parseBody, subscriptionCreateSchema } from '../lib/validate';
import { mapInvoice, mapPayment, mapSubscription } from '../mappers';
import { recordActivity } from '../services/activity';
import { notifyClientMembers } from '../services/notify';
import { PLANS, BILLING_INTERVAL_DAYS, getPlanById } from '@shared/catalog';

const router = Router();
router.use(requireAuth);

const GST_RATE = 0.18;

function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const row = queryOne<{ c: number }>('SELECT COUNT(*) as c FROM invoices');
  const seq = String((row?.c ?? 0) + 1).padStart(4, '0');
  return `NF-${year}-${seq}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

/**
 * Invoices are always built from the central catalog, never from a price
 * typed into a form (spec §105, §124).
 */
function buildInvoice(clientId: string, subscriptionId: string | null, planId: string, isDemo: boolean) {
  const plan = getPlanById(planId);
  if (!plan || plan.amount === null) throw badRequest('This plan is custom-quoted and cannot be invoiced automatically.');

  const amount = plan.amount;
  const tax = Math.round(amount * GST_RATE);
  const now = new Date();

  return {
    id: newId('in'),
    number: nextInvoiceNumber(),
    client_id: clientId,
    subscription_id: subscriptionId,
    amount,
    tax,
    total: amount + tax,
    currency: plan.currency,
    status: 'open',
    issued_at: now.toISOString(),
    due_at: addDays(now, 7),
    paid_at: null,
    line_items: JSON.stringify([
      { label: `${plan.name} plan`, description: `${plan.tagline} Billed every ${plan.intervalDays} days.`, amount },
      { label: 'GST (18%)', description: 'Goods and Services Tax', amount: tax },
    ]),
    is_demo: isDemo ? 1 : 0,
  };
}

/* ── Subscriptions ────────────────────────────────────────────── */
router.get(
  '/subscriptions',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const rows = queryAll<Record<string, unknown>>(
      `SELECT * FROM subscriptions WHERE 1=1${clause} ORDER BY started_at DESC`,
      params,
    );
    return ok(res, { items: rows.map(mapSubscription) });
  }),
);

router.post(
  '/subscriptions',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const input = parseBody(subscriptionCreateSchema, req.body);
    const plan = getPlanById(input.planId);
    if (!plan) throw badRequest('Choose a valid plan.');

    const existing = queryOne<{ id: string }>('SELECT id FROM subscriptions WHERE client_id = ?', [input.clientId]);
    if (existing) throw badRequest('This client already has a subscription. Change the plan instead.');

    const id = newId('sb');
    const now = new Date();
    db.prepare(
      `INSERT INTO subscriptions (id, client_id, plan_id, status, started_at, renews_at, seats, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
    ).run(id, input.clientId, input.planId, input.status, now.toISOString(), addDays(now, plan.intervalDays));

    db.prepare('UPDATE clients SET plan_id = ?, updated_at = ? WHERE id = ?').run(input.planId, nowIso(), input.clientId);

    recordActivity({
      type: 'subscription.created',
      label: `Subscription started · ${plan.name}`,
      actor: session.name,
      actorRole: session.role,
      entityType: 'subscription',
      entityId: id,
      clientId: input.clientId,
    });

    return ok(res, { subscription: queryOne<Record<string, unknown>>('SELECT * FROM subscriptions WHERE id = ?', [id]) }, 201);
  }),
);

router.patch(
  '/subscriptions/:id',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const { clause, params } = clientScope(session);
    const row = queryOne<Record<string, unknown>>(`SELECT * FROM subscriptions WHERE id = ?${clause}`, [id, ...params]);
    if (!row) throw notFound('That subscription does not exist.');

    const planId = req.body?.planId ? String(req.body.planId) : null;
    const status = req.body?.status ? String(req.body.status) : null;

    if (planId && !PLANS.some((p) => p.id === planId)) throw badRequest('Choose a valid plan.');
    if (status && !['trialing', 'active', 'past_due', 'paused', 'cancelled'].includes(status)) {
      throw badRequest('Invalid subscription status.');
    }
    // A client may switch plan or cancel; only admins can mark past_due/paused.
    if (status && !isAdmin(session) && !['active', 'cancelled'].includes(status)) {
      throw badRequest('You can reactivate or cancel your subscription. Contact support for anything else.');
    }

    const updates: string[] = [];
    const args: unknown[] = [];
    if (planId) {
      updates.push('plan_id = ?');
      args.push(planId);
      const plan = getPlanById(planId)!;
      updates.push('renews_at = ?');
      args.push(addDays(new Date(), plan.intervalDays));
    }
    if (status) {
      updates.push('status = ?');
      args.push(status);
      if (status === 'cancelled') {
        updates.push('cancel_at = ?');
        args.push(nowIso());
      }
    }
    if (updates.length) {
      args.push(id);
      db.prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`).run(...(args as never[]));
    }

    if (planId) db.prepare('UPDATE clients SET plan_id = ?, updated_at = ? WHERE id = ?').run(planId, nowIso(), String(row.client_id));

    const plan = planId ? getPlanById(planId) : null;
    recordActivity({
      type: plan ? 'subscription.plan_changed' : 'subscription.updated',
      label: plan ? `Plan changed to ${plan.name}` : `Subscription ${status ?? 'updated'}`,
      actor: session.name,
      actorRole: session.role,
      entityType: 'subscription',
      entityId: id,
      clientId: String(row.client_id),
    });

    return ok(res, { subscription: queryOne<Record<string, unknown>>('SELECT * FROM subscriptions WHERE id = ?', [id]) });
  }),
);

/* ── Invoices ─────────────────────────────────────────────────── */
router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const rows = queryAll<Record<string, unknown>>(
      `SELECT * FROM invoices WHERE 1=1${clause} ORDER BY issued_at DESC`,
      params,
    );
    return ok(res, { items: rows.map(mapInvoice) });
  }),
);

router.get(
  '/invoices/:id',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const { clause, params } = clientScope(session);
    const row = queryOne<Record<string, unknown>>(`SELECT * FROM invoices WHERE id = ?${clause}`, [id, ...params]);
    if (!row) throw notFound('That invoice does not exist.');

    const client = queryOne<Record<string, unknown>>('SELECT * FROM clients WHERE id = ?', [String(row.client_id)]);
    return ok(res, {
      invoice: mapInvoice(row),
      client: client
        ? {
            businessName: String(client.business_name),
            contactName: String(client.contact_name),
            email: String(client.email),
            city: client.city ? String(client.city) : null,
            state: client.state ? String(client.state) : null,
          }
        : null,
    });
  }),
);

/** Generates the next cycle invoice from the live catalog price. */
router.post(
  '/invoices',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const subscriptionId = String(req.body?.subscriptionId ?? '');
    const sub = queryOne<Record<string, unknown>>('SELECT * FROM subscriptions WHERE id = ?', [subscriptionId]);
    if (!sub) throw notFound('That subscription does not exist.');

    const client = queryOne<Record<string, unknown>>('SELECT is_demo FROM clients WHERE id = ?', [String(sub.client_id)]);
    const invoice = buildInvoice(String(sub.client_id), subscriptionId, String(sub.plan_id), Boolean(Number(client?.is_demo ?? 0)));

    db.prepare(
      `INSERT INTO invoices (id, number, client_id, subscription_id, amount, tax, total, currency, status, issued_at, due_at, paid_at, line_items, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      invoice.id,
      invoice.number,
      invoice.client_id,
      invoice.subscription_id,
      invoice.amount,
      invoice.tax,
      invoice.total,
      invoice.currency,
      invoice.status,
      invoice.issued_at,
      invoice.due_at,
      invoice.paid_at,
      invoice.line_items,
      invoice.is_demo,
    );

    recordActivity({
      type: 'invoice.generated',
      label: `Invoice ${invoice.number} generated`,
      actor: session.name,
      actorRole: session.role,
      entityType: 'invoice',
      entityId: invoice.id,
      clientId: invoice.client_id,
    });

    notifyClientMembers(invoice.client_id, {
      kind: 'billing',
      title: `Invoice ${invoice.number} is ready`,
      body: 'A new invoice has been generated for your subscription.',
      href: '/portal/invoices',
      entityType: 'invoice',
      entityId: invoice.id,
    });

    return ok(res, { invoice: queryOne<Record<string, unknown>>('SELECT * FROM invoices WHERE id = ?', [invoice.id]) }, 201);
  }),
);

router.patch(
  '/invoices/:id',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const row = queryOne<Record<string, unknown>>('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!row) throw notFound('That invoice does not exist.');

    const status = String(req.body?.status ?? '');
    if (!['draft', 'open', 'paid', 'void', 'uncollectible'].includes(status)) throw badRequest('Invalid invoice status.');

    db.prepare('UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?').run(
      status,
      status === 'paid' ? nowIso() : null,
      id,
    );

    if (status === 'paid') {
      db.prepare(
        `INSERT INTO payments (id, invoice_id, client_id, amount, currency, status, method, paid_at, is_demo)
         VALUES (?, ?, ?, ?, ?, 'succeeded', 'manual', ?, ?)`,
      ).run(newId('pm'), id, String(row.client_id), Number(row.total), String(row.currency), nowIso(), Number(row.is_demo ?? 0));

      recordActivity({
        type: 'invoice.paid',
        label: `Invoice ${String(row.number)} marked paid`,
        actor: session.name,
        actorRole: session.role,
        entityType: 'invoice',
        entityId: id,
        clientId: String(row.client_id),
      });
    }

    return ok(res, { invoice: queryOne<Record<string, unknown>>('SELECT * FROM invoices WHERE id = ?', [id]) });
  }),
);

/* ── Payments ─────────────────────────────────────────────────── */
router.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const rows = queryAll<Record<string, unknown>>(
      `SELECT * FROM payments WHERE 1=1${clause} ORDER BY paid_at DESC LIMIT 100`,
      params,
    );
    return ok(res, { items: rows.map(mapPayment) });
  }),
);

/* ── Plan catalogue (read-only view, still sourced from catalog) ─ */
router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const counts = queryAll<{ plan_id: string; c: number }>(
      'SELECT plan_id, COUNT(*) as c FROM subscriptions GROUP BY plan_id',
    );
    const map = new Map(counts.map((c) => [c.plan_id, c.c]));
    return ok(res, { plans: PLANS.map((p) => ({ ...p, subscribers: map.get(p.id) ?? 0 })) });
  }),
);

export default router;

export const BILLING_INTERVAL = BILLING_INTERVAL_DAYS;
export function assertClient(clientId: string | null) {
  if (clientId) assertCanAccessClient({ userId: '', email: '', name: '', role: 'admin', clientId: null }, clientId);
}
