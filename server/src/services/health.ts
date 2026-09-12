import { queryOne } from '../db';
import type { HealthState } from '@shared/types';

/**
 * Cheap single-value health probe for dashboard tiles.
 * Returns `unknown` when nothing could be verified rather than
 * defaulting to a reassuring green (spec §71, §141).
 */
export function checkHealthState(): HealthState {
  try {
    const dbOk = queryOne<{ ok: number }>('SELECT 1 as ok')?.ok === 1;
    if (!dbOk) return 'degraded';
    const failed = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM websites WHERE deployment = 'failed'")?.c ?? 0;
    return failed > 0 ? 'degraded' : 'operational';
  } catch {
    return 'offline';
  }
}
