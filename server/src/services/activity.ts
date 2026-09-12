import { db, newId, nowIso, queryAll, toBool } from '../db';
import type { ActivityRecord } from '@shared/types';
import type { Session } from '../auth';

interface ActivityInput {
  type: string;
  label: string;
  detail?: string | null;
  actor?: string;
  actorRole?: Session['role'] | 'system';
  entityType?: string | null;
  entityId?: string | null;
  clientId?: string | null;
  isDemo?: boolean;
}

/**
 * Single writer for the activity log. Every state-changing route calls this
 * so the admin activity feed and client "what happened" feed stay truthful
 * (spec §69 — real activity records only, never synthesised).
 */
export function recordActivity(input: ActivityInput) {
  db.prepare(
    `INSERT INTO activity (id, type, label, detail, actor, actor_role, entity_type, entity_id, client_id, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId('av'),
    input.type,
    input.label,
    input.detail ?? null,
    input.actor ?? 'System',
    input.actorRole ?? 'system',
    input.entityType ?? null,
    input.entityId ?? null,
    input.clientId ?? null,
    input.isDemo ? 1 : 0,
    nowIso(),
  );
}

export function listActivity(session: Session, limit = 40, clientId?: string | null) {
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (session.role === 'client') {
    where += ' AND client_id = ?';
    params.push(session.clientId ?? '__none__');
  } else if (clientId) {
    where += ' AND client_id = ?';
    params.push(clientId);
  }

  const rows = queryAll<Record<string, unknown>>(
    `SELECT * FROM activity ${where} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit],
  );

  return rows.map(mapActivity);
}

export function mapActivity(row: Record<string, unknown>): ActivityRecord {
  return {
    id: String(row.id),
    type: String(row.type),
    label: String(row.label),
    detail: row.detail ? String(row.detail) : null,
    actor: String(row.actor ?? 'System'),
    actorRole: (row.actor_role as ActivityRecord['actorRole']) ?? 'system',
    entityType: row.entity_type ? String(row.entity_type) : null,
    entityId: row.entity_id ? String(row.entity_id) : null,
    clientId: row.client_id ? String(row.client_id) : null,
    createdAt: String(row.created_at),
    isDemo: toBool(row.is_demo),
  };
}
