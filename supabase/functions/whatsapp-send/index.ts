// deno-lint-ignore-file no-explicit-any
/**
 * NorthForge — WhatsApp Cloud API send (Edge Function).
 *
 * What admin sends on the website reaches the customer's real WhatsApp
 * through Meta's Cloud API. The access token and phone-number id never
 * leave the server: the browser calls this function with its Supabase
 * session, the function verifies the caller is an admin, then:
 *
 *   1. inserts the outbound row into `whatsapp_messages` (RLS, as the
 *      admin) with the provider message id,
 *   2. POSTs to `/{phone_number_id}/messages` on the Graph API,
 *   3. marks the row `sent` or `failed` with a safe, human reason.
 *
 * Required secrets (set once per project):
 *   supabase secrets set WHATSAPP_ACCESS_TOKEN=… WHATSAPP_PHONE_NUMBER_ID=…
 * Optional:
 *   WHATSAPP_API_VERSION (default v21.0)
 *
 * Deploy: supabase functions deploy whatsapp-send
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GRAPH_VERSION = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v21.0';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Only digits survive, same rules the browser applies before calling. */
function normalizeNumber(raw: string): string | null {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null;
  return digits;
}

/** The slice of the Graph API response we actually read. */
interface GraphPayload {
  messages?: { id?: string }[];
  error?: { code?: number | string; message?: string };
}

/** Map a Graph API error to a message an operator can act on. */
function graphReason(payload: GraphPayload | null): string {
  const error = payload?.error ?? {};
  const code = Number(error.code ?? 0);
  if (code === 131047) {
    return 'WhatsApp only allows free-form messages within 24 hours of the customer’s last message. Outside that window send an approved template (WhatsApp → Templates).';
  }
  if (code === 131026 || code === 131049) {
    return 'The customer has not engaged with this number yet. Send the first message from the business WhatsApp (wa.me) or use an approved template.';
  }
  if (code === 190) return 'The WhatsApp access token is invalid or expired — refresh it in the Meta developer dashboard.';
  if (code === 131030) return 'That number is not a WhatsApp number.';
  return String(error.message ?? 'WhatsApp rejected the message.') || 'WhatsApp rejected the message.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Cheap connectivity probe used by the admin UI ("is the Cloud API on?").
  if (payload?.probe === true) {
    // Not configured yet — the browser falls back to the wa.me deep link and
    // keeps the message queued. Honest by design: never fake a delivery.
    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
      return json({ error: 'whatsapp_not_configured', configured: false }, 501);
    }
    return json({ configured: true });
  }

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'unauthorized', message: 'Sign in again and retry.' }, 401);
  }

  // Verify the caller as an authenticated admin against their own profile
  // (RLS lets a user read their own profile row; the role column decides).
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth?.user) return json({ error: 'unauthorized', message: 'Sign in again and retry.' }, 401);

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single();
  if (profileError || !profile || !['admin', 'super_admin'].includes(String(profile.role))) {
    return json({ error: 'forbidden', message: 'Only NorthForge admins can send WhatsApp messages.' }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_request', message: 'Malformed request body.' }, 400);
  }

  const to = normalizeNumber(String(payload?.to ?? ''));
  const body = String(payload?.body ?? '').trim();
  const clientId = typeof payload?.clientId === 'string' && payload.clientId ? payload.clientId : null;

  if (!to) return json({ error: 'validation', message: 'Enter a valid WhatsApp number (country code first).' }, 400);
  if (!body) return json({ error: 'validation', message: 'Write the message to send.' }, 400);

  const id = `wm_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const createdAt = new Date().toISOString();

  const { data: inserted, error: insertError } = await client
    .from('whatsapp_messages')
    .insert({
      id,
      client_id: clientId,
      direction: 'outbound',
      to_number: to,
      body,
      status: 'queued',
      created_at: createdAt,
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    return json({ error: 'insert_failed', message: 'Could not record the message. Try again.' }, 500);
  }

  // ── The real send ──────────────────────────────────────────────
  const graphResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body },
    }),
  });

  const graphPayload: GraphPayload | null = await graphResponse.json().catch(() => null);
  const providerMessageId: string | null = graphPayload?.messages?.[0]?.id ?? null;

  if (!graphResponse.ok || !providerMessageId) {
    const reason = graphReason(graphPayload);
    await client.from('whatsapp_messages').update({ status: 'failed' }).eq('id', id);
    return json({ error: 'send_failed', message: reason, id }, 502);
  }

  await client
    .from('whatsapp_messages')
    .update({ status: 'sent', provider_message_id: providerMessageId })
    .eq('id', id);

  return json({ sent: true, id, status: 'sent', to }, 201);
});
