/**
 * NorthForge database seed.
 *
 *   npm run seed         → accounts, assistants + labelled demo dataset
 *   npm run seed:demo    → same as above (explicit)
 *   npm run seed:clean   → accounts and assistants only (production-empty)
 *
 * Every record created with `--demo` is flagged `is_demo = 1` and is
 * surfaced in the UI with a DEMO DATA badge (spec §86). Nothing here
 * should ever be mistaken for real client performance.
 */
import bcrypt from 'bcryptjs';
import { db, newId, nowIso } from './db';
import { PLANS, getPlanById } from '@shared/catalog';

const args = process.argv.slice(2);
const CLEAN = args.includes('--clean');
const DEMO = args.includes('--demo') || !CLEAN;

/* ── Helpers ───────────────────────────────────────────────────── */

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};
const dateOnly = (offset: number) => day(offset).slice(0, 10);
const isoAt = (offset: number, hour = 10, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

function resetBusinessData() {
  const tables = [
    'notifications',
    'activity',
    'client_requests',
    'tickets',
    'payments',
    'invoices',
    'subscriptions',
    'bookings',
    'website_analytics',
    'websites',
    'tasks',
    'projects',
    'outreach_sequences',
    'proposals',
    'follow_ups',
    'leads',
    'whatsapp_messages',
    'whatsapp_templates',
    'workflow_nodes',
    'workflows',
    'onboarding_drafts',
  ];
  for (const table of tables) db.prepare(`DELETE FROM ${table}`).run();

  // Clean seed: remove every fabricated record — businesses *and* the
  // invented demo login. Real accounts (yours, and your clients') survive.
  db.prepare('DELETE FROM clients WHERE is_demo = 1').run();
  db.prepare('UPDATE users SET client_id = NULL WHERE client_id NOT IN (SELECT id FROM clients)').run();
  /**
   * The invented demo login. Matched by email, not the is_demo flag: rows
   * created before that column existed carry the default 0, so a flag-only
   * delete leaves a client account with no business behind — which signs in
   * successfully and then has nothing to load.
   */
  db.prepare("DELETE FROM users WHERE email = 'client@northforge.studio' AND (is_demo = 1 OR client_id IS NULL)").run();
}

/* ── Accounts (always present) ─────────────────────────────────── */

function seedAccounts() {
  const accounts = [
    { email: 'admin@northforge.studio', name: 'NorthForge Admin', role: 'admin', password: 'NorthForge@2026' },
    { email: 'owner@northforge.studio', name: 'NorthForge Owner', role: 'super_admin', password: 'NorthForge@2026' },
  ];

  for (const account of accounts) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(account.email) as { id: string } | undefined;
    if (existing) {
      db.prepare('UPDATE users SET role = ?, name = ? WHERE id = ?').run(account.role, account.name, existing.id);
      continue;
    }
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(newId('us'), account.email, account.name, bcrypt.hashSync(account.password, 10), account.role, nowIso());
  }
}


/* ── Demo dataset ──────────────────────────────────────────────── */

function seedDemo() {
  const convert = getPlanById('plan_convert')!;
  const autopilot = getPlanById('plan_autopilot')!;
  const lead = PLANS[0]!;

  const clients = [
    { id: newId('cl'), business: 'Coastal Dental Studio', contact: 'Dr. Ananya Rao', email: 'client@northforge.studio', type: 'Healthcare', city: 'Mangaluru', state: 'Karnataka', plan: convert, status: 'active', site: 'coastaldental.in' },
    { id: newId('cl'), business: 'Kanara Logistics', contact: 'Rakesh Shetty', email: 'ops@kanaralogistics.example', type: 'Logistics', city: 'Mangaluru', state: 'Karnataka', plan: autopilot, status: 'active', site: 'kanaralogistics.in' },
    { id: newId('cl'), business: 'Shoreline Interiors', contact: 'Meera Nayak', email: 'hello@shoreline.example', type: 'Interior design', city: 'Udupi', state: 'Karnataka', plan: lead, status: 'onboarding', site: null },
  ];

  for (const c of clients) {
    db.prepare(
      `INSERT INTO clients (id, business_name, contact_name, email, phone, business_type, city, state, plan_id, status, website_url, onboarding_step, onboarding_completed, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      c.id,
      c.business,
      c.contact,
      c.email,
      '9845000000',
      c.type,
      c.city,
      c.state,
      c.plan.id,
      c.status,
      c.site ? `https://${c.site}` : null,
      c.status === 'onboarding' ? 4 : 11,
      c.status === 'onboarding' ? 0 : 1,
      day(-120),
      nowIso(),
    );
  }

  const [dental, logistics, interiors] = clients;

  // Client login for the demo business.
  /**
   * Demo client login.
   *
   * Only created with `--demo`, and the person is invented, so it must never
   * appear in a clean database — a clean seed contains no fabricated
   * businesses, contacts or phone numbers.
   */
  const existingClientUser = db.prepare('SELECT id FROM users WHERE email = ?').get('client@northforge.studio') as
    | { id: string }
    | undefined;
  if (existingClientUser) {
    db.prepare('UPDATE users SET client_id = ?, role = ? WHERE id = ?').run(dental!.id, 'client', existingClientUser.id);
  } else {
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, role, client_id, phone, created_at, is_demo)
       VALUES (?, ?, ?, ?, 'client', ?, ?, ?, 1)`,
    ).run(newId('us'), 'client@northforge.studio', 'Demo Client', bcrypt.hashSync('NorthForge@2026', 10), dental!.id, '0000000000', day(-120));
  }

  /* ── Websites ─────────────────────────────────────────────── */
  const websites = [
    { id: newId('wb'), client: dental!.id, name: 'Coastal Dental Studio', domain: 'coastaldental.in', status: 'live' },
    { id: newId('wb'), client: logistics!.id, name: 'Kanara Logistics', domain: 'kanaralogistics.in', status: 'live' },
    { id: newId('wb'), client: interiors!.id, name: 'Shoreline Interiors', domain: null, status: 'building' },
  ];

  for (const w of websites) {
    db.prepare(
      `INSERT INTO websites (id, client_id, name, domain, url, status, deployment, ssl, hosting, framework, last_deployed_at, last_updated_at, maintenance, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NorthForge Edge', 'React + Vite', ?, ?, 1, 1, ?)`,
    ).run(
      w.id,
      w.client,
      w.name,
      w.domain,
      w.domain ? `https://${w.domain}` : null,
      w.status,
      w.status === 'live' ? 'live' : 'building',
      w.status === 'live' ? 1 : 0,
      w.status === 'live' ? day(-12) : null,
      day(-6),
      day(-90),
    );
  }

  /* ── Analytics: 60 days, deterministic but organic-looking ── */
  for (const w of websites.slice(0, 2)) {
    for (let i = 59; i >= 0; i -= 1) {
      const base = w.domain === 'coastaldental.in' ? 42 : 68;
      const wave = Math.round(Math.sin(i / 6) * 8 + base + (60 - i) * 0.35);
      const visitors = Math.max(8, wave);
      const leads = Math.max(0, Math.round(visitors * (0.045 + (i % 7) * 0.004)));
      const whatsapp = Math.round(visitors * 0.11);
      const bookings = Math.round(leads * 0.4);
      db.prepare(
        `INSERT OR REPLACE INTO website_analytics (id, website_id, date, visitors, sessions, leads, whatsapp_clicks, bookings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(newId('wa'), w.id, dateOnly(-i), visitors, Math.round(visitors * 1.25), leads, whatsapp, bookings);
    }
  }

  /* ── Leads ────────────────────────────────────────────────── */
  const leadSeed: [string, string | null, string, string, string, string][] = [
    // contact, business, email, phone, source, status
    ['Priya Menon', 'Bright Smiles', 'priya@example.com', '9845010001', 'website', 'new'],
    ['Vikram Adiga', 'Adiga Constructions', 'vikram@example.com', '9845010002', 'whatsapp', 'qualified'],
    ['Sneha Kulkarni', null, 'sneha@example.com', '9845010003', 'website', 'contacted'],
    ['Mohammed Faiz', 'Faiz Traders', 'faiz@example.com', '9845010004', 'referral', 'proposal'],
    ['Latha Pai', 'Pai Clinic', 'latha@example.com', '9845010005', 'website', 'won'],
    ['Arjun Bhat', 'Bhat Motors', 'arjun@example.com', '9845010006', 'outreach', 'lost'],
    ['Divya Shetty', null, 'divya@example.com', '9845010007', 'website', 'new'],
    ['Nikhil Rao', 'Rao Legal', 'nikhil@example.com', '9845010008', 'call', 'qualified'],
    ['Asha Kamath', 'Kamath Caterers', 'asha@example.com', '9845010009', 'website', 'contacted'],
    ['Rohit Salian', null, 'rohit@example.com', '9845010010', 'whatsapp', 'new'],
    ['Fatima Dsouza', 'Dsouza Boutique', 'fatima@example.com', '9845010011', 'website', 'won'],
    ['Ganesh Poojary', 'Poojary Hardware', 'ganesh@example.com', '9845010012', 'referral', 'qualified'],
  ];

  leadSeed.forEach(([contact, business, email, phone, source, status], index) => {
    const value = [45_000, 120_000, 25_000, 90_000, 150_000, 30_000, 20_000, 75_000, 60_000, 15_000, 110_000, 55_000][index]! * 100;
    const message = [
      'Hi — we need a new website with online appointment booking. Ideally live within a month.',
      'We get enquiries on WhatsApp but miss many. Can you automate follow-ups?',
      'Interested in the Growth plan. Do you handle hosting and SSL too?',
      'Looking for a site plus lead capture. What is the pricing?',
      'Please rebuild our site and connect WhatsApp. Budget is approved, we want to start this month.',
      'Just comparing options for now, thanks.',
      'Do you build eCommerce sites? I need to sell products online.',
      'Our current site is slow. Can you fix performance and SEO?',
      'We want content updates every month. Is that included?',
      'Quick question: can the AI assistant answer pricing questions automatically?',
      'Ready to proceed. Please send the proposal.',
      'Need a booking system for service appointments with reminders.',
    ][index]!;

    db.prepare(
      `INSERT INTO leads (id, client_id, contact_name, business_name, email, phone, source, status, score, value, message, intent, next_action, owner_id, ai_summary, ai_qualification, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, ?, ?)`,
    ).run(
      newId('ld'),
      index % 3 === 0 ? dental!.id : index % 3 === 1 ? logistics!.id : interiors!.id,
      contact,
      business,
      email,
      phone,
      source,
      status,
      [38, 72, 55, 81, 92, 24, 46, 63, 51, 33, 88, 69][index]!,
      value,
      message,
      ['Website enquiry', 'Automation enquiry', 'Pricing enquiry', 'Lead capture enquiry', 'Website enquiry', 'General enquiry', 'Website enquiry', 'Website enquiry', 'Support enquiry', 'AI enquiry', 'Pricing enquiry', 'Automation enquiry'][index]!,
      'Review and respond',
      `${contact}: ${status} lead from ${source}.`,
      status === 'won' || status === 'proposal'
        ? 'Strong fit. Clear intent with contact details and a timeline — prioritise a same-day response.'
        : status === 'lost'
          ? 'Closed as lost. Nurture with an automated follow-up next quarter.'
          : 'Possible fit. Follow up within one business day and confirm scope.',
      day(-Math.round(index * 2.4) - 1),
      day(-index),
    );
  });

  /* ── Projects, tasks, follow-ups ──────────────────────────── */
  const projectSeed: [string, string, string, number, string, number][] = [
    ['Coastal Dental — Website + Booking', dental!.id, 'optimization', 100, 'completed', -60],
    ['Kanara Logistics — Growth System', logistics!.id, 'development', 65, 'active', -20],
    ['Shoreline Interiors — Build', interiors!.id, 'design', 30, 'active', -8],
  ];

  const projectIds: string[] = [];
  for (const [name, clientId, stage, progress, status, days] of projectSeed) {
    const id = newId('pj');
    projectIds.push(id);
    db.prepare(
      `INSERT INTO projects (id, client_id, name, stage, status, progress, start_date, due_date, notes, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
    ).run(id, clientId, name, stage, status, progress, dateOnly(days), dateOnly(days + 45), day(days), nowIso());
  }

  const taskSeed: [string, string, string, number, number][] = [
    ['Finalise appointment flow copy', 'in_progress', 'high', 2, 0],
    ['Connect WhatsApp Cloud API credentials', 'todo', 'high', 1, 1],
    ['Design homepage hero for Shoreline', 'in_progress', 'medium', 5, 2],
    ['Set up conversion events for enquiry form', 'todo', 'medium', 7, 0],
    ['Write SEO metadata for service pages', 'review', 'low', -2, 1],
    ['QA booking reminders end to end', 'todo', 'urgent', 1, 0],
    ['Ship monthly performance report', 'done', 'medium', -6, 1],
  ];
  for (const [title, status, priority, due, projectIndex] of taskSeed) {
    db.prepare(
      `INSERT INTO tasks (id, title, description, status, priority, project_id, client_id, assignee_id, due_date, is_demo, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, ?, 1, ?, ?)`,
    ).run(newId('tk'), title, status, priority, projectIds[projectIndex] ?? null, clients[projectIndex]?.id ?? null, dateOnly(due), day(-10), nowIso());
  }

  /* ── Subscriptions, invoices, payments ────────────────────── */
  clients.forEach((c, index) => {
    const subId = newId('sb');
    db.prepare(
      `INSERT INTO subscriptions (id, client_id, plan_id, status, started_at, renews_at, seats, is_demo)
       VALUES (?, ?, ?, 'active', ?, ?, ?, 1)`,
    ).run(subId, c.id, c.plan.id, day(-90 + index * 5), day(index === 2 ? 21 : 14 - index * 3), index === 1 ? 5 : 2);

    for (let cycle = 2; cycle >= 0; cycle -= 1) {
      const amount = c.plan.amount ?? 0;
      const tax = Math.round(amount * 0.18);
      const issued = day(-28 * cycle - 3);
      const paid = cycle > 0;
      db.prepare(
        `INSERT INTO invoices (id, number, client_id, subscription_id, amount, tax, total, currency, status, issued_at, due_at, paid_at, line_items, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, 1)`,
      ).run(
        newId('in'),
        `NF-2026-${String(100 + index * 10 + (2 - cycle)).padStart(4, '0')}`,
        c.id,
        subId,
        amount,
        tax,
        amount + tax,
        paid ? 'paid' : 'open',
        issued,
        day(-28 * cycle + 4),
        paid ? issued : null,
        JSON.stringify([
          { label: `${c.plan.name} plan`, description: `${c.plan.tagline} Billed monthly.`, amount },
          { label: 'GST (18%)', description: 'Goods and Services Tax', amount: tax },
        ]),
      );

      if (paid) {
        db.prepare(
          `INSERT INTO payments (id, invoice_id, client_id, amount, currency, status, method, paid_at, is_demo)
           VALUES (?, ?, ?, ?, 'INR', 'succeeded', 'UPI', ?, 1)`,
        ).run(newId('pm'), null, c.id, amount + tax, issued);
      }
    }
  });

  /* ── Bookings ─────────────────────────────────────────────── */
  const bookingSeed: [string, string, string, number, number, string][] = [
    ['Kavya Rai', '9845020001', 'Consultation', 1, 11, 'confirmed'],
    ['Sunil Alva', '9845020002', 'Site visit', 2, 15, 'pending'],
    ['Reema Dsouza', '9845020003', 'Follow-up call', 3, 10, 'confirmed'],
    ['Imran Khan', '9845020004', 'Design review', 5, 16, 'confirmed'],
    ['Tanvi Hegde', '9845020005', 'Treatment planning', -2, 9, 'completed'],
  ];
  for (const [name, phone, service, offset, hour, status] of bookingSeed) {
    db.prepare(
      `INSERT INTO bookings (id, client_id, customer_name, customer_phone, email, service, starts_at, duration_mins, status, reminder_sent, notes, is_demo, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, 30, ?, ?, NULL, 1, ?)`,
    ).run(newId('bk'), dental!.id, name, phone, service, isoAt(offset, hour), status, status === 'confirmed' ? 1 : 0, day(-3));
  }

  /* ── Requests, tickets ────────────────────────────────────── */
  const requestSeed: [string, string, string, string, string][] = [
    ['Update treatment price list', 'Please update the pricing section on the treatments page with the new rates attached.', 'content_change', 'medium', 'in_progress'],
    ['Add a second WhatsApp number', 'We want the reception number added to the contact section.', 'website_change', 'low', 'open'],
    ['Booking form not sending notifications', 'Since yesterday we are not receiving email notifications for new bookings.', 'technical_issue', 'urgent', 'resolved'],
    ['Automate review requests after appointments', 'Can we send an automatic WhatsApp review request 2 hours after each appointment?', 'automation', 'high', 'open'],
  ];
  for (const [title, description, type, priority, status] of requestSeed) {
    db.prepare(
      `INSERT INTO client_requests (id, client_id, title, description, type, priority, status, attachments, activity, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, 1, ?, ?)`,
    ).run(
      newId('rq'),
      dental!.id,
      title,
      description,
      type,
      priority,
      status,
      JSON.stringify([
        { id: newId('ae'), label: 'Request created', detail: null, actor: 'Dr. Ananya Rao', createdAt: day(-6) },
        ...(status !== 'open'
          ? [
              {
                id: newId('ae'),
                label: `Status changed to ${status.replace('_', ' ')}`,
                detail: 'Picked up by the NorthForge team.',
                actor: 'NorthForge Admin',
                createdAt: day(-2),
              },
            ]
          : []),
      ]),
      day(-6),
      day(-2),
    );
  }

  db.prepare(
    `INSERT INTO tickets (id, client_id, subject, status, priority, category, messages, is_demo, created_at, updated_at)
     VALUES (?, ?, ?, 'open', 'high', 'Website', ?, 1, ?, ?)`,
  ).run(
    newId('tc'),
    logistics!.id,
    'Contact form submissions not reaching inbox',
    JSON.stringify([
      { id: newId('tm'), author: 'Rakesh Shetty', authorRole: 'client', body: 'We stopped receiving contact form submissions this morning.', internal: false, createdAt: day(-1) },
      { id: newId('tm'), author: 'NorthForge Admin', authorRole: 'admin', body: 'Checking delivery logs now — will confirm within the hour.', internal: false, createdAt: day(-1) },
      { id: newId('tm'), author: 'NorthForge Admin', authorRole: 'admin', body: 'Looks like their mailbox rule is filtering noreply@. Switching sender domain.', internal: true, createdAt: day(-1) },
    ]),
    day(-1),
    day(-1),
  );

  /* ── WhatsApp ─────────────────────────────────────────────── */
  const templates = [
    { name: 'enquiry_ack', category: 'utility', body: 'Hi {{1}}, thanks for reaching out to {{2}}. We have your enquiry and will reply within one business day.' },
    { name: 'appointment_reminder', category: 'utility', body: 'Reminder: your appointment at {{1}} is tomorrow at {{2}}. Reply C to confirm or R to reschedule.' },
    { name: 'follow_up_24h', category: 'marketing', body: 'Hi {{1}}, following up on your enquiry. Would you like us to send a quick quote?' },
  ];
  const templateIds: string[] = [];
  for (const t of templates) {
    const id = newId('wt');
    templateIds.push(id);
    db.prepare(
      `INSERT INTO whatsapp_templates (id, name, category, body, status, language, uses, is_demo)
       VALUES (?, ?, ?, ?, 'approved', 'en', ?, 1)`,
    ).run(id, t.name, t.category, t.body, 40 + templateIds.length * 12);
  }

  const messageSeed: [string, string, string, string, number, number][] = [
    ['inbound', '9845010001', 'Hi, do you have appointments this Saturday?', 'read', 0, -1],
    ['outbound', '9845010001', 'Hi Priya, thanks for reaching out. Yes — we have slots at 11:00 and 4:30.', 'read', 1, -1],
    ['inbound', '9845010004', 'Please share the proposal again.', 'delivered', 0, 0],
    ['outbound', '9845010004', 'Sending it now. It is valid for 14 days.', 'delivered', 1, 0],
    ['outbound', '9845020001', 'Reminder: your appointment is tomorrow at 11:00.', 'read', 1, 0],
  ];
  for (const [direction, to, body, status, automated, offset] of messageSeed) {
    db.prepare(
      `INSERT INTO whatsapp_messages (id, client_id, direction, to_number, body, status, template_id, automated, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(newId('wm'), dental!.id, direction, to, body, status, automated ? templateIds[1]! : null, automated, isoAt(offset, 12, 30));
  }

  /* ── Workflows ────────────────────────────────────────────── */
  const workflowSeed: [string, string, string, [string, string][], number][] = [
    [
      'Website enquiry → qualify → respond',
      'Captures every website enquiry, classifies it with AI, updates the CRM and sends an instant WhatsApp acknowledgement.',
      'active',
      [
        ['trigger', 'When an enquiry is submitted'],
        ['ai', 'Read enquiry and classify intent'],
        ['condition', 'Is the lead score above 60?'],
        ['whatsapp', 'Send instant acknowledgement'],
        ['notification', 'Notify the business owner'],
        ['update_record', 'Update CRM record'],
        ['create_task', 'Create a follow-up task for tomorrow'],
        ['delay', 'Wait 24 hours'],
        ['whatsapp', 'Send follow-up message if no reply'],
      ],
      412,
    ],
    [
      'Appointment booking → confirm → remind',
      'Confirms bookings immediately, schedules a reminder 24 hours before and asks for a review afterwards.',
      'active',
      [
        ['trigger', 'When an appointment is booked'],
        ['action', 'Send confirmation'],
        ['delay', 'Wait until 24 hours before'],
        ['whatsapp', 'Send reminder with confirm / reschedule'],
        ['condition', 'Did the customer confirm?'],
        ['book_appointment', 'Hold the slot'],
      ],
      268,
    ],
    [
      'Lead nurture sequence',
      'Multi-step nurture for enquiries that go quiet after the first reply.',
      'paused',
      [
        ['trigger', 'When a lead is qualified'],
        ['delay', 'Wait 2 days'],
        ['whatsapp', 'Send helpful follow-up'],
        ['ai', 'Re-score the lead'],
        ['create_task', 'Escalate to a human if score is high'],
      ],
      96,
    ],
  ];

  for (const [name, description, status, nodes, runs] of workflowSeed) {
    const wfId = newId('wf');
    db.prepare(
      `INSERT INTO workflows (id, name, description, status, trigger, runs, last_run_at, is_demo, created_at)
       VALUES (?, ?, ?, ?, 'lead.created', ?, ?, 1, ?)`,
    ).run(wfId, name, description, status, runs, status === 'active' ? day(0) : day(-9), day(-70));

    nodes.forEach(([type, label], index) => {
      db.prepare(
        `INSERT INTO workflow_nodes (id, workflow_id, type, label, config, x, y, sort_order)
         VALUES (?, ?, ?, ?, '{}', ?, ?, ?)`,
      ).run(newId('wn'), wfId, type, label, 40 + (index % 3) * 240, 40 + Math.floor(index / 3) * 150, index + 1);
    });
  }

  /* ── Proposals, outreach, follow-ups ──────────────────────── */
  db.prepare(
    `INSERT INTO proposals (id, client_id, lead_id, title, summary, amount, currency, status, valid_until, line_items, is_demo, created_at)
     VALUES (?, ?, NULL, ?, ?, ?, 'INR', 'sent', ?, ?, 1, ?)`,
  ).run(
    newId('pr'),
    logistics!.id,
    'Kanara Logistics — Growth System',
    'Website rebuild, lead engine, AI assistant and WhatsApp automation for enquiry handling.',
    145_000_00,
    dateOnly(14),
    JSON.stringify([
      { label: 'Website design and build', description: 'Multi-page site with booking flows', amount: 90_000_00 },
      { label: 'Lead engine + CRM', description: 'Capture, pipeline, analytics', amount: 30_000_00 },
      { label: 'AI assistant setup', description: 'Trained on your services', amount: 25_000_00 },
    ]),
    day(-9),
  );

  db.prepare(
    `INSERT INTO outreach_sequences (id, name, channel, status, contacts, replied, steps, is_demo, created_at)
     VALUES (?, ?, 'whatsapp', 'active', 120, 34, ?, 1, ?)`,
  ).run(
    newId('os'),
    'Local business outreach — Mangaluru',
    JSON.stringify([
      { label: 'Introduction', delay: 'Day 0', template: 'Hi {{name}}, we build websites that capture and follow up on enquiries automatically.' },
      { label: 'Value message', delay: 'Day 3', template: 'Quick example: a local clinic cut missed enquiries by automating WhatsApp follow-ups.' },
      { label: 'Offer', delay: 'Day 7', template: 'Would a free automation audit be useful this month?' },
    ]),
    day(-30),
  );

  db.prepare(
    `INSERT INTO follow_ups (id, lead_id, client_id, title, due_at, channel, status, notes, is_demo, created_at)
     VALUES (?, NULL, ?, ?, ?, 'whatsapp', 'pending', NULL, 1, ?)`,
  ).run(newId('fu'), dental!.id, 'Check in on the automation request', isoAt(1, 11), day(-1));

  /* ── Activity + notifications ─────────────────────────────── */
  const activitySeed: [string, string, string, number][] = [
    ['lead.created', 'New enquiry from website', 'Priya Menon — website form', -1],
    ['lead.qualified', 'AI qualified lead', 'Vikram Adiga · score 72', -1],
    ['crm.updated', 'CRM updated', 'Kanara Logistics pipeline refreshed', -2],
    ['team.notified', 'Team notified', 'Owner alerted on WhatsApp', -2],
    ['appointment.booked', 'Appointment booked', 'Kavya Rai · tomorrow 11:00', -3],
    ['followup.scheduled', 'Follow-up scheduled', 'Automated reminder queued', -3],
    ['workflow.activated', 'Workflow activated', 'Website enquiry → qualify → respond', -5],
    ['invoice.generated', 'Invoice NF-2026-0110 generated', 'Coastal Dental Studio', -6],
    ['project.updated', 'Project moved to development', 'Kanara Logistics — Growth System', -8],
    ['request.created', 'New client request', 'Automate review requests after appointments', -6],
  ];

  for (const [type, label, detail, offset] of activitySeed) {
    db.prepare(
      `INSERT INTO activity (id, type, label, detail, actor, actor_role, entity_type, entity_id, client_id, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, 'system', NULL, NULL, ?, 1, ?)`,
    ).run(newId('av'), type, label, detail, type === 'automation' ? 'NorthForge Automation' : 'NorthForge', dental!.id, isoAt(offset, 9));
  }

  const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
  if (adminUser) {
    const notifications: [string, string, string, string][] = [
      ['lead', 'New enquiry: Priya Menon', 'Website form · Bright Smiles', '/app/leads'],
      ['automation', 'Workflow executed', 'Website enquiry → qualify → respond ran successfully', '/app/workflows'],
      ['billing', 'Invoice NF-2026-0110 paid', 'Coastal Dental Studio · ₹2,361', '/app/invoices'],
      ['request', 'New client request', 'Automate review requests after appointments', '/app/requests'],
      ['system', 'System health check passed', 'All components operational', '/app/system-health'],
    ];
    notifications.forEach(([kind, title, body, href], index) => {
      db.prepare(
        `INSERT INTO notifications (id, user_id, kind, title, body, read, href, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(newId('nt'), adminUser.id, kind, title, body, index > 2 ? 1 : 0, href, isoAt(-index, 8));
    });
  }

  const clientUser = db.prepare("SELECT id FROM users WHERE role = 'client' LIMIT 1").get() as { id: string } | undefined;
  if (clientUser) {
    db.prepare(
      `INSERT INTO notifications (id, user_id, kind, title, body, read, href, created_at)
       VALUES (?, ?, 'lead', ?, ?, 0, '/portal/leads', ?)`,
    ).run(newId('nt'), clientUser.id, 'New enquiry: Priya Menon', 'Asked about appointments this weekend.', isoAt(-1, 9));
  }
}

/* ── Run ───────────────────────────────────────────────────────── */

console.log('[northforge] seeding database…');
seedAccounts();
resetBusinessData();

if (DEMO) {
  seedDemo();
  console.log('[northforge] demo dataset created (all records flagged is_demo = 1)');
} else {
  console.log('[northforge] clean seed — no business data created');
}

const counts = ['clients', 'leads', 'projects', 'tasks', 'websites', 'workflows', 'invoices']
  .map((t) => `${t}: ${(db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as { c: number }).c}`)
  .join(' · ');
console.log(`[northforge] ${counts}`);
console.log('[northforge] accounts:');
console.log('  admin@northforge.studio  / NorthForge@2026  (admin)');
console.log('  owner@northforge.studio  / NorthForge@2026  (super admin)');
if (DEMO) console.log('  client@northforge.studio / NorthForge@2026  (demo client — invented business)');
else console.log('  (no demo client login in a clean seed — register a real account at /register)');
