import { db, newId, nowIso, queryAll, queryOne, toBool } from '../db';
import type { NotificationKind, NotificationRecord } from '@shared/types';

interface NotifyInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

export function notify(input: NotifyInput) {
  db.prepare(
    `INSERT INTO notifications (id, user_id, kind, title, body, href, entity_type, entity_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId('nt'),
    input.userId,
    input.kind,
    input.title,
    input.body ?? null,
    input.href ?? null,
    input.entityType ?? null,
    input.entityId ?? null,
    nowIso(),
  );
}

/** Fans a notification out to every admin account. */
export function notifyAdmins(input: Omit<NotifyInput, 'userId'>) {
  const admins = queryAll<{ id: string }>("SELECT id FROM users WHERE role IN ('admin','super_admin')");
  for (const admin of admins) notify({ ...input, userId: admin.id });
  return admins.length;
}

export function notifyClientMembers(clientId: string, input: Omit<NotifyInput, 'userId'>) {
  const users = queryAll<{ id: string }>('SELECT id FROM users WHERE client_id = ?', [clientId]);
  for (const user of users) notify({ ...input, userId: user.id });
  return users.length;
}

export function listNotifications(userId: string, limit = 50) {
  const rows = queryAll<Record<string, unknown>>(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit],
  );
  return rows.map(mapNotification);
}

export function unreadCount(userId: string) {
  const row = queryOne<{ c: number }>('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0', [userId]);
  return row?.c ?? 0;
}

export function mapNotification(row: Record<string, unknown>): NotificationRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kind: String(row.kind) as NotificationKind,
    title: String(row.title),
    body: row.body ? String(row.body) : null,
    read: toBool(row.read),
    href: row.href ? String(row.href) : null,
    entityType: row.entity_type ? String(row.entity_type) : null,
    entityId: row.entity_id ? String(row.entity_id) : null,
    createdAt: String(row.created_at),
  };
}
