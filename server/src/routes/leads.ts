import { Router } from 'express';
import { db, newId, nowIso, queryAll, queryOne } from '../db';
import { assertCanAccessClient, clientScope, isAdmin, requireAuth, requireRole, requireCsrf } from '../auth';
import { asyncHandler, conflict, notFound, ok } from '../lib/http';
import { parseBody, leadCreateSchema, leadUpdateSchema, leadStatuses } from '../lib/validate';
import { mapFollowUp, mapLead } from '../mappers';
import { recordActivity } from '../services/activity';
import { notifyAdmins } from '../services/notify';
import { qualifyLead } from '../services/lead-score';
import type { Session } from '../auth';
import type { Lead, LeadStatus } from '@shared/types';

const router = Router();
router.use(requireAuth);

const SELECT = 'SELECT * FROM leads';

function findLead(session: Session, id: string): Lead {
  const { clause, params } = clientScope(session);
  const row = queryOne<Record<string, unknown>>(`${SELECT} WHERE id = ?${clause}`, [id, ...params]);
  if (!row) throw notFound('That lead does not exist or you do not have access to it.');
  return mapLead(row);
}

/* ── List / search (admin: everything; client: own leads only) ─── */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const q = String(req.query.q ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const source = String(req.query.source ?? '').trim();
    const sort = String(req.query.sort ?? 'created_desc');
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 25)));

    const { clause, params } = clientScope(session);
    const where: string[] = [];
    const args: unknown[] = [];

    if (q) {
      where.push('(contact_name LIKE ? OR business_name LIKE ? OR email LIKE ? OR phone LIKE ? OR message LIKE ?)');
      const like = `%${q}%`;
      args.push(like, like, like, like, like);
    }
    if (status && leadStatuses.includes(status as LeadStatus)) {
      where.push('status = ?');
      args.push(status);
    }
    if (source) {
      where.push('source = ?');
      args.push(source);
    }

    const whereSql = where.length ? ` WHERE 1=1${clause} AND ${where.join(' AND ')}` : ` WHERE 1=1${clause}`;

    const orderMap: Record<string, string> = {
      created_desc: 'created_at DESC',
      created_asc: 'created_at ASC',
      score_desc: 'score DESC',
      name_asc: 'contact_name ASC',
      status_asc: 'status ASC',
    };

    const total = queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM leads${whereSql}`, [...params, ...args])?.c ?? 0;

    const rows = queryAll<Record<string, unknown>>(
      `${SELECT}${whereSql} ORDER BY ${orderMap[sort] ?? orderMap.created_desc!} LIMIT ? OFFSET ?`,
      [...params, ...args, pageSize, (page - 1) * pageSize],
    );

    return ok(res, { items: rows.map(mapLead), total, page, pageSize });
  }),
);

/* ── Pipeline counts (Kanban) ─────────────────────────────────── */
router.get(
  '/pipeline',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const rows = queryAll<{ status: LeadStatus; count: number; value: number }>(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(value), 0) as value FROM leads WHERE 1=1${clause} GROUP BY status`,
      params,
    );
    const byStatus = new Map(rows.map((r) => [r.status, r]));
    const pipeline = leadStatuses.map((status) => ({
      status,
      count: byStatus.get(status)?.count ?? 0,
      value: byStatus.get(status)?.value ?? 0,
    }));
    return ok(res, { pipeline });
  }),
);

/* ── Detail ───────────────────────────────────────────────────── */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const lead = findLead(session, String(req.params.id));

    const followUps = queryAll<Record<string, unknown>>(
      'SELECT * FROM follow_ups WHERE lead_id = ? ORDER BY due_at ASC',
      [lead.id],
    ).map(mapFollowUp);

    const client = lead.clientId
      ? queryOne<Record<string, unknown>>('SELECT id, business_name FROM clients WHERE id = ?', [lead.clientId])
      : null;

    return ok(res, {
      lead,
      followUps,
      client: client ? { id: String(client.id), businessName: String(client.business_name) } : null,
    });
  }),
);

/* ── Create ───────────────────────────────────────────────────── */
router.post(
  '/',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const input = parseBody(leadCreateSchema, req.body);

    if (session.role === 'client') {
      // A client can only create leads attributed to their own business.
      if (input.clientId && input.clientId !== session.clientId) throw notFound('Client not found.');
      input.clientId = session.clientId ?? null;
    } else if (input.clientId) {
      assertCanAccessClient(session, input.clientId);
    }

    if (input.email) {
      const duplicate = queryOne<{ id: string }>(
        "SELECT id FROM leads WHERE email = ? AND created_at > datetime('now', '-1 day')",
        [input.email],
      );
      if (duplicate) throw conflict('A lead with that email was created in the last 24 hours.');
    }

    const id = newId('ld');
    const now = nowIso();
    const qualification = qualifyLead({
      message: input.message ?? '',
      source: input.source,
      businessName: input.businessName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
    });

    db.prepare(
      `INSERT INTO leads (id, client_id, contact_name, business_name, email, phone, source, status, score, value, message, intent, next_action, owner_id, ai_summary, ai_qualification, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      id,
      input.clientId ?? null,
      input.contactName,
      input.businessName || null,
      input.email || null,
      input.phone || null,
      input.source,
      input.status,
      qualification.score,
      input.value ?? null,
      input.message || null,
      qualification.intent,
      input.nextAction || 'Review and respond',
      session.userId,
      qualification.summary,
      qualification.qualification,
      now,
      now,
    );

    recordActivity({
      type: 'lead.created',
      label: 'Lead created',
      detail: input.businessName || input.contactName,
      actor: session.name,
      actorRole: session.role,
      entityType: 'lead',
      entityId: id,
      clientId: input.clientId ?? null,
    });

    if (!isAdmin(session)) {
      notifyAdmins({
        kind: 'lead',
        title: 'New lead created',
        body: `${input.contactName}${input.businessName ? ` · ${input.businessName}` : ''}`,
        href: `/app/leads/${id}`,
        entityType: 'lead',
        entityId: id,
      });
    }

    return ok(res, { lead: findLead({ ...session, role: 'admin' } as Session, id) }, 201);
  }),
);

/* ── Update (incl. Kanban status moves) ───────────────────────── */
router.patch(
  '/:id',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const lead = findLead(session, String(req.params.id));
    const input = parseBody(leadUpdateSchema, req.body);

    const columnMap: Record<string, string> = {
      contactName: 'contact_name',
      businessName: 'business_name',
      email: 'email',
      phone: 'phone',
      source: 'source',
      status: 'status',
      score: 'score',
      value: 'value',
      message: 'message',
      intent: 'intent',
      nextAction: 'next_action',
      clientId: 'client_id',
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    for (const [key, column] of Object.entries(columnMap)) {
      const value = (input as Record<string, unknown>)[key];
      if (value !== undefined) {
        if (key === 'clientId' && value) assertCanAccessClient(session, String(value));
        updates.push(`${column} = ?`);
        params.push(value === '' ? null : value);
      }
    }

    if (updates.length) {
      params.push(nowIso(), lead.id);
      db.prepare(`UPDATE leads SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...(params as never[]));
    }

    if (input.status && input.status !== lead.status) {
      recordActivity({
        type: 'lead.status_changed',
        label: `Lead moved to ${input.status}`,
        detail: lead.businessName || lead.contactName,
        actor: session.name,
        actorRole: session.role,
        entityType: 'lead',
        entityId: lead.id,
        clientId: lead.clientId,
      });
    }

    return ok(res, { lead: findLead(session, lead.id) });
  }),
);

/* ── Delete (admin only, destructive → audited) ───────────────── */
router.delete(
  '/:id',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const lead = queryOne<Record<string, unknown>>('SELECT * FROM leads WHERE id = ?', [id]);
    if (!lead) throw notFound('That lead does not exist.');

    db.prepare('DELETE FROM leads WHERE id = ?').run(id);

    recordActivity({
      type: 'lead.deleted',
      label: 'Lead deleted',
      detail: String(lead.contact_name ?? ''),
      actor: session.name,
      actorRole: session.role,
      entityType: 'lead',
      entityId: id,
    });

    return ok(res, { deleted: true });
  }),
);

/* ── AI qualification (real computation, not a fake label) ────── */
router.post(
  '/:id/qualify',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const lead = findLead(session, String(req.params.id));

    const result = qualifyLead({
      message: lead.message ?? '',
      source: lead.source,
      businessName: lead.businessName,
      email: lead.email,
      phone: lead.phone,
    });

    db.prepare('UPDATE leads SET score = ?, intent = ?, ai_summary = ?, ai_qualification = ?, updated_at = ? WHERE id = ?').run(
      result.score,
      result.intent,
      result.summary,
      result.qualification,
      nowIso(),
      lead.id,
    );

    recordActivity({
      type: 'lead.qualified',
      label: 'AI qualified lead',
      detail: `${lead.contactName} · score ${result.score}`,
      actor: 'NorthForge AI',
      actorRole: 'system',
      entityType: 'lead',
      entityId: lead.id,
      clientId: lead.clientId,
    });

    return ok(res, { lead: findLead(session, lead.id), qualification: result });
  }),
);

/* ── Follow-ups for a lead ────────────────────────────────────── */
router.post(
  '/:id/follow-ups',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const lead = findLead(session, String(req.params.id));
    const title = String(req.body?.title ?? '').trim();
    const dueAt = String(req.body?.dueAt ?? '');
    const channel = String(req.body?.channel ?? 'call');

    if (title.length < 2) throw conflict('Give the follow-up a title.');
    if (!dueAt) throw conflict('Choose a due date.');

    const id = newId('fu');
    db.prepare(
      `INSERT INTO follow_ups (id, lead_id, client_id, title, due_at, channel, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(id, lead.id, lead.clientId, title, dueAt, ['call', 'whatsapp', 'email', 'meeting'].includes(channel) ? channel : 'call', nowIso());

    return ok(res, { followUp: queryOne<Record<string, unknown>>('SELECT * FROM follow_ups WHERE id = ?', [id]) }, 201);
  }),
);

export default router;
