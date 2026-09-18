import { describe, expect, it } from 'vitest';
import {
  groupThreads,
  normalizeWhatsAppNumber,
  prettyWhatsAppNumber,
  threadStatus,
  waLink,
} from './whatsapp';
import type { WhatsAppMessage } from '@/types';

function message(overrides: Partial<WhatsAppMessage>): WhatsAppMessage {
  return {
    id: 'wm_test',
    clientId: null,
    direction: 'outbound',
    to: '919845012345',
    body: 'Hello',
    status: 'sent',
    templateId: null,
    automated: false,
    createdAt: '2026-01-01T10:00:00.000Z',
    isDemo: false,
    ...overrides,
  };
}

describe('normalizeWhatsAppNumber', () => {
  it('normalises every reasonable human input to WhatsApp digits', () => {
    expect(normalizeWhatsAppNumber('+91 98450 12345')).toBe('919845012345');
    expect(normalizeWhatsAppNumber('98450 12345')).toBe('919845012345');
    expect(normalizeWhatsAppNumber('09845012345')).toBe('919845012345');
    expect(normalizeWhatsAppNumber('919845012345')).toBe('919845012345');
    expect(normalizeWhatsAppNumber('+1 (415) 555-0100')).toBe('14155550100');
    expect(normalizeWhatsAppNumber('9845012345')).toBe('919845012345');
    expect(normalizeWhatsAppNumber('80 4123 4567')).toBe('918041234567'); // landline
  });

  it('rejects numbers that cannot be reached on WhatsApp', () => {
    expect(normalizeWhatsAppNumber('')).toBeNull();
    expect(normalizeWhatsAppNumber(null)).toBeNull();
    expect(normalizeWhatsAppNumber('not-a-number')).toBeNull();
    expect(normalizeWhatsAppNumber('123')).toBeNull();
    expect(normalizeWhatsAppNumber('09845012345678901234')).toBeNull();
  });
});

describe('prettyWhatsAppNumber', () => {
  it('formats Indian numbers in the national style', () => {
    expect(prettyWhatsAppNumber('919845012345')).toBe('+91 98450 12345');
  });

  it('falls back to plain international form', () => {
    expect(prettyWhatsAppNumber('14155550100')).toBe('+14155550100');
    expect(prettyWhatsAppNumber(null)).toBe('—');
  });
});

describe('waLink', () => {
  it('builds a wa.me deep link with encoded text', () => {
    const link = waLink('+91 98450 12345', 'Hi — prices?');
    expect(link).toBe('https://wa.me/919845012345?text=Hi%20%E2%80%94%20prices%3F');
  });

  it('returns null for an unreachable number', () => {
    expect(waLink('12', 'hi')).toBeNull();
  });
});

describe('groupThreads', () => {
  it('groups by partner number, newest thread first, chat oldest-first', () => {
    const threads = groupThreads([
      message({ id: 'a', to: '919845012345', createdAt: '2026-01-01T10:00:00Z' }),
      message({ id: 'b', to: '+91 98450 12345', createdAt: '2026-01-02T10:00:00Z' }),
      message({ id: 'c', to: '919812345678', direction: 'inbound', createdAt: '2026-01-03T10:00:00Z' }),
    ]);

    expect(threads).toHaveLength(2);
    expect(threads[0].key).toBe('919812345678'); // newest activity first
    expect(threads[1].messages.map((m) => m.id)).toEqual(['a', 'b']); // oldest first
    expect(threads[1].partner).toBe('+91 98450 12345');
  });

  it('keeps the client link and remembers the last message', () => {
    const threads = groupThreads([
      message({ id: 'a', clientId: 'cl_1', createdAt: '2026-01-01T10:00:00Z' }),
      message({ id: 'b', clientId: 'cl_1', direction: 'inbound', body: 'ok thanks', createdAt: '2026-01-02T10:00:00Z' }),
    ]);
    expect(threads[0].clientId).toBe('cl_1');
    expect(threads[0].lastBody).toBe('ok thanks');
    expect(threads[0].lastDirection).toBe('inbound');
  });

  it('drops messages with an unusable number rather than crashing', () => {
    const threads = groupThreads([message({ to: '' }), message({ to: '919845012345' })]);
    expect(threads).toHaveLength(1);
  });
});

describe('threadStatus', () => {
  it('reports the newest outbound status, ignoring inbound messages', () => {
    const thread = groupThreads([
      message({ id: 'a', status: 'delivered', createdAt: '2026-01-01T10:00:00Z' }),
      message({ id: 'b', status: 'read', createdAt: '2026-01-01T11:00:00Z' }),
      message({ id: 'c', direction: 'inbound', status: 'read', createdAt: '2026-01-01T12:00:00Z' }),
    ])[0];
    expect(threadStatus(thread)).toBe('read');
  });

  it('returns null for a thread with no outbound messages', () => {
    const thread = groupThreads([message({ direction: 'inbound' })])[0];
    expect(threadStatus(thread)).toBeNull();
  });
});
