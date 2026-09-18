import { describe, expect, it } from 'vitest';
import { isHoneypotFilled, mapEnquiryPayload, normalizeEnquiryPhone } from '@/lib/enquiry';

/**
 * Regression tests for the contact form's insert payload.
 *
 * These exist because the phone number and the "slowest process" answer were
 * being dropped between the form and the database — silently, on the single
 * path that brings new business in.
 */

const reference = 'eq_0123456789ab';

describe('enquiry payload', () => {
  it('keeps the phone number the contact form actually collects', () => {
    const payload = mapEnquiryPayload(
      { name: 'Asha', email: 'asha@clinic.in', phone: '98450 12345' },
      reference,
    );
    // Normalised to international digits so the WhatsApp button on the lead
    // works, but never dropped.
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
});
