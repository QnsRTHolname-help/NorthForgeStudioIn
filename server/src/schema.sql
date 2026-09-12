-- ═══════════════════════════════════════════════════════════════
-- NORTHFORGE — PostgreSQL / Supabase schema
--
-- This is the canonical, production-intended schema (spec §82, §131).
-- `server/src/schema.sqlite.sql` is the SQLite projection used for local
-- development; the two are kept structurally identical (same table and
-- column names) so a migration is a data copy, not a rewrite.
--
-- Row Level Security is included below. Frontend guards are UX only —
-- these policies are the actual security boundary (spec §83).
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('client', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('new','qualified','contacted','proposal','won','lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_source as enum ('website','whatsapp','referral','outreach','manual','call','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_stage as enum ('discovery','design','development','review','launch','optimization');
exception when duplicate_object then null; end $$;

do $$ begin
  create type priority_level as enum ('low','medium','high','urgent');
exception when duplicate_object then null; end $$;

-- ── Identity ─────────────────────────────────────────────────────
create table if not exists clients (
  id                    text primary key default ('cl_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  business_name         text not null,
  contact_name          text not null,
  email                 text not null,
  phone                 text,
  business_type         text,
  city                  text,
  state                 text,
  plan_id               text,
  status                text not null default 'lead' check (status in ('lead','onboarding','active','paused','churned')),
  website_url           text,
  onboarding_step       integer not null default 0,
  onboarding_completed  boolean not null default false,
  notes                 text,
  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists users (
  id             text primary key default ('us_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  email          text not null unique,
  name           text not null,
  password_hash  text not null,
  role           user_role not null default 'client',
  client_id      text references clients(id) on delete set null,
  phone          text,
  avatar_url     text,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now()
,
  is_demo      boolean not null default false);
create index if not exists users_client_idx on users(client_id);

-- ── Sales ────────────────────────────────────────────────────────
create table if not exists leads (
  id               text primary key default ('ld_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id        text references clients(id) on delete set null,
  business_name    text,
  contact_name     text not null,
  email            text,
  phone            text,
  source           lead_source not null default 'website',
  status           lead_status not null default 'new',
  score            integer not null default 0 check (score between 0 and 100),
  value            integer,
  message          text,
  intent           text,
  next_action      text,
  owner_id         text references users(id) on delete set null,
  ai_summary       text,
  ai_qualification text,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists leads_client_idx on leads(client_id);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_created_idx on leads(created_at desc);

create table if not exists follow_ups (
  id         text primary key default ('fu_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  lead_id    text references leads(id) on delete cascade,
  client_id  text references clients(id) on delete cascade,
  title      text not null,
  due_at     timestamptz not null,
  channel    text not null default 'call' check (channel in ('call','whatsapp','email','meeting')),
  status     text not null default 'pending' check (status in ('pending','done','missed')),
  notes      text,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists followups_due_idx on follow_ups(due_at);

create table if not exists proposals (
  id          text primary key default ('pr_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id   text references clients(id) on delete cascade,
  lead_id     text references leads(id) on delete set null,
  title       text not null,
  summary     text,
  amount      integer not null default 0,
  currency    text not null default 'INR',
  status      text not null default 'draft' check (status in ('draft','sent','viewed','accepted','declined')),
  valid_until date,
  line_items  jsonb not null default '[]'::jsonb,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists outreach_sequences (
  id         text primary key default ('os_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  name       text not null,
  channel    text not null default 'email' check (channel in ('email','whatsapp','mixed')),
  status     text not null default 'draft' check (status in ('draft','active','paused','completed')),
  contacts   integer not null default 0,
  replied    integer not null default 0,
  steps      jsonb not null default '[]'::jsonb,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Delivery ─────────────────────────────────────────────────────
create table if not exists projects (
  id         text primary key default ('pj_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id  text not null references clients(id) on delete cascade,
  name       text not null,
  stage      project_stage not null default 'discovery',
  status     text not null default 'planning' check (status in ('planning','active','on_hold','completed','cancelled')),
  progress   integer not null default 0 check (progress between 0 and 100),
  start_date date,
  due_date   date,
  notes      text,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_client_idx on projects(client_id);

create table if not exists tasks (
  id          text primary key default ('tk_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  title       text not null,
  description text,
  status      text not null default 'todo' check (status in ('todo','in_progress','review','done')),
  priority    priority_level not null default 'medium',
  project_id  text references projects(id) on delete cascade,
  client_id   text references clients(id) on delete cascade,
  assignee_id text references users(id) on delete set null,
  due_date    date,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists tasks_client_idx on tasks(client_id);

create table if not exists websites (
  id               text primary key default ('wb_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id        text not null references clients(id) on delete cascade,
  name             text not null,
  domain           text,
  url              text,
  status           text not null default 'draft' check (status in ('draft','building','review','live','paused','offline')),
  deployment       text not null default 'pending' check (deployment in ('pending','building','live','failed')),
  ssl              boolean not null default false,
  hosting          text,
  framework        text,
  last_deployed_at timestamptz,
  last_updated_at  timestamptz,
  maintenance      boolean not null default false,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists websites_client_idx on websites(client_id);

create table if not exists website_analytics (
  id              text primary key default ('wa_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  website_id      text not null references websites(id) on delete cascade,
  date            date not null,
  visitors        integer not null default 0,
  sessions        integer not null default 0,
  leads           integer not null default 0,
  whatsapp_clicks integer not null default 0,
  bookings        integer not null default 0,
  unique (website_id, date)
);

create table if not exists bookings (
  id             text primary key default ('bk_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id      text not null references clients(id) on delete cascade,
  customer_name  text not null,
  customer_phone text,
  email          text,
  service        text,
  starts_at      timestamptz not null,
  duration_mins  integer not null default 30,
  status         text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled','no_show')),
  reminder_sent  boolean not null default false,
  notes          text,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists bookings_client_idx on bookings(client_id);
create index if not exists bookings_starts_idx on bookings(starts_at);

-- ── Billing ──────────────────────────────────────────────────────
create table if not exists subscriptions (
  id         text primary key default ('sb_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id  text not null references clients(id) on delete cascade,
  plan_id    text not null,
  status     text not null default 'active' check (status in ('trialing','active','past_due','paused','cancelled')),
  started_at timestamptz not null default now(),
  renews_at  timestamptz,
  cancel_at  timestamptz,
  seats      integer not null default 1,
  is_demo    boolean not null default false
);
create index if not exists subscriptions_client_idx on subscriptions(client_id);

create table if not exists invoices (
  id              text primary key default ('in_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  number          text not null unique,
  client_id       text not null references clients(id) on delete cascade,
  subscription_id text references subscriptions(id) on delete set null,
  amount          integer not null default 0,
  tax             integer not null default 0,
  total           integer not null default 0,
  currency        text not null default 'INR',
  status          text not null default 'draft' check (status in ('draft','open','paid','void','uncollectible')),
  issued_at       timestamptz not null default now(),
  due_at          timestamptz not null,
  paid_at         timestamptz,
  line_items      jsonb not null default '[]'::jsonb,
  is_demo         boolean not null default false
);
create index if not exists invoices_client_idx on invoices(client_id);

create table if not exists payments (
  id         text primary key default ('pm_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  invoice_id text references invoices(id) on delete set null,
  client_id  text not null references clients(id) on delete cascade,
  amount     integer not null default 0,
  currency   text not null default 'INR',
  status     text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  method     text,
  paid_at    timestamptz not null default now(),
  is_demo    boolean not null default false
);
create index if not exists payments_client_idx on payments(client_id);

-- ── Automation ───────────────────────────────────────────────────
create table if not exists workflows (
  id          text primary key default ('wf_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  name        text not null,
  description text,
  status      text not null default 'draft' check (status in ('draft','active','paused','error')),
  trigger     text not null default 'lead.created',
  runs        integer not null default 0,
  last_run_at timestamptz,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists workflow_nodes (
  id         text primary key default ('wn_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  workflow_id text not null references workflows(id) on delete cascade,
  type       text not null,
  label      text not null,
  config     jsonb not null default '{}'::jsonb,
  x          integer not null default 0,
  y          integer not null default 0,
  sort_order integer not null default 0
);
create index if not exists workflow_nodes_wf_idx on workflow_nodes(workflow_id);

create table if not exists whatsapp_templates (
  id        text primary key default ('wt_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  name      text not null,
  category  text not null default 'utility' check (category in ('utility','marketing','authentication')),
  body      text not null,
  status    text not null default 'pending' check (status in ('approved','pending','rejected')),
  language  text not null default 'en',
  uses      integer not null default 0,
  is_demo   boolean not null default false
);

create table if not exists whatsapp_messages (
  id          text primary key default ('wm_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id   text references clients(id) on delete cascade,
  direction   text not null check (direction in ('inbound','outbound')),
  to_number   text not null,
  body        text not null,
  status      text not null default 'queued' check (status in ('queued','sent','delivered','read','failed')),
  template_id text references whatsapp_templates(id) on delete set null,
  automated   boolean not null default false,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists ai_assistants (
  id             text primary key default ('ai_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  name           text not null,
  scope          text not null check (scope in ('public','client','admin')),
  status         text not null default 'active' check (status in ('active','paused','training')),
  model          text not null default 'northforge-local',
  description    text not null default '',
  purpose        text not null default '',
  conversations  integer not null default 0,
  success_rate   numeric(5,2),
  last_active_at timestamptz,
  is_demo        boolean not null default false
);

create table if not exists ai_conversations (
  id         text primary key default ('ac_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  user_id    text references users(id) on delete cascade,
  scope      text not null,
  title      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_messages (
  id              text primary key default ('am_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  conversation_id text not null references ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

-- ── Support & system ─────────────────────────────────────────────
create table if not exists client_requests (
  id          text primary key default ('rq_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id   text not null references clients(id) on delete cascade,
  title       text not null,
  description text not null default '',
  type        text not null default 'general' check (type in ('website_change','content_change','technical_issue','automation','general')),
  priority    priority_level not null default 'medium',
  status      text not null default 'open' check (status in ('open','in_progress','blocked','resolved','closed')),
  attachments jsonb not null default '[]'::jsonb,
  activity    jsonb not null default '[]'::jsonb,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists requests_client_idx on client_requests(client_id);

create table if not exists tickets (
  id         text primary key default ('tc_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id  text references clients(id) on delete cascade,
  subject    text not null,
  status     text not null default 'open' check (status in ('open','pending','resolved','closed')),
  priority   priority_level not null default 'medium',
  category   text,
  messages   jsonb not null default '[]'::jsonb,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_client_idx on tickets(client_id);

create table if not exists activity (
  id          text primary key default ('av_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  type        text not null,
  label       text not null,
  detail      text,
  actor       text not null default 'System',
  actor_role  text not null default 'system',
  entity_type text,
  entity_id   text,
  client_id   text references clients(id) on delete cascade,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists activity_created_idx on activity(created_at desc);
create index if not exists activity_client_idx on activity(client_id);

create table if not exists notifications (
  id          text primary key default ('nt_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  user_id     text not null references users(id) on delete cascade,
  kind        text not null default 'system',
  title       text not null,
  body        text,
  read        boolean not null default false,
  href        text,
  entity_type text,
  entity_id   text,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, read);

create table if not exists onboarding_drafts (
  id           text primary key default ('ob_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id    text references clients(id) on delete cascade,
  user_id      text references users(id) on delete cascade,
  current_step integer not null default 0,
  completed    boolean not null default false,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (spec §82)
--
-- Model: `app_is_admin()` checks a JWT claim, never a client-supplied
-- value. Clients may only ever see rows whose client_id equals the
-- client_id embedded in their token (or rows they own).
-- ═══════════════════════════════════════════════════════════════

alter table clients            enable row level security;
alter table users              enable row level security;
alter table leads              enable row level security;
alter table follow_ups         enable row level security;
alter table proposals          enable row level security;
alter table projects           enable row level security;
alter table tasks              enable row level security;
alter table websites           enable row level security;
alter table website_analytics  enable row level security;
alter table bookings           enable row level security;
alter table subscriptions      enable row level security;
alter table invoices           enable row level security;
alter table payments           enable row level security;
alter table client_requests    enable row level security;
alter table tickets            enable row level security;
alter table activity           enable row level security;
alter table notifications      enable row level security;
alter table whatsapp_messages  enable row level security;
alter table onboarding_drafts  enable row level security;

create or replace function app_role() returns text
  language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
      'anonymous'
    );
  $$;

create or replace function app_client_id() returns text
  language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'client_id', '');
  $$;

create or replace function app_user_id() returns text
  language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '');
  $$;

create or replace function app_is_admin() returns boolean
  language sql stable as $$ select app_role() in ('admin','super_admin'); $$;

-- Helper predicate: admin sees everything; clients see only their own.
create or replace function app_can_see(row_client_id text) returns boolean
  language sql stable as $$
    select case
      when app_is_admin() then true
      when row_client_id is null then false
      else row_client_id = app_client_id()
    end;
  $$;

-- Client-scoped tables
create policy clients_self_or_admin on clients
  for select using (app_is_admin() or id = app_client_id());
create policy clients_admin_write on clients
  for all using (app_is_admin()) with check (app_is_admin());

create policy leads_scope on leads
  for select using (app_can_see(client_id));
create policy leads_admin_write on leads
  for all using (app_is_admin()) with check (app_is_admin());

create policy followups_scope on follow_ups
  for select using (app_can_see(client_id) or (lead_id is not null and app_is_admin()));
create policy followups_admin_write on follow_ups
  for all using (app_is_admin()) with check (app_is_admin());

create policy proposals_scope on proposals
  for select using (app_can_see(client_id));
create policy proposals_admin_write on proposals
  for all using (app_is_admin()) with check (app_is_admin());

create policy projects_scope on projects
  for select using (app_can_see(client_id));
create policy projects_admin_write on projects
  for all using (app_is_admin()) with check (app_is_admin());

create policy tasks_scope on tasks
  for select using (app_can_see(client_id));
create policy tasks_admin_write on tasks
  for all using (app_is_admin()) with check (app_is_admin());

create policy websites_scope on websites
  for select using (app_can_see(client_id));
create policy websites_admin_write on websites
  for all using (app_is_admin()) with check (app_is_admin());

create policy analytics_scope on website_analytics
  for select using (
    exists (select 1 from websites w where w.id = website_analytics.website_id and app_can_see(w.client_id))
  );
create policy analytics_admin_write on website_analytics
  for all using (app_is_admin()) with check (app_is_admin());

create policy bookings_scope on bookings
  for select using (app_can_see(client_id));
create policy bookings_admin_write on bookings
  for all using (app_is_admin()) with check (app_is_admin());

create policy subscriptions_scope on subscriptions
  for select using (app_can_see(client_id));
create policy subscriptions_admin_write on subscriptions
  for all using (app_is_admin()) with check (app_is_admin());

create policy invoices_scope on invoices
  for select using (app_can_see(client_id));
create policy invoices_admin_write on invoices
  for all using (app_is_admin()) with check (app_is_admin());

create policy payments_scope on payments
  for select using (app_can_see(client_id));
create policy payments_admin_write on payments
  for all using (app_is_admin()) with check (app_is_admin());

create policy requests_scope on client_requests
  for select using (app_can_see(client_id));
create policy requests_client_insert on client_requests
  for insert with check (client_id = app_client_id());
create policy requests_admin_write on client_requests
  for all using (app_is_admin()) with check (app_is_admin());

create policy tickets_scope on tickets
  for select using (app_can_see(client_id));
create policy tickets_admin_write on tickets
  for all using (app_is_admin()) with check (app_is_admin());

create policy activity_scope on activity
  for select using (app_can_see(client_id));
create policy activity_admin_write on activity
  for insert with check (app_is_admin());

create policy notifications_own on notifications
  for all using (user_id = app_user_id()) with check (user_id = app_user_id());

create policy whatsapp_scope on whatsapp_messages
  for select using (app_can_see(client_id));
create policy whatsapp_admin_write on whatsapp_messages
  for all using (app_is_admin()) with check (app_is_admin());

create policy users_self_or_admin on users
  for select using (app_is_admin() or id = app_user_id());
create policy users_admin_write on users
  for all using (app_is_admin()) with check (app_is_admin());

create policy onboarding_scope on onboarding_drafts
  for all using (app_is_admin() or user_id = app_user_id())
  with check (app_is_admin() or user_id = app_user_id());

-- ── Email outbox ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_outbox (
  id          TEXT PRIMARY KEY,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  template    TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',
  transport   TEXT,
  error       TEXT,
  meta        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL,
  sent_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS email_outbox_created_idx ON email_outbox (created_at DESC);

-- ── Webhooks ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  secret      TEXT NOT NULL,
  events      JSONB NOT NULL DEFAULT '[]',
  status      TEXT NOT NULL DEFAULT 'active',
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              TEXT PRIMARY KEY,
  webhook_id      TEXT REFERENCES webhooks(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  response_status INTEGER,
  response_body   TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_idx ON webhook_deliveries (webhook_id, created_at DESC);

-- ── API keys ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  prefix        TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  scopes        JSONB NOT NULL DEFAULT '["read"]',
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys (prefix);

