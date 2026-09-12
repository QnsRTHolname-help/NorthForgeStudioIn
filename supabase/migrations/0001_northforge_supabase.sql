-- =========================================================
-- NORTHFORGE — Supabase migration 0001
--
-- Adapted from the canonical PostgreSQL schema for Supabase Auth
-- as the source of truth for credentials:
--
--   * Supabase Auth owns authentication (emails + passwords).
--   * `profiles` owns application identity: role + client linkage.
--   * A trigger provisions a profile (and client workspace) on signup.
--   * RLS derives role/client from `profiles` via auth.uid() — never
--     from anything the browser sends.
--   * PUBLIC signup can only ever create role 'client'.
--
-- Non-destructive: only CREATE / CREATE OR REPLACE statements.
-- Safe to re-run. No existing tables are dropped.
-- =========================================================

create extension if not exists "pgcrypto";

-- ── Enums ──
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

-- ── Shared triggers ──
create or replace function set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Identity: clients ──
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

drop trigger if exists clients_updated_at on clients;
create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();

-- ── Identity: profiles (Supabase Auth ↔ application) ──
-- One profile per auth user. `id` equals `auth.users.id`. Credentials
-- (passwords, email verification) live ONLY in Supabase Auth.
create table if not exists profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  name           text not null default '',
  role           user_role not null default 'client',
  client_id      text references clients(id) on delete set null,
  phone          text,
  avatar_url     text,
  last_login_at  timestamptz,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists profiles_client_idx on profiles(client_id);

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Keep the denormalised email in sync with Supabase Auth.
create or replace function sync_profile_email() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists auth_users_email_sync on auth.users;
create trigger auth_users_email_sync after update of email on auth.users
  for each row execute function sync_profile_email();

-- ── Signup provisioning (spec §15, §16, §17) ──
-- Runs server-side on every new auth user. PUBLIC signup metadata may
-- only ever create role 'client'. Privileged accounts are provisioned
-- by an operator in the Supabase dashboard or via SQL as the service role.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  requested_role text;
  business text;
  new_client_id text;
begin
  requested_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'client');

  -- Hard rule: public signup can never self-assign a privileged role.
  if requested_role not in ('client') then
    requested_role := 'client';
  end if;

  business := nullif(new.raw_user_meta_data ->> 'business_name', '');

  if business is not null then
    insert into clients (business_name, contact_name, email, phone, business_type, status)
    values (
      business,
      coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
      new.email,
      nullif(new.raw_user_meta_data ->> 'phone', ''),
      nullif(new.raw_user_meta_data ->> 'business_type', ''),
      'onboarding'
    )
    returning id into new_client_id;
  end if;

  insert into public.profiles (id, email, name, role, client_id, phone)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    requested_role::user_role,
    new_client_id,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- A client user may keep their own business profile accurate, but must
-- never be able to move themselves to another client or another role.
create or replace function guard_profile_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then
    new.role = old.role;
    new.client_id = old.client_id;
    new.is_demo = old.is_demo;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_update on profiles;
create trigger profiles_guard_update before update on profiles
  for each row execute function guard_profile_update();

-- ── RLS context helpers ──
-- Identity comes from the authenticated JWT (auth.uid()) joined to
-- `profiles`. security definer avoids RLS recursion when reading
-- profiles from inside policies.

create or replace function app_user_id() returns uuid
  language sql stable as $$ select auth.uid() $$;

create or replace function app_profile_client_id() returns text
  language sql stable security definer set search_path = public as $$
    select client_id from profiles where id = auth.uid()
  $$;

create or replace function app_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (
      select 1 from profiles where id = auth.uid() and role in ('admin','super_admin')
    )
  $$;

-- Core predicate: admin sees everything; clients see only their own.
create or replace function app_can_see(row_client_id text) returns boolean
  language sql stable security definer set search_path = public as $$
    select case
      when app_is_admin() then true
      when row_client_id is null then false
      else row_client_id = app_profile_client_id()
    end
  $$;

-- ── Sales ──
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
  owner_id         uuid references auth.users(id) on delete set null,
  ai_summary       text,
  ai_qualification text,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists leads_client_idx on leads(client_id);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_created_idx on leads(created_at desc);

drop trigger if exists leads_updated_at on leads;
create trigger leads_updated_at before update on leads
  for each row execute function set_updated_at();

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

-- ── Delivery ──
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

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();

create table if not exists tasks (
  id          text primary key default ('tk_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  title       text not null,
  description text,
  status      text not null default 'todo' check (status in ('todo','in_progress','review','done')),
  priority    priority_level not null default 'medium',
  project_id  text references projects(id) on delete cascade,
  client_id   text references clients(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date    date,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists tasks_client_idx on tasks(client_id);

drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

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

-- ── Billing ──
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

-- ── Automation ──
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
  id          text primary key default ('wn_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  workflow_id text not null references workflows(id) on delete cascade,
  type        text not null,
  label       text not null,
  config      jsonb not null default '{}'::jsonb,
  x           integer not null default 0,
  y           integer not null default 0,
  sort_order  integer not null default 0
);
create index if not exists workflow_nodes_wf_idx on workflow_nodes(workflow_id);

create table if not exists whatsapp_templates (
  id      text primary key default ('wt_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  name    text not null,
  category text not null default 'utility' check (category in ('utility','marketing','authentication')),
  body    text not null,
  status  text not null default 'pending' check (status in ('approved','pending','rejected')),
  language text not null default 'en',
  uses    integer not null default 0,
  is_demo boolean not null default false
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
create index if not exists whatsapp_client_idx on whatsapp_messages(client_id);

-- ── AI (schema only — no chatbot exposed in the product yet, spec §79) ──
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
  user_id    uuid references auth.users(id) on delete cascade,
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

-- ── Support & system ──
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

drop trigger if exists requests_updated_at on client_requests;
create trigger requests_updated_at before update on client_requests
  for each row execute function set_updated_at();

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

drop trigger if exists tickets_updated_at on tickets;
create trigger tickets_updated_at before update on tickets
  for each row execute function set_updated_at();

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
  user_id     uuid not null references auth.users(id) on delete cascade,
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
  user_id      uuid references auth.users(id) on delete cascade,
  current_step integer not null default 0,
  completed    boolean not null default false,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

drop trigger if exists onboarding_updated_at on onboarding_drafts;
create trigger onboarding_updated_at before update on onboarding_drafts
  for each row execute function set_updated_at();

-- ── Public enquiries (contact form, spec §38) ──
create table if not exists enquiries (
  id                text primary key default ('eq_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  name              text not null,
  business_name     text,
  email             text not null,
  whatsapp          text,
  business_type     text,
  current_tools     text,
  bottleneck        text,
  monthly_enquiries text,
  message           text,
  status            text not null default 'new' check (status in ('new','contacted','converted','archived')),
  created_at        timestamptz not null default now()
);
create index if not exists enquiries_created_idx on enquiries(created_at desc);

-- ── Email outbox / webhooks / API keys (admin-only ops tables) ──
create table if not exists email_outbox (
  id          text primary key,
  to_email    text not null,
  subject     text not null,
  body        text not null,
  template    text,
  status      text not null default 'queued',
  transport   text,
  error       text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null,
  sent_at     timestamptz
);
create index if not exists email_outbox_created_idx on email_outbox (created_at desc);

create table if not exists webhooks (
  id          text primary key,
  name        text not null,
  url         text not null,
  secret      text not null,
  events      jsonb not null default '[]'::jsonb,
  status      text not null default 'active',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null,
  updated_at  timestamptz not null
);

create table if not exists webhook_deliveries (
  id              text primary key,
  webhook_id      text references webhooks(id) on delete cascade,
  event           text not null,
  payload         jsonb not null,
  status          text not null default 'pending',
  response_status integer,
  response_body   text,
  attempts        integer not null default 0,
  error           text,
  duration_ms     integer,
  created_at      timestamptz not null
);
create index if not exists webhook_deliveries_webhook_idx on webhook_deliveries (webhook_id, created_at desc);

create table if not exists api_keys (
  id           text primary key,
  name         text not null,
  prefix       text not null,
  key_hash     text not null,
  scopes       jsonb not null default '["read"]'::jsonb,
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null
);
create index if not exists api_keys_prefix_idx on api_keys (prefix);

-- =========================================================
-- ROW LEVEL SECURITY (spec §21, §22, §23)
-- The database is the security boundary. Frontend guards are UX only.
-- =========================================================

alter table clients            enable row level security;
alter table profiles           enable row level security;
alter table leads              enable row level security;
alter table follow_ups         enable row level security;
alter table proposals          enable row level security;
alter table outreach_sequences enable row level security;
alter table projects           enable row level security;
alter table tasks              enable row level security;
alter table websites           enable row level security;
alter table website_analytics  enable row level security;
alter table bookings           enable row level security;
alter table subscriptions      enable row level security;
alter table invoices           enable row level security;
alter table payments           enable row level security;
alter table workflows          enable row level security;
alter table workflow_nodes     enable row level security;
alter table whatsapp_templates enable row level security;
alter table whatsapp_messages  enable row level security;
alter table ai_assistants      enable row level security;
alter table ai_conversations   enable row level security;
alter table ai_messages        enable row level security;
alter table client_requests    enable row level security;
alter table tickets            enable row level security;
alter table activity           enable row level security;
alter table notifications      enable row level security;
alter table onboarding_drafts  enable row level security;
alter table enquiries          enable row level security;
alter table email_outbox       enable row level security;
alter table webhooks           enable row level security;
alter table webhook_deliveries enable row level security;
alter table api_keys           enable row level security;

-- Profiles: read/update own; admin reads all; only admin may change roles.
drop policy if exists profiles_self_select on profiles;
create policy profiles_self_select on profiles
  for select using (id = app_user_id() or app_is_admin());

drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles
  for update using (id = app_user_id() or app_is_admin())
  with check (id = app_user_id() or app_is_admin());

-- Clients: self or admin (spec §47).
drop policy if exists clients_self_or_admin on clients;
create policy clients_self_or_admin on clients
  for select using (app_is_admin() or id = app_profile_client_id());

drop policy if exists clients_self_update on clients;
create policy clients_self_update on clients
  for update using (id = app_profile_client_id())
  with check (id = app_profile_client_id());

drop policy if exists clients_admin_write on clients;
create policy clients_admin_write on clients
  for all using (app_is_admin()) with check (app_is_admin());

-- Client-scoped tables: read own, admin full control.
drop policy if exists leads_scope on leads;
create policy leads_scope on leads
  for select using (app_can_see(client_id));
drop policy if exists leads_admin_write on leads;
create policy leads_admin_write on leads
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists followups_scope on follow_ups;
create policy followups_scope on follow_ups
  for select using (app_can_see(client_id));
drop policy if exists followups_admin_write on follow_ups;
create policy followups_admin_write on follow_ups
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists proposals_scope on proposals;
create policy proposals_scope on proposals
  for select using (app_can_see(client_id));
drop policy if exists proposals_admin_write on proposals;
create policy proposals_admin_write on proposals
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists outreach_admin_only on outreach_sequences;
create policy outreach_admin_only on outreach_sequences
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists projects_scope on projects;
create policy projects_scope on projects
  for select using (app_can_see(client_id));
drop policy if exists projects_admin_write on projects;
create policy projects_admin_write on projects
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists tasks_scope on tasks;
create policy tasks_scope on tasks
  for select using (app_can_see(client_id));
drop policy if exists tasks_admin_write on tasks;
create policy tasks_admin_write on tasks
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists websites_scope on websites;
create policy websites_scope on websites
  for select using (app_can_see(client_id));
drop policy if exists websites_admin_write on websites;
create policy websites_admin_write on websites
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists analytics_scope on website_analytics;
create policy analytics_scope on website_analytics
  for select using (
    exists (select 1 from websites w where w.id = website_analytics.website_id and app_can_see(w.client_id))
  );
drop policy if exists analytics_admin_write on website_analytics;
create policy analytics_admin_write on website_analytics
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists bookings_scope on bookings;
create policy bookings_scope on bookings
  for select using (app_can_see(client_id));
drop policy if exists bookings_admin_write on bookings;
create policy bookings_admin_write on bookings
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists subscriptions_scope on subscriptions;
create policy subscriptions_scope on subscriptions
  for select using (app_can_see(client_id));
drop policy if exists subscriptions_admin_write on subscriptions;
create policy subscriptions_admin_write on subscriptions
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists invoices_scope on invoices;
create policy invoices_scope on invoices
  for select using (app_can_see(client_id));
drop policy if exists invoices_admin_write on invoices;
create policy invoices_admin_write on invoices
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists payments_scope on payments;
create policy payments_scope on payments
  for select using (app_can_see(client_id));
drop policy if exists payments_admin_write on payments;
create policy payments_admin_write on payments
  for all using (app_is_admin()) with check (app_is_admin());

-- Workflows & WhatsApp: admin builds and manages (nothing client-visible yet).
drop policy if exists workflows_admin on workflows;
create policy workflows_admin on workflows
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists workflow_nodes_admin on workflow_nodes;
create policy workflow_nodes_admin on workflow_nodes
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists whatsapp_templates_admin on whatsapp_templates;
create policy whatsapp_templates_admin on whatsapp_templates
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists whatsapp_scope on whatsapp_messages;
create policy whatsapp_scope on whatsapp_messages
  for select using (app_can_see(client_id));
drop policy if exists whatsapp_admin_write on whatsapp_messages;
create policy whatsapp_admin_write on whatsapp_messages
  for all using (app_is_admin()) with check (app_is_admin());

-- AI tables: schema exists for the future Copilot; nothing is exposed yet.
drop policy if exists ai_assistants_admin on ai_assistants;
create policy ai_assistants_admin on ai_assistants
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists ai_conversations_own on ai_conversations;
create policy ai_conversations_own on ai_conversations
  for all using (user_id = app_user_id()) with check (user_id = app_user_id());

drop policy if exists ai_messages_own on ai_messages;
create policy ai_messages_own on ai_messages
  for all using (
    exists (select 1 from ai_conversations c
            where c.id = ai_messages.conversation_id and c.user_id = app_user_id())
  ) with check (
    exists (select 1 from ai_conversations c
            where c.id = ai_messages.conversation_id and c.user_id = app_user_id())
  );

-- Requests: client can create + read own; admin manages everything.
drop policy if exists requests_scope on client_requests;
create policy requests_scope on client_requests
  for select using (app_can_see(client_id));
drop policy if exists requests_client_insert on client_requests;
create policy requests_client_insert on client_requests
  for insert with check (client_id = app_profile_client_id());
drop policy if exists requests_admin_write on client_requests;
create policy requests_admin_write on client_requests
  for all using (app_is_admin()) with check (app_is_admin());

-- Support tickets: same model.
drop policy if exists tickets_scope on tickets;
create policy tickets_scope on tickets
  for select using (app_can_see(client_id));
drop policy if exists tickets_client_insert on tickets;
create policy tickets_client_insert on tickets
  for insert with check (client_id = app_profile_client_id());
drop policy if exists tickets_admin_write on tickets;
create policy tickets_admin_write on tickets
  for all using (app_is_admin()) with check (app_is_admin());

-- Activity: read only; written by admins (or future trusted triggers).
drop policy if exists activity_scope on activity;
create policy activity_scope on activity
  for select using (app_can_see(client_id));
drop policy if exists activity_admin_write on activity;
create policy activity_admin_write on activity
  for insert with check (app_is_admin());

-- Notifications: strictly per-user.
drop policy if exists notifications_own on notifications;
create policy notifications_own on notifications
  for all using (user_id = app_user_id()) with check (user_id = app_user_id());

drop policy if exists onboarding_scope on onboarding_drafts;
create policy onboarding_scope on onboarding_drafts
  for all using (app_is_admin() or user_id = app_user_id())
  with check (app_is_admin() or user_id = app_user_id());

-- Enquiries: ANYONE may submit (public contact form); only admins read.
drop policy if exists enquiries_public_insert on enquiries;
create policy enquiries_public_insert on enquiries
  for insert to anon, authenticated with check (true);

drop policy if exists enquiries_admin_select on enquiries;
create policy enquiries_admin_select on enquiries
  for select using (app_is_admin());

-- Ops tables: admin only; secrets never leave the server side.
drop policy if exists email_outbox_admin on email_outbox;
create policy email_outbox_admin on email_outbox
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists webhooks_admin on webhooks;
create policy webhooks_admin on webhooks
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists webhook_deliveries_admin on webhook_deliveries;
create policy webhook_deliveries_admin on webhook_deliveries
  for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists api_keys_admin on api_keys;
create policy api_keys_admin on api_keys
  for all using (app_is_admin()) with check (app_is_admin());
