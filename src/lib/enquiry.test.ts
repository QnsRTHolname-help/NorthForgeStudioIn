import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isHoneypotFilled, mapEnquiryPayload, normalizeEnquiryPhone } from '@/lib/enquiry';
import { contactService } from '@/services/public';
import { supabase } from '@/lib/supabase';

/**
 * Regression & Integration tests for the contact form's insert payload,
 * input validation, and RPC fallback error handling.
 */

const reference = 'eq_0123456789ab';

describe('enquiry payload mapping', () => {
  it('keeps the phone number the contact form actually collects', () => {
    const payload = mapEnquiryPayload(
      { name: 'Asha', email: 'asha@clinic.in', phone: '98450 12345' },
      reference,
    );
    expect(payload.whatsapp).toBe('919845012345');
  });

  it('still accepts a caller that sends `whatsapp`', () => {
    const payload = mapEnquiryPayload({ name: 'x', email: 'x@y.in', whatsapp: '+91 98450 12345' }, reference);
    expect(payload.whatsapp).toBe('919845012345');
  });

  it('keeps an unparseable number instead of discarding it', () => {
    expect(normalizeEnquiryPhone('call the clinic')).toBe('call the clinic');
    expect(mapEnquiryPayload({ phone: '  123  ' }, reference).whatsapp).toBe('123');
  });

  it('keeps the "slowest process" answer in the bottleneck column', () => {
    const payload = mapEnquiryPayload(
      { name: 'x', email: 'x@y.in', slowestProcess: 'copying enquiries into a register' },
      reference,
    );
    expect(payload.bottleneck).toBe('copying enquiries into a register');
  });

  it('trims values and maps absent fields to null, never to the string "undefined"', () => {
    const payload = mapEnquiryPayload({ name: '  Asha  ', email: 'asha@clinic.in' }, reference);
    expect(payload.name).toBe('Asha');
    expect(payload.business_name).toBeNull();
    expect(payload.whatsapp).toBeNull();
    expect(payload.bottleneck).toBeNull();
    expect(payload.message).toBeNull();
  });

  it('carries the visitor-facing reference as the row id', () => {
    expect(mapEnquiryPayload({}, reference).id).toBe(reference);
  });

  it('treats a filled honeypot as a bot and an empty one as a person', () => {
    expect(isHoneypotFilled({ website: 'http://spam.example' })).toBe(true);
    expect(isHoneypotFilled({ website: '  ' })).toBe(false);
    expect(isHoneypotFilled({})).toBe(false);
  });

  it('correctly maps business details and qualification fields', () => {
    const payload = mapEnquiryPayload(
      {
        name: 'John Doe',
        businessName: 'Acme Interiors',
        email: 'john@acme.com',
        phone: '9876543210',
        businessType: 'Interior Design',
        currentTools: 'Excel, WhatsApp',
        slowestProcess: 'Invoice tracking',
        monthlyEnquiries: '50 – 150',
        message: 'Looking for lead qualification automation',
      },
      reference,
    );
    expect(payload.business_name).toBe('Acme Interiors');
    expect(payload.business_type).toBe('Interior Design');
    expect(payload.current_tools).toBe('Excel, WhatsApp');
    expect(payload.bottleneck).toBe('Invoice tracking');
    expect(payload.monthly_enquiries).toBe('50 – 150');
    expect(payload.message).toBe('Looking for lead qualification automation');
  });
});

describe('contactService validation & RPC fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validForm = {
    name: 'Priya Sharma',
    businessName: 'Sharma Architecture',
    email: 'priya@sharma.in',
    phone: '9876543210',
    businessType: 'Architecture',
    message: 'Need CRM workflow',
  };

  describe('input validation', () => {
    it('rejects missing or short name', async () => {
      await expect(contactService.submit({ ...validForm, name: ' ' })).rejects.toThrowError(
        expect.objectContaining({
          message: 'Enter your name.',
          code: 'validation',
          status: 400,
        }),
      );
    });

    it('rejects missing or short business name', async () => {
      await expect(contactService.submit({ ...validForm, businessName: 'A' })).rejects.toThrowError(
        expect.objectContaining({
          message: 'Enter your business name.',
          code: 'validation',
          status: 400,
        }),
      );
    });

    it('rejects invalid email addresses', async () => {
      await expect(contactService.submit({ ...validForm, email: 'not-an-email' })).rejects.toThrowError(
        expect.objectContaining({
          message: 'Enter a valid email address.',
          code: 'validation',
          status: 400,
        }),
      );
    });

    it('rejects phone numbers with insufficient digits', async () => {
      await expect(contactService.submit({ ...validForm, phone: '123' })).rejects.toThrowError(
        expect.objectContaining({
          message: 'Enter a reachable phone or WhatsApp number.',
          code: 'validation',
          status: 400,
        }),
      );
    });

    it('rejects missing business type', async () => {
      await expect(contactService.submit({ ...validForm, businessType: '' })).rejects.toThrowError(
        expect.objectContaining({
          message: 'Select a business type.',
          code: 'validation',
          status: 400,
        }),
      );
    });

    it('silently ignores spam bots when honeypot is populated', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc');
      const result = await contactService.submit({
        ...validForm,
        website: 'http://spambot.example.com',
      });
      expect(result).toEqual({ received: true, reference: null });
      expect(rpcSpy).not.toHaveBeenCalled();
    });
  });

  describe('RPC invocation and fallback handling', () => {
    it('successfully submits via app_submit_enquiry RPC', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: 'eq_mocked12345',
        error: null,
      } as never);

      const result = await contactService.submit(validForm);
      expect(result.received).toBe(true);
      expect(result.reference).toBe('eq_mocked12345');
    });

    it('surfaces RPC rate-limiting error with 429 status', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: 'P0001',
          message: 'RATE_LIMITED',
          hint: 'We already have this enquiry — we will be in touch.',
        },
      } as never);

      await expect(contactService.submit(validForm)).rejects.toThrowError(
        expect.objectContaining({
          message: 'We already have this enquiry — we will be in touch.',
          status: 429,
          code: 'validation',
        }),
      );
    });

    it('gracefully falls back to direct table insert on PGRST202 function missing', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function app_submit_enquiry in the schema cache',
        },
      } as never);

      const insertSpy = vi.fn().mockResolvedValueOnce({ data: null, error: null });
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: insertSpy,
      } as never);

      const result = await contactService.submit(validForm);
      expect(result.received).toBe(true);
      expect(result.reference).toMatch(/^eq_[0-9a-f]{12}$/);
      expect(insertSpy).toHaveBeenCalled();
    });

    it('gracefully falls back to direct table insert on 42883 undefined function', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: '42883',
          message: 'function app_submit_enquiry does not exist',
        },
      } as never);

      const insertSpy = vi.fn().mockResolvedValueOnce({ data: null, error: null });
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: insertSpy,
      } as never);

      const result = await contactService.submit(validForm);
      expect(result.received).toBe(true);
      expect(result.reference).toMatch(/^eq_[0-9a-f]{12}$/);
      expect(insertSpy).toHaveBeenCalled();
    });

    it('maps network transport errors properly without crashing', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          message: 'FetchError: Failed to fetch',
          code: '',
          status: 0,
        },
      } as never);

      await expect(contactService.submit(validForm)).rejects.toThrowError(
        expect.objectContaining({
          code: 'network',
          status: 0,
        }),
      );
    });

    it('recovers via /api/enquiries relay when RPC fails with 42883 gen_random_bytes and table insert is 42501 denied', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: '42883',
          message: 'function gen_random_bytes(integer) does not exist',
        },
      } as never);

      const insertSpy = vi.fn().mockResolvedValueOnce({
        data: null,
        error: {
          code: '42501',
          message: 'permission denied for table enquiries',
        },
      });
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: insertSpy,
      } as never);

      const g = globalThis as Record<string, unknown>;
      const origWindow = g.window;
      g.window = { location: { origin: 'http://localhost:5173' } };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ received: true, reference: 'eq_relayed12345' }),
      } as never);

      try {
        const result = await contactService.submit(validForm);
        expect(result.received).toBe(true);
        expect(result.reference).toBe('eq_relayed12345');
        expect(fetchSpy).toHaveBeenCalledWith(
          'http://localhost:5173/api/enquiries',
          expect.objectContaining({ method: 'POST' }),
        );
      } finally {
        g.window = origWindow;
      }
    });

    it('surfaces 429 rate-limit error returned by /api/enquiries relay', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: '42883',
          message: 'function gen_random_bytes(integer) does not exist',
        },
      } as never);

      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: '42501', message: 'permission denied for table enquiries' },
        }),
      } as never);

      const g = globalThis as Record<string, unknown>;
      const origWindow = g.window;
      g.window = { location: { origin: 'http://localhost:5173' } };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { code: 'validation', message: 'Please wait a moment before sending another enquiry.' },
        }),
      } as never);

      try {
        await expect(contactService.submit(validForm)).rejects.toThrowError(
          expect.objectContaining({
            message: 'Please wait a moment before sending another enquiry.',
            status: 429,
            code: 'validation',
          }),
        );
      } finally {
        g.window = origWindow;
      }
    });

    it('never throws "Something went wrong. Please try again." when live RPC hits 42883 gen_random_bytes and relay is unavailable', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: '42883',
          message: 'function gen_random_bytes(integer) does not exist',
        },
      } as never);

      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: '42501', message: 'permission denied for table enquiries' },
        }),
      } as never);

      const result = await contactService.submit(validForm);
      expect(result.received).toBe(true);
      expect(result.reference).toMatch(/^eq_[0-9a-f]{12}$/);
    });

    it('folds plan into message when direct table insert fails with 42703/PGRST204 missing plan column', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function app_submit_enquiry in the schema cache',
        },
      } as never);

      const insertSpy = vi
        .fn()
        // First attempt with plan column fails with 42703
        .mockResolvedValueOnce({
          data: null,
          error: { code: '42703', message: 'column "plan" of relation "enquiries" does not exist' },
        })
        // Second attempt with plan folded into message succeeds
        .mockResolvedValueOnce({ data: null, error: null });

      vi.spyOn(supabase, 'from').mockReturnValue({
        insert: insertSpy,
      } as never);

      const result = await contactService.submit({ ...validForm, plan: 'CONVERT' });
      expect(result.received).toBe(true);
      expect(insertSpy).toHaveBeenCalledTimes(2);
      expect(insertSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Plan of interest: CONVERT'),
        }),
      );
      // Confirms plan property was omitted on retry
      expect(insertSpy.mock.calls[1][0]).not.toHaveProperty('plan');
    });

    it('enforces 429 rate limit on client-side queue fallback when repeated within 60s', async () => {
      const g = globalThis as Record<string, unknown>;
      const origWindow = g.window;
      const fakeStorage = new Map<string, string>();
      const existing = [
        {
          id: 'eq_prev12345678',
          name: 'Jane Doe',
          email: 'jane@example.com',
          created_at: new Date().toISOString(),
        },
      ];
      fakeStorage.set('nf.pending_enquiries', JSON.stringify(existing));

      g.window = {
        localStorage: {
          getItem: (key: string) => fakeStorage.get(key) ?? null,
          setItem: (key: string, val: string) => fakeStorage.set(key, val),
        },
        sessionStorage: {
          getItem: (key: string) => fakeStorage.get(key) ?? null,
          setItem: (key: string, val: string) => fakeStorage.set(key, val),
        },
      };

      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: '42883',
          message: 'function gen_random_bytes(integer) does not exist',
        },
      } as never);

      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: '42501', message: 'permission denied for table enquiries' },
        }),
      } as never);

      try {
        await expect(
          contactService.submit({ ...validForm, email: 'jane@example.com' }),
        ).rejects.toThrowError(
          expect.objectContaining({
            status: 429,
            message: 'Please wait a moment before sending another enquiry.',
          }),
        );
      } finally {
        g.window = origWindow;
      }
    });

    it('enforces 429 rate limit on client-side queue fallback when 3+ enquiries sent in 1 hour', async () => {
      const g = globalThis as Record<string, unknown>;
      const origWindow = g.window;
      const fakeStorage = new Map<string, string>();
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const existing = [
        { id: 'eq_1', email: 'repeat@example.com', created_at: thirtyMinsAgo },
        { id: 'eq_2', email: 'repeat@example.com', created_at: thirtyMinsAgo },
        { id: 'eq_3', email: 'repeat@example.com', created_at: thirtyMinsAgo },
      ];
      fakeStorage.set('nf.pending_enquiries', JSON.stringify(existing));

      g.window = {
        localStorage: {
          getItem: (key: string) => fakeStorage.get(key) ?? null,
          setItem: (key: string, val: string) => fakeStorage.set(key, val),
        },
        sessionStorage: {
          getItem: (key: string) => fakeStorage.get(key) ?? null,
          setItem: (key: string, val: string) => fakeStorage.set(key, val),
        },
      };

      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: '42883',
          message: 'function gen_random_bytes(integer) does not exist',
        },
      } as never);

      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: '42501', message: 'permission denied for table enquiries' },
        }),
      } as never);

      try {
        await expect(
          contactService.submit({ ...validForm, email: 'repeat@example.com' }),
        ).rejects.toThrowError(
          expect.objectContaining({
            status: 429,
            message: 'We already have this enquiry — we will be in touch.',
          }),
        );
      } finally {
        g.window = origWindow;
      }
    });
  });
});

