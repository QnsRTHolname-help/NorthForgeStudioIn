// deno-lint-ignore-file no-explicit-any
/**
 * NorthForge — WhatsApp Cloud API webhook (Edge Function).
 *
 * Receives Meta's webhook events for the business number:
 *
 *   • messages     — a customer replied; the message is stored inbound and
 *                    appears in the admin inbox immediately.
 *   • statuses     — sent → delivered → read (and failures) update the row
 *                    we sent by its provider message id.
 *
 * SECURITY — this endpoint is `--no-verify-jwt` (Meta cannot present a
 * Supabase session) and it writes with the service-role key, i.e. past RLS.
 * It is therefore the single most privileged unauthenticated surface in the
 * product, and it is protected by Meta's own request signature:
 *
 *   X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(raw_body, APP_SECRET)
 *
 * Every POST is verified against the RAW bytes before anything is parsed or
 * written. Previously there was no check at all: anyone who learned the URL
 * could inject arbitrary "customer" replies into the inbox using the service
 * role. The URL being obscure is not a control.
 *
 * Required secrets:
 *   WHATSAPP_APP_SECRET        Meta App Dashboard → Settings → Basic
 *   WHATSAPP_VERIFY_TOKEN      the value pasted into Meta's webhook config
 *   WHATSAPP_PHONE_NUMBER_ID   the business number id (events for any other
 *                              number are ignored)
 *
 * Deploy: supabase functions deploy whatsapp-webhook --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isExpectedPhoneNumberId,
  normalizeWhatsAppNumber,
  SIGNATURE_HEADER,
  verifyMetaSignature,
} from '../_shared/whatsapp-edge.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '';
const APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET') ?? '';
const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';

/** Minimal shape of the Meta webhook body we actually read. */
interface WhatsAppWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        messages?: {
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }[];
        statuses?: {
          id?: string;
          status?: string;
          recipient_id?: string;
        }[];
      };
    }[];
  }[];
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── Meta subscription verification (GET) ───────────────────────
  if (url.searchParams.get('hub.mode') === 'subscribe') {
    const token = url.searchParams.get('hub.verify_token') ?? '';
    const challenge = url.searchParams.get('hub.challenge') ?? '';
    if (!VERIFY_TOKEN || token !== VERIFY_TOKEN) return new Response('forbidden', { status: 403 });
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  if (req.method !== 'POST') return new Response('ok');

  // ── 1. Read the RAW bytes and verify Meta's signature ──────────
  // The digest covers the exact bytes on the wire. Re-serialising a parsed
  // body would change whitespace and key order and never match.
  const raw = new Uint8Array(await req.arrayBuffer());

  if (!APP_SECRET) {
    // Fail closed. Without the app secret nothing can be verified, and
    // writing unauthenticated events with the service role would be worse
    // than dropping them.
    console.error('[whatsapp-webhook] WHATSAPP_APP_SECRET is not set — refusing every event');
    return new Response('forbidden', { status: 403 });
  }

  const valid = await verifyMetaSignature(raw, req.headers.get(SIGNATURE_HEADER), APP_SECRET);
  if (!valid) {
    console.error('[whatsapp-webhook] rejected: missing or invalid X-Hub-Signature-256');
    return new Response('forbidden', { status: 403 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw)) as WhatsAppWebhookPayload;
  } catch {
    // Signature was valid, so this is our bug, not an attack. Answer 200 so
    // Meta does not retry forever and disable the webhook.
    console.error('[whatsapp-webhook] signed payload was not valid JSON');
    return new Response('ok');
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};

      // ── 2. Only this business number's events ──────────────────
      // A signed request can still be about a different phone number id
      // (another number in the same Meta app). Its messages do not belong in
      // this inbox. Fails closed when the id is not configured.
      const phoneId = value?.metadata?.phone_number_id;
      if (!isExpectedPhoneNumberId(phoneId, PHONE_NUMBER_ID)) {
        console.warn(
          '[whatsapp-webhook] ignoring event for unexpected phone_number_id',
          phoneId ?? '(none)',
        );
        continue;
      }

      // ── Inbound customer messages ──────────────────────────────
      for (const message of value?.messages ?? []) {
        const from = normalizeWhatsAppNumber(String(message?.from ?? ''));
        // Never let provider text into the table unbounded.
        const text = String(message?.text?.body ?? '').trim().slice(0, 4096);
        if (!from || !text) continue;

        // Link to a client by phone digits when possible (best-effort).
        const { data: client } = await admin
          .from('clients')
          .select('id')
          .eq('phone', from)
          .limit(1)
          .maybeSingle();

        const { error } = await admin.from('whatsapp_messages').insert({
          direction: 'inbound',
          to_number: from, // schema stores the partner number in to_number
          body: text,
          status: 'read',
          automated: false,
          client_id: client?.id ?? null,
          provider_message_id: String(message?.id ?? '') || null,
        });

        if (error) {
          // 23505 = unique violation on the provider message id, i.e. Meta
          // re-delivered an event we already stored. Harmless by design.
          if (error.code === '23505') {
            console.info('[whatsapp-webhook] duplicate delivery ignored', message?.id);
          } else {
            console.error('[whatsapp-webhook] insert inbound failed', error.message);
          }
        }
      }

      // ── Delivery / read receipts ───────────────────────────────
      for (const status of value?.statuses ?? []) {
        const providerId = String(status?.id ?? '');
        if (!providerId) continue;
        const map: Record<string, string> = {
          deleted: 'failed',
          failed: 'failed',
          read: 'read',
          delivered: 'delivered',
          sent: 'sent',
        };
        const mapped = map[String(status?.status ?? '')] ?? null;
        if (!mapped) continue;

        // The provider message id is unique, so this targets exactly the row
        // we sent. A guard trigger on the table stops an out-of-order
        // receipt from downgrading a message that is already further along.
        const { error } = await admin
          .from('whatsapp_messages')
          .update({ status: mapped })
          .eq('provider_message_id', providerId);

        if (error) console.error('[whatsapp-webhook] status update failed', error.message);
      }
    }
  }

  return new Response('ok');
});
