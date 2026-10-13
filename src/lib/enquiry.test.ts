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
      } as any);

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
      } as any);

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
      } as any);

      const insertSpy = vi.fn().mockResolvedValueOnce({ data: null, error: null });
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: insertSpy,
      } as any);

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
      } as any);

      const insertSpy = vi.fn().mockResolvedValueOnce({ data: null, error: null });
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: insertSpy,
      } as any);

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
      } as any);

      await expect(contactService.submit(validForm)).rejects.toThrowError(
        expect.objectContaining({
          code: 'network',
          status: 0,
        }),
      );
    });
  });
});
