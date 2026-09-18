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
 * Meta verifies the subscription with GET ?hub.mode=subscribe&hub.verify_token=…
 * — set WHATSAPP_VERIFY_TOKEN as a function secret and paste the same value
 * in the Meta App Dashboard → WhatsApp → Configuration.
 *
 * Deploy: supabase functions deploy whatsapp-webhook --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '';

/** Minimal shape of the Meta webhook body we actually read. */
interface WhatsAppWebhookPayload {
  entry?: {
    changes?: {
      value?: {
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

  let payload: WhatsAppWebhookPayload;
  try {
    payload = (await req.json()) as WhatsAppWebhookPayload;
  } catch {
    return new Response('ok'); // never 500 to Meta — it would disable the webhook
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const phoneId = String(value?.metadata?.phone_number_id ?? '');

      // ── Inbound customer messages ──────────────────────────────
      for (const message of value?.messages ?? []) {
        const from = normalize(String(message?.from ?? ''));
        const text = String(message?.text?.body ?? '').trim();
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
        if (error) console.error('[whatsapp-webhook] insert inbound failed', error.message);
      }

      // ── Delivery / read receipts ───────────────────────────────
      for (const status of value?.statuses ?? []) {
        const providerId = String(status?.id ?? '');
        if (!providerId || !phoneId) continue;
        const map: Record<string, string> = {
          deleted: 'failed',
          failed: 'failed',
          read: 'read',
          delivered: 'delivered',
          sent: 'sent',
        };
        const mapped = map[String(status?.status ?? '')] ?? null;
        if (!mapped) continue;
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

/** Same digit rules as the rest of the product (src/lib/whatsapp.ts). */
function normalize(raw: string): string | null {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null;
  return digits;
}
