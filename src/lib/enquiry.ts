/**
 * Enquiry intake (public contact form).
 *
 * The form and the database disagreed about field names, so two answers were
 * collected and then thrown away before insert:
 *
 *   form field        service read         database column   result
 *   `phone`      →    `whatsapp`      →    `whatsapp`        always NULL
 *   `slowestProcess` → `bottleneck`   →    `bottleneck`      always NULL
 *
 * The phone number is REQUIRED by the form's own validation and is the
 * channel NorthForge actually replies on, so every enquiry raised through
 * the website arrived with no way to contact the business.
 *
 * The mapping is a pure function with a test precisely so a future name
 * change fails a test instead of silently losing a customer's number.
 */

import { normalizeWhatsAppNumber } from '@/lib/whatsapp';

export interface EnquiryInsert {
  id: string;
  name: string;
  business_name: string | null;
  email: string;
  whatsapp: string | null;
  business_type: string | null;
  current_tools: string | null;
  bottleneck: string | null;
  monthly_enquiries: string | null;
  message: string | null;
}

/** First present, non-empty string among the given keys. */
function pick(input: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

/**
 * Store the phone number the way every other surface reads it: international
 * digits, so the admin WhatsApp button on the lead page works immediately.
 * Anything unparseable is kept verbatim rather than discarded — a human can
 * still read a number we could not normalise.
 */
export function normalizeEnquiryPhone(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  return normalizeWhatsAppNumber(value) ?? value;
}

/**
 * The hidden field a person never sees and a naive bot fills in. Checked
 * here (the only place we control — this form writes straight to the
 * database) rather than not at all, which was the previous behaviour: the
 * field was submitted and ignored.
 */
export function isHoneypotFilled(input: Record<string, unknown>): boolean {
  const trap = input.website;
  return typeof trap === 'string' && trap.trim() !== '';
}

/** Build the exact row to insert, including the visitor-facing reference. */
export function mapEnquiryPayload(input: Record<string, unknown>, reference: string): EnquiryInsert {
  return {
    id: reference,
    name: pick(input, 'name') ?? '',
    business_name: pick(input, 'businessName', 'business_name'),
    email: pick(input, 'email') ?? '',
    // Accepts either spelling, so the form's `phone` and any older caller's
    // `whatsapp` both land in the column that exists.
    whatsapp: normalizeEnquiryPhone(pick(input, 'phone', 'whatsapp')),
    business_type: pick(input, 'businessType', 'business_type'),
    current_tools: pick(input, 'currentTools', 'current_tools'),
    // The form asks "What process takes the most time?" and calls it
    // `slowestProcess`; the column is `bottleneck`. Both are accepted.
    bottleneck: pick(input, 'slowestProcess', 'bottleneck'),
    monthly_enquiries: pick(input, 'monthlyEnquiries', 'monthly_enquiries'),
    message: pick(input, 'message'),
  };
}
