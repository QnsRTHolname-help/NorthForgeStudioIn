import { Router } from 'express';
import { db, newId, nowIso, queryOne } from '../db';
import { asyncHandler, conflict, ok, tooMany } from '../lib/http';
import { parseBody, contactSchema } from '../lib/validate';
import { recordActivity } from '../services/activity';
import { notifyAdmins } from '../services/notify';

const router = Router();

/** Naive in-memory throttle for the public form (per IP, per 10 minutes). */
const submissions = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 4;

/**
 * Public enquiry / automation audit (spec §118).
 * Persists a real lead, notifies the team and returns immediately.
 */
router.post(
  '/contact',
  asyncHandler(async (req, res) => {
    const input = parseBody(contactSchema, req.body);

    // Honeypot: silently accept, discard.
    if (input.website) return ok(res, { received: true, reference: null });

    const ip = String(req.ip ?? req.socket.remoteAddress ?? 'unknown');
    const recent = (submissions.get(ip) ?? []).filter((t) => Date.now() - t < WINDOW_MS);
    if (recent.length >= MAX_PER_WINDOW) {
      throw tooMany('You have sent several enquiries recently. Please try again shortly or message us on WhatsApp.');
    }
    submissions.set(ip, [...recent, Date.now()]);

    // Duplicate guard: same email + same message inside the window.
    const duplicate = queryOne<{ id: string }>(
      "SELECT id FROM leads WHERE email = ? AND message = ? AND created_at > datetime('now', '-1 day')",
      [input.email, input.message || null],
    );
    if (duplicate) throw conflict('You have already sent this enquiry. We will be in touch shortly.');

    const leadId = newId('ld');
    const now = nowIso();

    db.prepare(
      `INSERT INTO leads (id, contact_name, business_name, email, phone, source, status, score, message, intent, next_action, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'website', 'new', 0, ?, NULL, 'Review enquiry and respond', ?, ?)`,
    ).run(
      leadId,
      input.name,
      input.businessName,
      input.email,
      input.phone,
      [input.message, input.slowestProcess ? `Slowest process: ${input.slowestProcess}` : null, input.currentTools ? `Current tools: ${input.currentTools}` : null, input.monthlyEnquiries ? `Monthly enquiries: ${input.monthlyEnquiries}` : null, input.businessType ? `Business type: ${input.businessType}` : null]
        .filter(Boolean)
        .join('\n'),
      now,
      now,
    );

    recordActivity({
      type: 'lead.created',
      label: 'New enquiry from website',
      detail: `${input.businessName} — ${input.email}`,
      actor: input.name,
      actorRole: 'system',
      entityType: 'lead',
      entityId: leadId,
    });

    notifyAdmins({
      kind: 'lead',
      title: 'New website enquiry',
      body: `${input.businessName} (${input.email})`,
      href: `/app/leads/${leadId}`,
      entityType: 'lead',
      entityId: leadId,
    });

    return ok(res, { received: true, reference: leadId }, 201);
  }),
);

export default router;
