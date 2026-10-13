import type { IncomingMessage, ServerResponse } from 'node:http';

export interface EnquiryRelayEnv {
  supabaseUrl: string;
  secretKey: string;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function cleanOrNull(val: unknown, maxLen: number): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : null;
}

async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    return req.body ? (JSON.parse(req.body) as Record<string, unknown>) : {};
  }
  if (Buffer.isBuffer(req.body)) {
    const str = req.body.toString('utf8');
    return str ? (JSON.parse(str) as Record<string, unknown>) : {};
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
}

/**
 * Shared server-side handler for `POST /api/enquiries` (used by both the
 * Vercel Serverless Function in `api/enquiries.ts` and the Vite dev/preview
 * middleware in `vite.config.ts`).
 */
export async function handleEnquiryRelayRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
  env: EnquiryRelayEnv,
  next?: () => void,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    if (next) {
      next();
      return;
    }
    sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed.' } });
    return;
  }

  try {
    const body = await readJsonBody(req);

    const name = String(body.name ?? '').trim().slice(0, 120);
    const email = String(body.email ?? '').trim().toLowerCase().slice(0, 200);

    if (name.length < 2) {
      sendJson(res, 400, { error: { code: 'validation', message: 'Enter your name.' } });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      sendJson(res, 400, { error: { code: 'validation', message: 'Enter a valid email address.' } });
      return;
    }

    const supabaseUrl = env.supabaseUrl.replace(/\/+$/, '');
    const secretKey = env.secretKey;

    if (!supabaseUrl || !secretKey) {
      sendJson(res, 503, { error: { code: 'service_unavailable', message: 'Enquiry relay is not configured.' } });
      return;
    }

    const headers = {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    };

    // Per-address throttle (1/minute, 3/hour) and global throttle (40/10m)
    const now = Date.now();
    const oneHourAgoIso = new Date(now - 60 * 60 * 1000).toISOString();
    const oneMinAgoMs = now - 60 * 1000;
    const tenMinAgoMs = now - 10 * 60 * 1000;

    const recentRes = await fetch(
      `${supabaseUrl}/rest/v1/enquiries?select=email,created_at&created_at=gt.${encodeURIComponent(oneHourAgoIso)}`,
      { headers },
    );
    if (recentRes.ok) {
      const recentRows = (await recentRes.json()) as Array<{ email?: string; created_at?: string }>;
      const forEmailHour = recentRows.filter((r) => (r.email ?? '').toLowerCase() === email);
      if (forEmailHour.length >= 3) {
        sendJson(res, 429, {
          error: { code: 'validation', message: 'We already have this enquiry — we will be in touch.' },
        });
        return;
      }
      const forEmailMin = forEmailHour.filter((r) => {
        const ts = Date.parse(r.created_at ?? '');
        return !Number.isNaN(ts) && ts > oneMinAgoMs;
      });
      if (forEmailMin.length >= 1) {
        sendJson(res, 429, {
          error: { code: 'validation', message: 'Please wait a moment before sending another enquiry.' },
        });
        return;
      }
      const globalTenMin = recentRows.filter((r) => {
        const ts = Date.parse(r.created_at ?? '');
        return !Number.isNaN(ts) && ts > tenMinAgoMs;
      });
      if (globalTenMin.length >= 40) {
        sendJson(res, 429, {
          error: {
            code: 'validation',
            message:
              'We are receiving a lot of enquiries right now — please try again shortly, or message us on WhatsApp.',
          },
        });
        return;
      }
    }

    const rawId = typeof body.id === 'string' && /^eq_[0-9a-f]{12}$/.test(body.id) ? body.id : undefined;
    const plan = cleanOrNull(body.plan, 80);
    const message = cleanOrNull(body.message, 4000);

    const baseRow: Record<string, unknown> = {
      ...(rawId ? { id: rawId } : {}),
      name,
      email,
      business_name: cleanOrNull(body.business_name, 200),
      whatsapp: cleanOrNull(body.whatsapp, 40),
      business_type: cleanOrNull(body.business_type, 80),
      current_tools: cleanOrNull(body.current_tools, 300),
      bottleneck: cleanOrNull(body.bottleneck, 300),
      monthly_enquiries: cleanOrNull(body.monthly_enquiries, 80),
      message,
      plan,
    };

    let insertRes = await fetch(`${supabaseUrl}/rest/v1/enquiries`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(baseRow),
    });

    // If migration 0007 (`plan` column on `enquiries`) has not been applied yet,
    // fold the selected plan into `message` and retry without `plan`.
    if (!insertRes.ok && plan) {
      const errText = await insertRes.text();
      if (/plan|42703|PGRST204/i.test(errText)) {
        const foldedMessage = [`Plan of interest: ${plan}`, message].filter(Boolean).join('\n\n').slice(0, 4000);
        const { plan: _omitted, ...rowWithoutPlan } = baseRow;
        insertRes = await fetch(`${supabaseUrl}/rest/v1/enquiries`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({ ...rowWithoutPlan, message: foldedMessage }),
        });
      } else {
        sendJson(res, insertRes.status, {
          error: { code: 'error', message: errText || 'Could not save enquiry.' },
        });
        return;
      }
    }

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      sendJson(res, insertRes.status, {
        error: { code: 'error', message: errText || 'Could not save enquiry.' },
      });
      return;
    }

    const inserted = (await insertRes.json()) as Array<{ id?: string }>;
    const reference = inserted?.[0]?.id ?? rawId ?? null;
    sendJson(res, 200, { received: true, reference });
  } catch {
    sendJson(res, 500, { error: { code: 'server_error', message: 'Could not process enquiry.' } });
  }
}
