/* Generated from server/src/schema.sqlite.sql — do not edit directly. */
export const SCHEMA_SQL = `
-- SQLite projection of the NorthForge schema (local development).
-- Structurally identical to server/src/schema.sql (Postgres/Supabase).
-- Authorization enforced in application code by server/src/auth/scope.ts,
-- which mirrors the RLS predicates in the Postgres file.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clients (
  id                   TEXT PRIMARY KEY,
  business_name        TEXT NOT NULL,
  contact_name         TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT,
  business_type        TEXT,
  city                 TEXT,
  state                TEXT,
  plan_id              TEXT,
  status               TEXT NOT NULL DEFAULT 'lead',
  website_url          TEXT,
  onboarding_step      INTEGER NOT NULL DEFAULT 0,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  is_demo              INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'client',
  client_id     TEXT REFERENCES clients(id) ON DELETE SET NULL,
  phone         TEXT,
  avatar_url    TEXT,
  last_login_at TEXT,
  created_at    TEXT NOT NULL,
  /** 1 for accounts that only exist to demonstrate the product. */
  is_demo       INTEGER NOT NULL DEFAULT 0,
  /** TOTP second factor. Secret exists but enabled=0 → enrolment in progress. */
  totp_secret   TEXT,
  totp_enabled  INTEGER NOT NULL DEFAULT 0,
  /** Set once the signup email address is confirmed. */
  email_confirmed_at TEXT
);


CREATE INDEX IF NOT EXISTS users_client_idx ON users(client_id);

CREATE TABLE IF NOT EXISTS leads (
  id               TEXT PRIMARY KEY,
  client_id        TEXT REFERENCES clients(id) ON DELETE SET NULL,
  business_name    TEXT,
  contact_name     TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  source           TEXT NOT NULL DEFAULT 'website',
  status           TEXT NOT NULL DEFAULT 'new',
  score            INTEGER NOT NULL DEFAULT 0,
  value            INTEGER,
  message          TEXT,
  intent           TEXT,
  next_action      TEXT,
  owner_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  ai_summary       TEXT,
  ai_qualification TEXT,
  is_demo          INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_client_idx ON leads(client_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at DESC);

CREATE TABLE IF NOT EXISTS follow_ups (
  id         TEXT PRIMARY KEY,
  lead_id    TEXT REFERENCES leads(id) ON DELETE CASCADE,
  client_id  TEXT REFERENCES clients(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  due_at     TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT 'call',
  status     TEXT NOT NULL DEFAULT 'pending',
  notes      TEXT,
  is_demo    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS followups_due_idx ON follow_ups(due_at);

CREATE TABLE IF NOT EXISTS proposals (
  id         TEXT PRIMARY KEY,
  client_id  TEXT REFERENCES clients(id) ON DELETE CASCADE,
  lead_id    TEXT REFERENCES leads(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  summary    TEXT,
  amount     INTEGER NOT NULL DEFAULT 0,
  currency   TEXT NOT NULL DEFAULT 'INR',
  status     TEXT NOT NULL DEFAULT 'draft',
  valid_until TEXT,
  line_items TEXT NOT NULL DEFAULT '[]',
  is_demo    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_sequences (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT 'email',
  status     TEXT NOT NULL DEFAULT 'draft',
  contacts   INTEGER NOT NULL DEFAULT 0,
  replied    INTEGER NOT NULL DEFAULT 0,
  steps      TEXT NOT NULL DEFAULT '[]',
  is_demo    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  stage      TEXT NOT NULL DEFAULT 'discovery',
  status     TEXT NOT NULL DEFAULT 'planning',
  progress   INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  due_date   TEXT,
  notes      TEXT,
  is_demo    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_client_idx ON projects(client_id);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'todo',
  priority    TEXT NOT NULL DEFAULT 'medium',
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  client_id   TEXT REFERENCES clients(id) ON DELETE CASCADE,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  due_date    TEXT,
  is_demo     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_client_idx ON tasks(client_id);

CREATE TABLE IF NOT EXISTS websites (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  domain           TEXT,
  url              TEXT,
  status           TEXT NOT NULL DEFAULT 'draft',
  deployment       TEXT NOT NULL DEFAULT 'pending',
  ssl              INTEGER NOT NULL DEFAULT 0,
  hosting          TEXT,
  framework        TEXT,
  last_deployed_at TEXT,
  last_updated_at  TEXT,
  maintenance      INTEGER NOT NULL DEFAULT 0,
  is_demo          INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS websites_client_idx ON websites(client_id);

CREATE TABLE IF NOT EXISTS website_analytics (
  id              TEXT PRIMARY KEY,
  website_id      TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  date            TEXT NOT NULL,
  visitors        INTEGER NOT NULL DEFAULT 0,
  sessions        INTEGER NOT NULL DEFAULT 0,
  leads           INTEGER NOT NULL DEFAULT 0,
  whatsapp_clicks INTEGER NOT NULL DEFAULT 0,
  bookings        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (website_id, date)
);

CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_name  TEXT NOT NULL,
  customer_phone TEXT,
  email          TEXT,
  service        TEXT,
  starts_at      TEXT NOT NULL,
  duration_mins  INTEGER NOT NULL DEFAULT 30,
  status         TEXT NOT NULL DEFAULT 'pending',
  reminder_sent  INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  is_demo        INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_client_idx ON bookings(client_id);
CREATE INDEX IF NOT EXISTS bookings_starts_idx ON bookings(starts_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  id         TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  renews_at  TEXT,
  cancel_at  TEXT,
  seats      INTEGER NOT NULL DEFAULT 1,
  is_demo    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS subscriptions_client_idx ON subscriptions(client_id);

CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY,
  number          TEXT NOT NULL UNIQUE,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount          INTEGER NOT NULL DEFAULT 0,
  tax             INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'INR',
  status          TEXT NOT NULL DEFAULT 'draft',
  issued_at       TEXT NOT NULL,
  due_at          TEXT NOT NULL,
  paid_at         TEXT,
  line_items      TEXT NOT NULL DEFAULT '[]',
  is_demo         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS invoices_client_idx ON invoices(client_id);

CREATE TABLE IF NOT EXISTS payments (
  id         TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  client_id  TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL DEFAULT 0,
  currency   TEXT NOT NULL DEFAULT 'INR',
  status     TEXT NOT NULL DEFAULT 'pending',
  method     TEXT,
  paid_at    TEXT NOT NULL,
  is_demo    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS payments_client_idx ON payments(client_id);

CREATE TABLE IF NOT EXISTS workflows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',
  trigger     TEXT NOT NULL DEFAULT 'lead.created',
  runs        INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  is_demo     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_nodes (
  id          TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  label       TEXT NOT NULL,
  config      TEXT NOT NULL DEFAULT '{}',
  x           INTEGER NOT NULL DEFAULT 0,
  y           INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS workflow_nodes_wf_idx ON workflow_nodes(workflow_id);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'utility',
  body     TEXT NOT NULL,
  status   TEXT NOT NULL DEFAULT 'pending',
  language TEXT NOT NULL DEFAULT 'en',
  uses     INTEGER NOT NULL DEFAULT 0,
  is_demo  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id          TEXT PRIMARY KEY,
  client_id   TEXT REFERENCES clients(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL,
  to_number   TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',
  template_id TEXT REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  automated   INTEGER NOT NULL DEFAULT 0,
  is_demo     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS activity (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  label       TEXT NOT NULL,
  detail      TEXT,
  actor       TEXT NOT NULL DEFAULT 'System',
  actor_role  TEXT NOT NULL DEFAULT 'system',
  entity_type TEXT,
  entity_id   TEXT,
  client_id   TEXT REFERENCES clients(id) ON DELETE CASCADE,
  is_demo     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_created_idx ON activity(created_at DESC);
CREATE INDEX IF NOT EXISTS activity_client_idx ON activity(client_id);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'system',
  title       TEXT NOT NULL,
  body        TEXT,
  read        INTEGER NOT NULL DEFAULT 0,
  href        TEXT,
  entity_type TEXT,
  entity_id   TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read);

CREATE TABLE IF NOT EXISTS client_requests (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'general',
  priority    TEXT NOT NULL DEFAULT 'medium',
  status      TEXT NOT NULL DEFAULT 'open',
  attachments TEXT NOT NULL DEFAULT '[]',
  activity    TEXT NOT NULL DEFAULT '[]',
  is_demo     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_client_idx ON client_requests(client_id);

CREATE TABLE IF NOT EXISTS tickets (
  id         TEXT PRIMARY KEY,
  client_id  TEXT REFERENCES clients(id) ON DELETE CASCADE,
  subject    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open',
  priority   TEXT NOT NULL DEFAULT 'medium',
  category   TEXT,
  messages   TEXT NOT NULL DEFAULT '[]',
  is_demo    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tickets_client_idx ON tickets(client_id);

CREATE TABLE IF NOT EXISTS onboarding_drafts (
  id           TEXT PRIMARY KEY,
  client_id    TEXT REFERENCES clients(id) ON DELETE CASCADE,
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  completed    INTEGER NOT NULL DEFAULT 0,
  data         TEXT NOT NULL DEFAULT '{}',
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id          TEXT PRIMARY KEY,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  template    TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',
  transport   TEXT,
  error       TEXT,
  meta        TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  sent_at     TEXT
);
CREATE INDEX IF NOT EXISTS email_outbox_created_idx ON email_outbox(created_at DESC);

CREATE TABLE IF NOT EXISTS webhooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  secret      TEXT NOT NULL,
  events      TEXT NOT NULL DEFAULT '[]',
  status      TEXT NOT NULL DEFAULT 'active',
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              TEXT PRIMARY KEY,
  webhook_id      TEXT REFERENCES webhooks(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  payload         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  response_status INTEGER,
  response_body   TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  duration_ms     INTEGER,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_idx ON webhook_deliveries(webhook_id, created_at DESC);

CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  prefix        TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  scopes        TEXT NOT NULL DEFAULT '["read"]',
  last_used_at  TEXT,
  expires_at    TEXT,
  revoked_at    TEXT,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys(prefix);
`;
