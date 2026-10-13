import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleEnquiryRelayRequest } from './enquiryRelay';

interface MockResponse extends ServerResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function createMockReqRes(method: string, bodyObj?: unknown): { req: IncomingMessage & { body?: unknown }; res: MockResponse } {
  const req = {
    method,
    body: bodyObj,
    [Symbol.asyncIterator]: async function* () {
      if (bodyObj !== undefined) {
        yield Buffer.from(JSON.stringify(bodyObj));
      }
    },
  } as unknown as IncomingMessage & { body?: unknown };

  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(key: string, val: string) {
      this.headers[key.toLowerCase()] = val;
    },
    end(data?: string) {
      if (data) this.body = data;
    },
  } as MockResponse;

  return { req, res };
}

describe('shared/enquiryRelay', () => {
  const fakeEnv = {
    supabaseUrl: 'https://mock.supabase.co',
    secretKey: 'mock_secret_key',
  };

  it('rejects short or missing name with 400', async () => {
    const { req, res } = createMockReqRes('POST', { name: 'A', email: 'valid@example.com' });
    await handleEnquiryRelayRequest(req, res, fakeEnv);
    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(res.body);
    expect(parsed.error.message).toBe('Enter your name.');
  });

  it('rejects invalid email with 400', async () => {
    const { req, res } = createMockReqRes('POST', { name: 'Valid Name', email: 'invalid-email' });
    await handleEnquiryRelayRequest(req, res, fakeEnv);
    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(res.body);
    expect(parsed.error.message).toBe('Enter a valid email address.');
  });

  it('returns 503 if relay env is missing', async () => {
    const { req, res } = createMockReqRes('POST', { name: 'Valid Name', email: 'valid@example.com' });
    await handleEnquiryRelayRequest(req, res, { supabaseUrl: '', secretKey: '' });
    expect(res.statusCode).toBe(503);
    const parsed = JSON.parse(res.body);
    expect(parsed.error.code).toBe('service_unavailable');
  });

  it('enforces 1/minute rate limit based on epoch timestamps', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/rest/v1/enquiries?select=')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              email: 'throttled@example.com',
              created_at: new Date(Date.now() - 30 * 1000).toISOString(),
            },
          ],
        } as Response;
      }
      return { ok: true, status: 200, json: async () => [] } as Response;
    });

    try {
      const { req, res } = createMockReqRes('POST', {
        name: 'Throttled User',
        email: 'throttled@example.com',
      });
      await handleEnquiryRelayRequest(req, res, fakeEnv);
      expect(res.statusCode).toBe(429);
      const parsed = JSON.parse(res.body);
      expect(parsed.error.message).toBe('Please wait a moment before sending another enquiry.');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('folds plan into message and retries if Postgres returns 42703/plan column missing', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/rest/v1/enquiries?select=')) {
        return { ok: true, status: 200, json: async () => [] } as Response;
      }
      if (urlStr.endsWith('/rest/v1/enquiries')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        calls.push({ url: urlStr, body });
        // First POST with plan key fails with 42703
        if (body.plan !== undefined) {
          return {
            ok: false,
            status: 400,
            text: async () => 'column "plan" of relation "enquiries" does not exist',
          } as Response;
        }
        // Second POST without plan key succeeds
        return {
          ok: true,
          status: 201,
          json: async () => [{ id: 'eq_retried1234' }],
        } as Response;
      }
      return { ok: true, status: 200, json: async () => [] } as Response;
    });

    try {
      const { req, res } = createMockReqRes('POST', {
        name: 'Plan Enquirer',
        email: 'plan@example.com',
        plan: 'AUTOPILOT',
        message: 'Need help automating CRM',
      });
      await handleEnquiryRelayRequest(req, res, fakeEnv);
      expect(res.statusCode).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.reference).toBe('eq_retried1234');
      expect(calls.length).toBe(2);
      expect(calls[0].body.plan).toBe('AUTOPILOT');
      expect(calls[1].body.plan).toBeUndefined();
      expect(calls[1].body.message).toContain('Plan of interest: AUTOPILOT');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('handles OPTIONS preflight by returning 204', async () => {
    const { req, res } = createMockReqRes('OPTIONS');
    await handleEnquiryRelayRequest(req, res, fakeEnv);
    expect(res.statusCode).toBe(204);
  });
});
