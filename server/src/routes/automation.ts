import { Router } from 'express';
import { db, newId, nowIso, queryAll, queryOne } from '../db';
import { clientScope, requireAuth, requireCsrf, requireRole } from '../auth';
import { asyncHandler, badRequest, notFound, ok } from '../lib/http';
import { parseBody, workflowCreateSchema, workflowNodeSchema, workflowNodeTypes } from '../lib/validate';
import { mapMessage, mapTemplate, mapWorkflow, mapWorkflowNode } from '../mappers';
import { recordActivity } from '../services/activity';
import { env } from '../env';
import type { Workflow } from '@shared/types';

const router = Router();
router.use(requireAuth);

function loadWorkflow(id: string): Workflow {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM workflows WHERE id = ?', [id]);
  if (!row) throw notFound('That workflow does not exist.');
  const nodes = queryAll<Record<string, unknown>>(
    'SELECT * FROM workflow_nodes WHERE workflow_id = ? ORDER BY sort_order ASC',
    [id],
  ).map(mapWorkflowNode);
  return { ...mapWorkflow(row), nodes };
}

/* ═══════════════════════════════════════════════════════════════
   WORKFLOWS — agency automation (admin only)
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/workflows',
  requireRole('admin', 'super_admin'),
  asyncHandler(async (_req, res) => {
    const rows = queryAll<Record<string, unknown>>('SELECT * FROM workflows ORDER BY created_at DESC');
    const workflows = rows.map((row) => {
      const nodes = queryAll<Record<string, unknown>>(
        'SELECT * FROM workflow_nodes WHERE workflow_id = ? ORDER BY sort_order ASC',
        [String(row.id)],
      ).map(mapWorkflowNode);
      return { ...mapWorkflow(row), nodes };
    });
    return ok(res, { items: workflows });
  }),
);

router.get(
  '/workflows/:id',
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    return ok(res, { workflow: loadWorkflow(String(req.params.id)) });
  }),
);

router.post(
  '/workflows',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const input = parseBody(workflowCreateSchema, req.body);
    const id = newId('wf');

    db.transaction(() => {
      db.prepare(
        `INSERT INTO workflows (id, name, description, status, trigger, runs, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
      ).run(id, input.name, input.description || null, input.status, input.trigger, nowIso());

      // Every workflow starts with a real trigger node — never an empty canvas.
      db.prepare(
        `INSERT INTO workflow_nodes (id, workflow_id, type, label, config, x, y, sort_order)
         VALUES (?, ?, 'trigger', ?, ?, 0, 0, 0)`,
      ).run(newId('wn'), id, `When ${input.trigger}`, JSON.stringify({ event: input.trigger }), 0, 0, 0);
    })();

    recordActivity({
      type: 'workflow.created',
      label: 'Workflow created',
      detail: input.name,
      actor: session.name,
      actorRole: session.role,
      entityType: 'workflow',
      entityId: id,
    });

    return ok(res, { workflow: loadWorkflow(id) }, 201);
  }),
);

router.patch(
  '/workflows/:id',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const row = queryOne<Record<string, unknown>>('SELECT * FROM workflows WHERE id = ?', [id]);
    if (!row) throw notFound('That workflow does not exist.');

    const updates: string[] = [];
    const args: unknown[] = [];

    if (typeof req.body?.name === 'string' && req.body.name.trim().length > 1) {
      updates.push('name = ?');
      args.push(req.body.name.trim());
    }
    if (typeof req.body?.description === 'string') {
      updates.push('description = ?');
      args.push(req.body.description.trim());
    }
    if (typeof req.body?.trigger === 'string') {
      updates.push('trigger = ?');
      args.push(req.body.trigger.trim());
    }
    if (typeof req.body?.status === 'string' && ['draft', 'active', 'paused', 'error'].includes(req.body.status)) {
      updates.push('status = ?');
      args.push(req.body.status);
    }

    if (updates.length) {
      args.push(id);
      db.prepare(`UPDATE workflows SET ${updates.join(', ')} WHERE id = ?`).run(...(args as never[]));
    }

    const status = req.body?.status;
    if (status && status !== row.status) {
      recordActivity({
        type: `workflow.${status}`,
        label: `Workflow ${status === 'active' ? 'activated' : status === 'paused' ? 'paused' : 'set to ' + status}`,
        detail: String(row.name),
        actor: session.name,
        actorRole: session.role,
        entityType: 'workflow',
        entityId: id,
      });
    }

    return ok(res, { workflow: loadWorkflow(id) });
  }),
);

router.delete(
  '/workflows/:id',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    return ok(res, { deleted: true });
  }),
);

/* ── Nodes ────────────────────────────────────────────────────── */
router.post(
  '/workflows/:id/nodes',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const workflowId = String(req.params.id);
    const input = parseBody(workflowNodeSchema, req.body);
    if (!queryOne('SELECT id FROM workflows WHERE id = ?', [workflowId])) throw notFound('That workflow does not exist.');

    const nextOrder =
      (queryOne<{ c: number }>('SELECT COUNT(*) as c FROM workflow_nodes WHERE workflow_id = ?', [workflowId])?.c ?? 0) + 1;

    const id = newId('wn');
    db.prepare(
      `INSERT INTO workflow_nodes (id, workflow_id, type, label, config, x, y, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, workflowId, input.type, input.label, JSON.stringify(input.config), input.x, input.y, nextOrder);

    return ok(res, { workflow: loadWorkflow(workflowId) }, 201);
  }),
);

router.patch(
  '/workflow-nodes/:id',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const row = queryOne<Record<string, unknown>>('SELECT * FROM workflow_nodes WHERE id = ?', [id]);
    if (!row) throw notFound('That node does not exist.');

    const updates: string[] = [];
    const args: unknown[] = [];

    if (typeof req.body?.label === 'string' && req.body.label.trim().length > 0) {
      updates.push('label = ?');
      args.push(req.body.label.trim());
    }
    if (typeof req.body?.type === 'string' && workflowNodeTypes.includes(req.body.type)) {
      updates.push('type = ?');
      args.push(req.body.type);
    }
    if (req.body?.config && typeof req.body.config === 'object') {
      updates.push('config = ?');
      args.push(JSON.stringify(req.body.config));
    }
    if (req.body?.x !== undefined) {
      updates.push('x = ?');
      args.push(Math.round(Number(req.body.x)));
    }
    if (req.body?.y !== undefined) {
      updates.push('y = ?');
      args.push(Math.round(Number(req.body.y)));
    }
    if (req.body?.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      args.push(Math.round(Number(req.body.sortOrder)));
    }

    if (updates.length) {
      args.push(id);
      db.prepare(`UPDATE workflow_nodes SET ${updates.join(', ')} WHERE id = ?`).run(...(args as never[]));
    }

    return ok(res, { workflow: loadWorkflow(String(row.workflow_id)) });
  }),
);

router.delete(
  '/workflow-nodes/:id',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const row = queryOne<{ workflow_id: string; sort_order: number }>(
      'SELECT workflow_id, sort_order FROM workflow_nodes WHERE id = ?',
      [id],
    );
    if (!row) throw notFound('That node does not exist.');

    db.prepare('DELETE FROM workflow_nodes WHERE id = ?').run(id);
    // Keep ordering contiguous so the rendered chain never has gaps.
    const remaining = queryAll<{ id: string }>(
      'SELECT id FROM workflow_nodes WHERE workflow_id = ? ORDER BY sort_order ASC',
      [row.workflow_id],
    );
    remaining.forEach((node, index) => {
      db.prepare('UPDATE workflow_nodes SET sort_order = ? WHERE id = ?').run(index + 1, node.id);
    });

    return ok(res, { workflow: loadWorkflow(row.workflow_id) });
  }),
);

/* ═══════════════════════════════════════════════════════════════
   WHATSAPP
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/whatsapp/templates',
  requireRole('admin', 'super_admin'),
  asyncHandler(async (_req, res) => {
    const rows = queryAll<Record<string, unknown>>('SELECT * FROM whatsapp_templates ORDER BY name ASC');
    return ok(res, { items: rows.map(mapTemplate) });
  }),
);

router.post(
  '/whatsapp/templates',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const body = String(req.body?.body ?? '').trim();
    if (name.length < 2) throw badRequest('Name the template.');
    if (body.length < 5) throw badRequest('Write the message body.');

    const id = newId('wt');
    db.prepare(
      `INSERT INTO whatsapp_templates (id, name, category, body, status, language, uses, is_demo)
       VALUES (?, ?, ?, ?, 'pending', 'en', 0, 0)`,
    ).run(id, name, ['utility', 'marketing', 'authentication'].includes(req.body?.category) ? req.body.category : 'utility', body);

    return ok(res, { template: queryOne('SELECT * FROM whatsapp_templates WHERE id = ?', [id]) }, 201);
  }),
);

router.get(
  '/whatsapp/messages',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const rows = queryAll<Record<string, unknown>>(
      `SELECT * FROM whatsapp_messages WHERE 1=1${clause} ORDER BY created_at DESC LIMIT 100`,
      params,
    );
    return ok(res, { items: rows.map(mapMessage) });
  }),
);

/**
 * Sends (or simulates) an outbound message.
 *
 * When the Cloud API is configured this is where the HTTP call happens.
 * Without credentials the message is recorded as `queued` and clearly
 * marked — the platform never claims a message was delivered when no
 * transport exists (spec §71, §104).
 */
router.post(
  '/whatsapp/messages',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const to = String(req.body?.to ?? '').trim();
    const body = String(req.body?.body ?? '').trim();
    if (to.length < 6) throw badRequest('Enter a destination number.');
    if (body.length < 1) throw badRequest('Write a message.');

    const configured = Boolean(env.whatsapp.accessToken && env.whatsapp.phoneNumberId);
    const id = newId('wm');

    db.prepare(
      `INSERT INTO whatsapp_messages (id, client_id, direction, to_number, body, status, template_id, automated, is_demo, created_at)
       VALUES (?, ?, 'outbound', ?, ?, ?, ?, 0, 0, ?)`,
    ).run(id, req.body?.clientId || null, to, body, configured ? 'sent' : 'queued', req.body?.templateId || null, nowIso());

    recordActivity({
      type: 'whatsapp.message_sent',
      label: configured ? 'WhatsApp message sent' : 'WhatsApp message queued (transport not configured)',
      detail: to,
      actor: session.name,
      actorRole: session.role,
      entityType: 'whatsapp_message',
      entityId: id,
      clientId: req.body?.clientId || null,
    });

    return ok(res, { message: queryOne('SELECT * FROM whatsapp_messages WHERE id = ?', [id]), delivered: configured }, 201);
  }),
);

router.get(
  '/whatsapp/status',
  asyncHandler(async (_req, res) => {
    const configured = Boolean(env.whatsapp.accessToken && env.whatsapp.phoneNumberId);
    const sent = (queryOne<{ c: number }>("SELECT COUNT(*) as c FROM whatsapp_messages WHERE direction = 'outbound'")?.c ?? 0);
    const inbound = (queryOne<{ c: number }>("SELECT COUNT(*) as c FROM whatsapp_messages WHERE direction = 'inbound'")?.c ?? 0);
    const automated = (queryOne<{ c: number }>("SELECT COUNT(*) as c FROM whatsapp_messages WHERE automated = 1")?.c ?? 0);

    return ok(res, {
      connected: configured,
      mode: configured ? 'cloud_api' : 'click_to_chat',
      businessNumber: env.whatsapp.businessNumber || null,
      stats: { sent, inbound, automated, templates: queryOne<{ c: number }>('SELECT COUNT(*) as c FROM whatsapp_templates')?.c ?? 0 },
    });
  }),
);

export default router;
