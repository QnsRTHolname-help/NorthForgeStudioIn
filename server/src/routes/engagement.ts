import { Router } from 'express';
import { db, newId, nowIso, queryAll, queryOne } from '../db';
import { assertCanAccessClient, clientScope, isAdmin, requireAuth, requireCsrf } from '../auth';
import { asyncHandler, badRequest, notFound, ok } from '../lib/http';
import {
  parseBody,
  bookingCreateSchema,
  requestCreateSchema,
  ticketCreateSchema,
  requestStatuses,
  ticketStatuses,
} from '../lib/validate';
import { mapBooking, mapRequest, mapTicket } from '../mappers';
import { recordActivity } from '../services/activity';
import { notifyAdmins, notifyClientMembers } from '../services/notify';
import type { ActivityEntry, TicketMessage } from '@shared/types';

const router = Router();
router.use(requireAuth);

/* ═══════════════════════════════════════════════════════════════
   BOOKINGS / APPOINTMENTS
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const upcoming = req.query.upcoming === 'true';
    const extra = upcoming ? ' AND starts_at >= ?' : '';
    const rows = queryAll<Record<string, unknown>>(
      `SELECT * FROM bookings WHERE 1=1${clause}${extra} ORDER BY starts_at ASC`,
      upcoming ? [...params, new Date().toISOString()] : params,
    );
    return ok(res, { items: rows.map(mapBooking) });
  }),
);

router.post(
  '/bookings',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const input = parseBody(bookingCreateSchema, req.body);

    const clientId =
      session.role === 'client' ? session.clientId : String(req.body?.clientId ?? '');
    if (!clientId) throw badRequest('No business is linked to this account.');
    if (session.role !== 'client') assertCanAccessClient(session, clientId);

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw badRequest('Choose a valid date and time.');

    const id = newId('bk');
    db.prepare(
      `INSERT INTO bookings (id, client_id, customer_name, customer_phone, email, service, starts_at, duration_mins, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    ).run(
      id,
      clientId,
      input.customerName,
      input.customerPhone || null,
      input.email || null,
      input.service || null,
      startsAt.toISOString(),
      input.durationMins,
      input.notes || null,
      nowIso(),
    );

    recordActivity({
      type: 'booking.created',
      label: 'Appointment booked',
      detail: `${input.customerName} · ${startsAt.toISOString().slice(0, 10)}`,
      actor: session.name,
      actorRole: session.role,
      entityType: 'booking',
      entityId: id,
      clientId,
    });

    notifyClientMembers(clientId, {
      kind: 'message',
      title: 'New appointment',
      body: `${input.customerName} booked ${startsAt.toLocaleDateString('en-IN')}.`,
      href: '/portal/bookings',
      entityType: 'booking',
      entityId: id,
    });

    return ok(res, { booking: queryOne('SELECT * FROM bookings WHERE id = ?', [id]) }, 201);
  }),
);

router.patch(
  '/bookings/:id',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const { clause, params } = clientScope(session);
    const row = queryOne<Record<string, unknown>>(`SELECT * FROM bookings WHERE id = ?${clause}`, [id, ...params]);
    if (!row) throw notFound('That appointment does not exist.');

    const status = String(req.body?.status ?? '');
    if (status && !['pending', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(status)) {
      throw badRequest('Invalid appointment status.');
    }
    // Clients may cancel; confirming/completing is a team action.
    if (status && !isAdmin(session) && status !== 'cancelled') {
      throw badRequest('You can cancel an appointment. Contact NorthForge to reschedule.');
    }

    const updates: string[] = [];
    const args: unknown[] = [];
    if (status) {
      updates.push('status = ?');
      args.push(status);
    }
    if (req.body?.startsAt) {
      updates.push('starts_at = ?');
      args.push(new Date(String(req.body.startsAt)).toISOString());
    }
    if (req.body?.notes !== undefined) {
      updates.push('notes = ?');
      args.push(String(req.body.notes).slice(0, 1000));
    }
    if (updates.length) {
      args.push(id);
      db.prepare(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`).run(...(args as never[]));
    }

    recordActivity({
      type: 'booking.updated',
      label: status ? `Appointment ${status}` : 'Appointment updated',
      detail: String(row.customer_name),
      actor: session.name,
      actorRole: session.role,
      entityType: 'booking',
      entityId: id,
      clientId: row.client_id ? String(row.client_id) : null,
    });

    return ok(res, { booking: queryOne('SELECT * FROM bookings WHERE id = ?', [id]) });
  }),
);

/* ═══════════════════════════════════════════════════════════════
   CLIENT REQUESTS (change requests, issues, automation asks)
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const rows = queryAll<Record<string, unknown>>(
      `SELECT * FROM client_requests WHERE 1=1${clause} ORDER BY created_at DESC`,
      params,
    );
    return ok(res, { items: rows.map(mapRequest) });
  }),
);

router.post(
  '/requests',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const input = parseBody(requestCreateSchema, req.body);

    const clientId = session.role === 'client' ? session.clientId : String(req.body?.clientId ?? '');
    if (!clientId) throw badRequest('No business is linked to this account.');
    if (session.role !== 'client') assertCanAccessClient(session, clientId);

    const id = newId('rq');
    const now = nowIso();
    const activity: ActivityEntry[] = [
      { id: newId('ae'), label: 'Request created', detail: null, actor: session.name, createdAt: now },
    ];

    db.prepare(
      `INSERT INTO client_requests (id, client_id, title, description, type, priority, status, attachments, activity, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', '[]', ?, 0, ?, ?)`,
    ).run(id, clientId, input.title, input.description, input.type, input.priority, JSON.stringify(activity), now, now);

    recordActivity({
      type: 'request.created',
      label: 'New client request',
      detail: input.title,
      actor: session.name,
      actorRole: session.role,
      entityType: 'request',
      entityId: id,
      clientId,
    });

    notifyAdmins({
      kind: 'request',
      title: 'New client request',
      body: input.title,
      href: '/app/requests',
      entityType: 'request',
      entityId: id,
    });

    return ok(res, { request: queryOne('SELECT * FROM client_requests WHERE id = ?', [id]) }, 201);
  }),
);

router.patch(
  '/requests/:id',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const { clause, params } = clientScope(session);
    const row = queryOne<Record<string, unknown>>(`SELECT * FROM client_requests WHERE id = ?${clause}`, [id, ...params]);
    if (!row) throw notFound('That request does not exist.');

    const updates: string[] = [];
    const args: unknown[] = [];

    const status = String(req.body?.status ?? '');
    if (status) {
      if (!requestStatuses.includes(status as (typeof requestStatuses)[number])) throw badRequest('Invalid status.');
      if (!isAdmin(session) && status !== 'closed') throw badRequest('Only the NorthForge team can change request status.');
      updates.push('status = ?');
      args.push(status);
    }
    if (typeof req.body?.priority === 'string' && isAdmin(session)) {
      updates.push('priority = ?');
      args.push(req.body.priority);
    }
    if (typeof req.body?.title === 'string' && req.body.title.trim().length > 2 && !isAdmin(session)) {
      updates.push('title = ?');
      args.push(req.body.title.trim());
    }

    const activity = JSON.parse(String(row.activity ?? '[]')) as ActivityEntry[];
    if (status) {
      activity.push({
        id: newId('ae'),
        label: `Status changed to ${status.replace('_', ' ')}`,
        detail: null,
        actor: session.name,
        createdAt: nowIso(),
      });
    }
    if (typeof req.body?.comment === 'string' && req.body.comment.trim().length) {
      activity.push({
        id: newId('ae'),
        label: 'Comment added',
        detail: req.body.comment.trim().slice(0, 1000),
        actor: session.name,
        createdAt: nowIso(),
      });
    }

    updates.push('activity = ?', 'updated_at = ?');
    args.push(JSON.stringify(activity), nowIso());
    args.push(id);

    db.prepare(`UPDATE client_requests SET ${updates.join(', ')} WHERE id = ?`).run(...(args as never[]));

    recordActivity({
      type: 'request.updated',
      label: status ? `Request ${status.replace('_', ' ')}` : 'Request updated',
      detail: String(row.title),
      actor: session.name,
      actorRole: session.role,
      entityType: 'request',
      entityId: id,
      clientId: row.client_id ? String(row.client_id) : null,
    });

    return ok(res, { request: queryOne('SELECT * FROM client_requests WHERE id = ?', [id]) });
  }),
);

/* ═══════════════════════════════════════════════════════════════
   SUPPORT TICKETS
   ═══════════════════════════════════════════════════════════════ */

router.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const rows = queryAll<Record<string, unknown>>(
      `SELECT * FROM tickets WHERE 1=1${clause} ORDER BY updated_at DESC`,
      params,
    );
    return ok(res, { items: rows.map(mapTicket) });
  }),
);

router.get(
  '/tickets/:id',
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const { clause, params } = clientScope(session);
    const row = queryOne<Record<string, unknown>>(`SELECT * FROM tickets WHERE id = ?${clause}`, [
      String(req.params.id),
      ...params,
    ]);
    if (!row) throw notFound('That ticket does not exist.');
    const ticket = mapTicket(row);
    // Internal notes never reach a client (spec §70, §83).
    return ok(res, {
      ticket: isAdmin(session) ? ticket : { ...ticket, messages: ticket.messages.filter((m) => !m.internal) },
    });
  }),
);

router.post(
  '/tickets',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const input = parseBody(ticketCreateSchema, req.body);
    const clientId = session.role === 'client' ? session.clientId : String(req.body?.clientId ?? null);

    const id = newId('tc');
    const now = nowIso();
    const message: TicketMessage = {
      id: newId('tm'),
      author: session.name,
      authorRole: isAdmin(session) ? 'admin' : 'client',
      body: input.message,
      internal: false,
      createdAt: now,
    };

    db.prepare(
      `INSERT INTO tickets (id, client_id, subject, status, priority, category, messages, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?, 0, ?, ?)`,
    ).run(id, clientId, input.subject, input.priority, input.category || null, JSON.stringify([message]), now, now);

    recordActivity({
      type: 'ticket.created',
      label: 'Support ticket opened',
      detail: input.subject,
      actor: session.name,
      actorRole: session.role,
      entityType: 'ticket',
      entityId: id,
      clientId,
    });

    if (clientId) {
      notifyAdmins({ kind: 'request', title: 'New support ticket', body: input.subject, href: '/app/support', entityType: 'ticket', entityId: id });
    }

    return ok(res, { ticket: queryOne('SELECT * FROM tickets WHERE id = ?', [id]) }, 201);
  }),
);

router.post(
  '/tickets/:id/messages',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const session = req.auth!;
    const id = String(req.params.id);
    const { clause, params } = clientScope(session);
    const row = queryOne<Record<string, unknown>>(`SELECT * FROM tickets WHERE id = ?${clause}`, [id, ...params]);
    if (!row) throw notFound('That ticket does not exist.');

    const body = String(req.body?.body ?? '').trim();
    if (body.length < 2) throw badRequest('Write a message.');

    const internal = isAdmin(session) && req.body?.internal === true;
    const messages = JSON.parse(String(row.messages ?? '[]')) as TicketMessage[];
    messages.push({
      id: newId('tm'),
      author: session.name,
      authorRole: isAdmin(session) ? 'admin' : 'client',
      body,
      internal,
      createdAt: nowIso(),
    });

    const status = req.body?.status && isAdmin(session) ? String(req.body.status) : String(row.status);
    if (status && !ticketStatuses.includes(status as (typeof ticketStatuses)[number])) throw badRequest('Invalid status.');

    db.prepare('UPDATE tickets SET messages = ?, status = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(messages),
      status,
      nowIso(),
      id,
    );

    return ok(res, { ticket: queryOne('SELECT * FROM tickets WHERE id = ?', [id]) });
  }),
);

export default router;
