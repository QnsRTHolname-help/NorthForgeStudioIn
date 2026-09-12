import { describe, expect, it } from 'vitest';
import { mapDatabaseError } from './db';
import { ApiError } from '@/types';

/**
 * Regression tests for the login "We couldn't reach the database" bug.
 *
 * PostgREST errors never carry a `status` property, and real Postgres
 * errors ALWAYS have a non-empty `code` (PGRST… or SQLSTATE). The mapper
 * must classify by shape, not by a status field that does not exist —
 * otherwise every real database failure masquerades as a network outage.
 */
describe('mapDatabaseError', () => {
  it('treats a real PostgREST error as a schema problem, not a network problem', () => {
    const error = mapDatabaseError(
      { code: 'PGRST205', message: "Could not find the table 'public.profiles' in the schema cache", details: null, hint: null },
      'test',
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('schema_missing');
    expect(error.status).toBe(503);
    expect(error.message).toMatch(/not set up yet/i);
  });

  it('maps undefined_table to the actionable schema message', () => {
    const error = mapDatabaseError({ code: '42P01', message: 'relation "public.profiles" does not exist' }, 'test');
    expect(error.code).toBe('schema_missing');
  });

  it('maps RLS denial to a permission error, not a network error', () => {
    const error = mapDatabaseError({ code: '42501', message: 'new row violates row-level security policy' }, 'test');
    expect(error.code).toBe('permission_denied');
    expect(error.status).toBe(403);
  });

  it('maps unique violations to a duplicate error', () => {
    const error = mapDatabaseError({ code: '23505', message: 'duplicate key value' }, 'test');
    expect(error.code).toBe('duplicate');
    expect(error.status).toBe(409);
  });

  it('maps foreign key violations to a constraint error', () => {
    const error = mapDatabaseError({ code: '23503', message: 'insert or update on table violates foreign key constraint' }, 'test');
    expect(error.code).toBe('constraint');
  });

  it('classifies genuine transport failures as network errors', () => {
    const error = mapDatabaseError({ code: '', message: 'TypeError: Failed to fetch' }, 'test');
    expect(error.code).toBe('network');
    expect(error.status).toBe(0);
  });

  it('classifies FetchError as a transport failure', () => {
    const error = mapDatabaseError({ code: '', message: 'FetchError: request to http://… failed' }, 'test');
    expect(error.code).toBe('network');
  });

  it('maps other PGRST errors to a service-unavailable error', () => {
    const error = mapDatabaseError({ code: 'PGRST301', message: 'JWT expired' }, 'test');
    expect(error.code).toBe('service_unavailable');
  });

  it('passes 5xx statuses through as server errors', () => {
    const error = mapDatabaseError({ code: '', message: 'boom', status: 503 }, 'test');
    expect(error.code).toBe('server_error');
  });

  it('never leaks raw error text into user-facing messages', () => {
    const raw = 'password=hunter2 internal detail';
    const error = mapDatabaseError({ code: 'XX999', message: raw }, 'test');
    expect(error.message).not.toContain('hunter2');
  });

  it('returns ApiError instances untouched', () => {
    const original = new ApiError('already mapped', 400, 'error');
    expect(mapDatabaseError(original, 'test')).toBe(original);
  });
});
