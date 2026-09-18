import type { WhatsAppMessage } from '@/types';

/**
 * WhatsApp number + conversation helpers.
 *
 * Kept pure (no React, no database) so the inbox logic is unit-testable and
 * every surface — the admin inbox, the lead page, the client page — formats
 * numbers identically.
 */

/**
 * Normalise any human-typed number into plain WhatsApp digits.
 *
 * Accepts `+91 98450 12345`, `09845012345`, `98450 12345`, `(984) 501-2345`…
 * Indian numbers typed without a country code get `91` prefixed. Returns
 * `null` when what remains cannot be a WhatsApp number (too short, not
 * digits) — callers must treat `null` as "ask the user again", never send.
 */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // 00 is the international dial-out prefix, not part of the number.
  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.length === 10) {
    // A bare 10-digit number is an Indian mobile/landline typed without the
    // country code — NorthForge operates in India, so prefix it.
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // Landline-style national number: drop the trunk 0 and assume India.
    digits = `91${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // Already includes the country code.
  }

  // WhatsApp requires 8–15 digits with no leading zero (E.164 without +).
  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null;
  return digits;
}

/** Human display form: `+91 98450 12345` for Indian numbers, else `+…`. */
export function prettyWhatsAppNumber(digits: string | null | undefined): string {
  if (!digits) return '—';
  const d = digits.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) {
    return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  }
  return `+${d}`;
}

/**
 * A wa.me deep link that opens the business WhatsApp with the text
 * pre-typed. This is the always-working delivery path: it needs no Meta
 * approval, no token and no webhook — it hands the message to the operator's
 * own WhatsApp, from which it is genuinely sent.
 */
export function waLink(to: string | null | undefined, text: string): string | null {
  const digits = normalizeWhatsAppNumber(to);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export interface WhatsAppThread {
  /** Normalised partner digits — stable thread key. */
  key: string;
  /** Pretty number for display. */
  partner: string;
  /** The linked client, when every message in the thread shares one. */
  clientId: string | null;
  messages: WhatsAppMessage[];
  lastAt: string;
  lastDirection: WhatsAppMessage['direction'];
  lastBody: string;
}

/** Partner number for a message: the other side of the conversation. */
function partnerOf(message: WhatsAppMessage): string | null {
  return normalizeWhatsAppNumber(message.to);
}

/**
 * Group a flat message feed into conversations, newest thread first and
 * oldest-message-first inside each thread (so the chat renders top-down).
 */
export function groupThreads(messages: WhatsAppMessage[]): WhatsAppThread[] {
  const map = new Map<string, WhatsAppThread>();

  for (const message of messages) {
    const key = partnerOf(message);
    if (!key) continue;
    let thread = map.get(key);
    if (!thread) {
      thread = {
        key,
        partner: prettyWhatsAppNumber(key),
        clientId: message.clientId ?? null,
        messages: [],
        lastAt: message.createdAt,
        lastDirection: message.direction,
        lastBody: message.body,
      };
      map.set(key, thread);
    }
    thread.clientId ??= message.clientId ?? null;
    thread.messages.push(message);
    if (message.createdAt > thread.lastAt) {
      thread.lastAt = message.createdAt;
      thread.lastDirection = message.direction;
      thread.lastBody = message.body;
    }
  }

  for (const thread of map.values()) {
    thread.messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** The newest status across a thread's outbound messages, for the thread list. */
export function threadStatus(thread: WhatsAppThread): WhatsAppMessage['status'] | null {
  for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
    const message = thread.messages[i];
    if (message.direction === 'outbound') return message.status;
  }
  return null;
}
