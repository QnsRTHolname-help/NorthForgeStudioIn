import { Router } from 'express';
import { db, newId, nowIso, queryAll, queryOne } from '../db';
import { assertCanAccessClient, clientScope, isAdmin, requireAuth, requireCsrf, requireRole } from '../auth';
import { asyncHandler, badRequest, notFound, ok } from '../lib/http';
import { parseBody, taskCreateSchema, projectCreateSchema, taskStatuses, projectStages } from '../lib/validate';
import { mapAnalytics, mapProject, mapTask, mapWebsite } from '../mappers';
import { recordActivity } from '../services/activity';
import type { TaskStatus, ProjectStage } from '@shared/types';

const router = Router();
router.use(requireAuth);

/* ═══════════════════════════════════════════════════════════════
   PROJECTS
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/projects',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const rows = queryAll<Record<string, unknown>>(
      `SELECT * FROM projects WHERE 1=1${clause} ORDER BY updated_at DESC`,
      params,
    );
    return ok(res, { items: rows.map(mapProject) });
  }),
);

router.post(
  '/projects',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const input = parseBody(projectCreateSchema, req.body);
    const id = newId('pj');
    const now = nowIso();

    db.prepare(
      `INSERT INTO projects (id, client_id, name, stage, status, progress, start_date, due_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, date('now'), ?, ?, ?, ?)`,
    ).run(id, input.clientId, input.name, input.stage, input.status, input.dueDate || null, input.notes || null, now, now);

    recordActivity({
      type: 'project.created',
      label: 'Project created',
      detail: input.name,
      actor: session.name,
      actorRole: session.role,
      entityType: 'project',
      entityId: id,
      clientId: input.clientId,
    });

    return ok(res, { project: queryOne<Record<string, unknown>>('SELECT * FROM projects WHERE id = ?', [id]) }, 201);
  }),
);

router.patch(
  '/projects/:id',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const { clause, params } = clientScope(session);
    const row = queryOne<Record<string, unknown>>(`SELECT * FROM projects WHERE id = ?${clause}`, [id, ...params]);
    if (!row) throw notFound('That project does not exist.');

    const updates: string[] = [];
    const args: unknown[] = [];

    const name = req.body?.name;
    if (typeof name === 'string' && name.trim().length > 1 && isAdmin(session)) {
      updates.push('name = ?');
      args.push(name.trim());
    }

    const stage = req.body?.stage;
    if (typeof stage === 'string' && projectStages.includes(stage as ProjectStage) && isAdmin(session)) {
      updates.push('stage = ?');
      args.push(stage);
    }

    const status = req.body?.status;
    if (typeof status === 'string' && isAdmin(session)) {
      updates.push('status = ?');
      args.push(status);
    }

    const progress = req.body?.progress;
    if (progress !== undefined && isAdmin(session)) {
      const p = Math.max(0, Math.min(100, Math.round(Number(progress))));
      updates.push('progress = ?');
      args.push(p);
    }

    const dueDate = req.body?.dueDate;
    if (dueDate !== undefined && isAdmin(session)) {
      updates.push('due_date = ?');
      args.push(dueDate || null);
    }

    const notes = req.body?.notes;
    if (typeof notes === 'string' && isAdmin(session)) {
      updates.push('notes = ?');
      args.push(notes.trim());
    }

    // Clients can submit project feedback, which is recorded as activity.
    const feedback = req.body?.feedback;
    if (typeof feedback === 'string' && feedback.trim().length > 1) {
      recordActivity({
        type: 'project.feedback',
        label: 'Client feedback on project',
        detail: feedback.trim().slice(0, 400),
        actor: session.name,
        actorRole: session.role,
        entityType: 'project',
        entityId: id,
        clientId: row.client_id ? String(row.client_id) : null,
      });
    }

    if (updates.length) {
      args.push(nowIso(), id);
      db.prepare(`UPDATE projects SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...(args as never[]));
    }

    const updated = queryOne<Record<string, unknown>>('SELECT * FROM projects WHERE id = ?', [id]);
    return ok(res, { project: updated ? mapProject(updated) : null });
  }),
);

/* ═══════════════════════════════════════════════════════════════
   TASKS
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/tasks',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const status = String(req.query.status ?? '').trim();
    const extra = status && taskStatuses.includes(status as TaskStatus) ? ' AND status = ?' : '';
    const rows = queryAll<Record<string, unknown>>(
      `SELECT * FROM tasks WHERE 1=1${clause}${extra} ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, due_date IS NULL, due_date ASC`,
      status && taskStatuses.includes(status as TaskStatus) ? [...params, status] : params,
    );
    return ok(res, { items: rows.map(mapTask) });
  }),
);

router.post(
  '/tasks',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const input = parseBody(taskCreateSchema, req.body);
    if (input.clientId) assertCanAccessClient(session, input.clientId);

    const id = newId('tk');
    const now = nowIso();
    db.prepare(
      `INSERT INTO tasks (id, title, description, status, priority, project_id, client_id, assignee_id, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.title,
      input.description || null,
      input.status,
      input.priority,
      input.projectId || null,
      input.clientId || null,
      session.userId,
      input.dueDate || null,
      now,
      now,
    );

    recordActivity({
      type: 'task.created',
      label: 'Task created',
      detail: input.title,
      actor: session.name,
      actorRole: session.role,
      entityType: 'task',
      entityId: id,
      clientId: input.clientId ?? null,
    });

    return ok(res, { task: queryOne<Record<string, unknown>>('SELECT * FROM tasks WHERE id = ?', [id]) }, 201);
  }),
);

router.patch(
  '/tasks/:id',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const row = queryOne<Record<string, unknown>>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!row) throw notFound('That task does not exist.');

    const updates: string[] = [];
    const args: unknown[] = [];
    const columnMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      status: 'status',
      priority: 'priority',
      projectId: 'project_id',
      clientId: 'client_id',
      dueDate: 'due_date',
    };

    for (const [key, column] of Object.entries(columnMap)) {
      const value = req.body?.[key];
      if (value !== undefined) {
        updates.push(`${column} = ?`);
        args.push(value === '' ? null : value);
      }
    }

    if (updates.length) {
      args.push(nowIso(), id);
      db.prepare(`UPDATE tasks SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...(args as never[]));
    }

    if (req.body?.status && req.body.status !== row.status) {
      recordActivity({
        type: 'task.status_changed',
        label: `Task moved to ${String(req.body.status).replace('_', ' ')}`,
        detail: String(row.title),
        actor: session.name,
        actorRole: session.role,
        entityType: 'task',
        entityId: id,
        clientId: row.client_id ? String(row.client_id) : null,
      });
    }

    return ok(res, { task: queryOne<Record<string, unknown>>('SELECT * FROM tasks WHERE id = ?', [id]) });
  }),
);

router.delete(
  '/tasks/:id',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(String(req.params.id));
    return ok(res, { deleted: true });
  }),
);

/* ═══════════════════════════════════════════════════════════════
   WEBSITES
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/websites',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const rows = queryAll<Record<string, unknown>>(`SELECT * FROM websites WHERE 1=1${clause} ORDER BY created_at DESC`, params);
    return ok(res, { items: rows.map(mapWebsite) });
  }),
);

router.get(
  '/websites/:id',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const { clause, params } = clientScope(session);
    const row = queryOne<Record<string, unknown>>(`SELECT * FROM websites WHERE id = ?${clause}`, [id, ...params]);
    if (!row) throw notFound('That website does not exist.');

    const analytics = queryAll<Record<string, unknown>>(
      'SELECT * FROM website_analytics WHERE website_id = ? ORDER BY date DESC LIMIT 90',
      [id],
    ).map(mapAnalytics);

    const client = queryOne<Record<string, unknown>>('SELECT id, business_name FROM clients WHERE id = ?', [row.client_id]);

    return ok(res, {
      website: mapWebsite(row),
      analytics,
      client: client ? { id: String(client.id), businessName: String(client.business_name) } : null,
    });
  }),
);

router.post(
  '/websites',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const clientId = String(req.body?.clientId ?? '');
    const name = String(req.body?.name ?? '').trim();
    if (!clientId) throw badRequest('Choose a client.');
    if (name.length < 2) throw badRequest('Name the website.');

    const id = newId('wb');
    db.prepare(
      `INSERT INTO websites (id, client_id, name, domain, url, status, deployment, ssl, hosting, framework, created_at)
       VALUES (?, ?, ?, ?, ?, 'building', 'pending', 0, 'NorthForge Edge', 'React + Vite', ?)`,
    ).run(id, clientId, name, req.body?.domain || null, req.body?.url || null, nowIso());

    recordActivity({
      type: 'website.created',
      label: 'Website provisioned',
      detail: name,
      actor: session.name,
      actorRole: session.role,
      entityType: 'website',
      entityId: id,
      clientId,
    });

    return ok(res, { website: queryOne<Record<string, unknown>>('SELECT * FROM websites WHERE id = ?', [id]) }, 201);
  }),
);

router.patch(
  '/websites/:id',
  requireRole('admin', 'super_admin'),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const row = queryOne<Record<string, unknown>>('SELECT * FROM websites WHERE id = ?', [id]);
    if (!row) throw notFound('That website does not exist.');

    const updates: string[] = [];
    const args: unknown[] = [];
    const columnMap: Record<string, string> = {
      name: 'name',
      domain: 'domain',
      url: 'url',
      status: 'status',
      deployment: 'deployment',
      hosting: 'hosting',
      framework: 'framework',
    };
    for (const [key, column] of Object.entries(columnMap)) {
      const value = req.body?.[key];
      if (value !== undefined) {
        updates.push(`${column} = ?`);
        args.push(value === '' ? null : value);
      }
    }
    if (req.body?.ssl !== undefined) {
      updates.push('ssl = ?');
      args.push(req.body.ssl ? 1 : 0);
    }
    if (req.body?.maintenance !== undefined) {
      updates.push('maintenance = ?');
      args.push(req.body.maintenance ? 1 : 0);
    }
    if (req.body?.status === 'live') {
      updates.push('last_deployed_at = ?');
      args.push(nowIso());
    }
    updates.push('last_updated_at = ?');
    args.push(nowIso());

    args.push(id);
    db.prepare(`UPDATE websites SET ${updates.join(', ')} WHERE id = ?`).run(...(args as never[]));

    const session = req.auth!;
    recordActivity({
      type: 'website.updated',
      label: 'Website updated',
      detail: String(row.name),
      actor: session.name,
      actorRole: session.role,
      entityType: 'website',
      entityId: id,
      clientId: row.client_id ? String(row.client_id) : null,
    });

    return ok(res, { website: queryOne<Record<string, unknown>>('SELECT * FROM websites WHERE id = ?', [id]) });
  }),
);

/* ═══════════════════════════════════════════════════════════════
   CALENDAR — bookings, task deadlines, project milestones
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/calendar',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const from = String(req.query.from ?? '');
    const to = String(req.query.to ?? '');
    const { clause, params } = clientScope(session);

    const bookings = queryAll<Record<string, unknown>>(
      `SELECT * FROM bookings WHERE 1=1${clause} ORDER BY starts_at ASC`,
      params,
    );
    const tasks = queryAll<Record<string, unknown>>(
      `SELECT * FROM tasks WHERE due_date IS NOT NULL${clause} ORDER BY due_date ASC`,
      params,
    );
    const projects = queryAll<Record<string, unknown>>(
      `SELECT * FROM projects WHERE due_date IS NOT NULL${clause} ORDER BY due_date ASC`,
      params,
    );

    const events = [
      ...bookings.map((b) => ({
        id: String(b.id),
        kind: 'booking' as const,
        title: String(b.customer_name),
        detail: b.service ? String(b.service) : 'Appointment',
        date: String(b.starts_at),
        status: String(b.status),
        href: '/app/bookings',
      })),
      ...tasks.map((t) => ({
        id: String(t.id),
        kind: 'task' as const,
        title: String(t.title),
        detail: 'Task due',
        date: `${String(t.due_date)}T18:00:00.000Z`,
        status: String(t.status),
        href: '/app/tasks',
      })),
      ...projects.map((p) => ({
        id: String(p.id),
        kind: 'deadline' as const,
        title: String(p.name),
        detail: 'Project deadline',
        date: `${String(p.due_date)}T18:00:00.000Z`,
        status: String(p.status),
        href: '/app/projects',
      })),
    ]
      .filter((e) => {
        if (!from || !to) return true;
        return e.date >= from && e.date <= to;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return ok(res, { events });
  }),
);

export default router;
