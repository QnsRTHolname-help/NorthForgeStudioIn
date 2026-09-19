// deno-lint-ignore-file no-explicit-any
/**
 * NorthForge — WhatsApp Cloud API send (Edge Function).
 *
 * What an admin sends on the website reaches the customer's real WhatsApp
 * through Meta's Cloud API. The access token and phone-number id never leave
 * the server: the browser calls this function with its Supabase session, the
 * function verifies the caller is an admin, then:
 *
 *   1. validates the request (number, body length, client reference),
 *   2. inserts the outbound row into `whatsapp_messages` (RLS, as the admin),
 *   3. POSTs to `/{phone_number_id}/messages` on the Graph API,
 *   4. marks that same row `sent` — or `failed` with a human reason.
 *
 * ONE logical send produces at most ONE row. On provider failure the row is
 * kept and marked `failed`, and its id is returned, so the browser can update
 * the existing message instead of recording a second queued copy (see
 * `whatsappService.send` in src/services/index.ts).
 *
 * Required secrets (set once per project):
 *   supabase secrets set WHATSAPP_ACCESS_TOKEN=… WHATSAPP_PHONE_NUMBER_ID=…
 * Optional:
 *   WHATSAPP_API_VERSION (default v21.0)
 *
 * Deploy: supabase functions deploy whatsapp-send
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isProbeRequest,
  parseSendRequest,
} from '../_shared/whatsapp-edge.ts';

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
  // Never echo an unbounded provider string back to the browser.
  return String(error.message ?? 'WhatsApp rejected the message.').slice(0, 300) || 'WhatsApp rejected the message.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // ── Parse the body EXACTLY ONCE, first. ────────────────────────
  // The previous version read `payload?.probe` before `payload` was declared.
  // Reading a `let` binding before initialisation is a ReferenceError, so
  // EVERY request — probe and real send alike — threw and the function was
  // completely non-functional. Parsing once, up front, removes that class of
  // bug (and the temptation to read the stream twice, which is not possible).
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_request', message: 'Malformed request body.' }, 400);
  }

  // ── Authenticate BEFORE disclosing anything ────────────────────
  // The probe used to answer unauthenticated callers, which told anyone who
  // asked whether the studio's WhatsApp Cloud API was configured — supplier
  // state leaked to the public internet. Authorization now comes first.
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

  // ── Connectivity probe (authorized admins only) ────────────────
  if (isProbeRequest(payload)) {
    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
      // Not configured yet — the browser falls back to the wa.me deep link
      // and keeps the message queued. Honest by design: never fake delivery.
      return json({ error: 'whatsapp_not_configured', configured: false }, 501);
    }
    return json({ configured: true });
  }

  // ── Validate ───────────────────────────────────────────────────
  const parsed = parseSendRequest(payload);
  if (!parsed.ok) return json({ error: parsed.error, message: parsed.message }, parsed.status);
  const { to, body, clientId } = parsed.value;

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
  let graphResponse: Response;
  try {
    graphResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
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
  } catch {
    // Network failure: the row exists and is marked failed, and its id comes
    // back so the caller can update that row rather than create another.
    const reason = 'Could not reach WhatsApp. Check the connection and try again.';
    await client.from('whatsapp_messages').update({ status: 'failed', failure_reason: reason }).eq('id', id);
    return json({ error: 'send_failed', message: reason, id, status: 'failed' }, 502);
  }

  const graphPayload: GraphPayload | null = await graphResponse.json().catch(() => null);
  const providerMessageId: string | null = graphPayload?.messages?.[0]?.id ?? null;

  if (!graphResponse.ok || !providerMessageId) {
    const reason = graphReason(graphPayload);
    await client.from('whatsapp_messages').update({ status: 'failed', failure_reason: reason }).eq('id', id);
    // `id` is the contract: one logical send attempt = one row, already
    // recorded and already marked failed.
    return json({ error: 'send_failed', message: reason, id, status: 'failed' }, 502);
  }

  await client
    .from('whatsapp_messages')
    .update({ status: 'sent', provider_message_id: providerMessageId, failure_reason: null })
    .eq('id', id);

  return json({ sent: true, id, status: 'sent', to }, 201);
});
