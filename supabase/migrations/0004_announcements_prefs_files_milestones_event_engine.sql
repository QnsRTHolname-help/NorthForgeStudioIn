-- =========================================================
-- NORTHFORGE — Supabase migration 0004
--
-- The operating-system layer the earlier migrations did not cover:
--
--   1. announcements            — admin broadcast messages (§18)
--   2. notification_preferences — per-user notification switches (§6)
--   3. milestones               — project milestones with client visibility (§25)
--   4. files                    — secure client file registry (§26, §27)
--      + private 'client-files' storage bucket with RLS-derived policies
--   5. Event engine (§8, §46): security-definer triggers turn database
--      events into notifications (respecting preferences) and activity
--      records — the backend, not the browser, is the source of truth.
--
-- Non-destructive: only CREATE / CREATE OR REPLACE / CREATE POLICY with
-- drop-if-exists. Safe to re-run. No existing data is touched.
-- =========================================================

create extension if not exists "pgcrypto";

-- ── 1. Announcements ─────────────────────────────────────
create table if not exists announcements (
  id          text primary key default ('an_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  title       text not null,
  message     text not null,
  priority    text not null default 'normal' check (priority in ('normal','high','critical')),
  audience    text not null default 'all_clients' check (audience in ('all_clients','selected_clients','internal_admins')),
  client_ids  jsonb not null default '[]'::jsonb,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  created_by  uuid references auth.users(id) on delete set null,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists announcements_starts_idx on announcements(starts_at desc);

drop trigger if exists announcements_updated_at on announcements;
create trigger announcements_updated_at before update on announcements
  for each row execute function set_updated_at();

alter table announcements enable row level security;

-- Clients read only published announcements addressed to them.
drop policy if exists announcements_client_read on announcements;
create policy announcements_client_read on announcements
  for select to authenticated using (
    app_is_admin()
    or (
      audience in ('all_clients','selected_clients')
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
      and (
        audience = 'all_clients'
        or client_ids ? coalesce(app_profile_client_id(), '')
      )
    )
  );

drop policy if exists announcements_admin_write on announcements;
create policy announcements_admin_write on announcements
  for all to authenticated using (app_is_admin()) with check (app_is_admin());

-- ── 2. Notification preferences (§6) ─────────────────────
create table if not exists notification_preferences (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  project_updates boolean not null default true,
  leads           boolean not null default true,
  appointments    boolean not null default true,
  billing         boolean not null default true,
  support         boolean not null default true,
  marketing       boolean not null default true,
  system          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists notification_preferences_updated_at on notification_preferences;
create trigger notification_preferences_updated_at before update on notification_preferences
  for each row execute function set_updated_at();

alter table notification_preferences enable row level security;

drop policy if exists notification_prefs_own on notification_preferences;
create policy notification_prefs_own on notification_preferences
  for all to authenticated using (user_id = app_user_id()) with check (user_id = app_user_id());

-- Seed defaults when a profile is created.
create or replace function seed_notification_preferences() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into notification_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists profiles_seed_prefs on profiles;
create trigger profiles_seed_prefs after insert on profiles
  for each row execute function seed_notification_preferences();


-- ── 3. Milestones (§25) ──────────────────────────────────
create table if not exists milestones (
  id           text primary key default ('ms_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  project_id   text not null references projects(id) on delete cascade,
  client_id    text not null references clients(id) on delete cascade,
  title        text not null,
  description  text,
  status       text not null default 'planning' check (status in ('planning','in_progress','completed')),
  sort_order   integer not null default 0,
  due_date     date,
  completed_at timestamptz,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists milestones_project_idx on milestones(project_id, sort_order);

drop trigger if exists milestones_updated_at on milestones;
create trigger milestones_updated_at before update on milestones
  for each row execute function set_updated_at();

alter table milestones enable row level security;

drop policy if exists milestones_scope on milestones;
create policy milestones_scope on milestones
  for select to authenticated using (app_can_see(client_id));

drop policy if exists milestones_admin_write on milestones;
create policy milestones_admin_write on milestones
  for all to authenticated using (app_is_admin()) with check (app_is_admin());

-- Completing a milestone stamps completed_at automatically.
create or replace function guard_milestone_status() returns trigger
  language plpgsql as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at = now();
  elsif new.status is distinct from 'completed' then
    new.completed_at = null;
  end if;
  return new;
end $$;

drop trigger if exists milestones_status_guard on milestones;
create trigger milestones_status_guard before update on milestones
  for each row execute function guard_milestone_status();

-- ── 4. Files (§26, §27) ──────────────────────────────────
-- Registry for private client files in Storage. Objects live under
-- `{client_id}/{filename}` in the private 'client-files' bucket; access is
-- granted by the same RLS identity used everywhere else (app_can_see).
create table if not exists files (
  id           text primary key default ('fl_' || substr(encode(gen_random_bytes(9),'hex'),1,12)),
  client_id    text not null references clients(id) on delete cascade,
  uploaded_by  uuid references auth.users(id) on delete set null,
  name         text not null,
  storage_path text not null unique,
  size_bytes   integer not null default 0,
  mime_type    text,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists files_client_idx on files(client_id, created_at desc);

alter table files enable row level security;

drop policy if exists files_scope on files;
create policy files_scope on files
  for select to authenticated using (app_can_see(client_id));

drop policy if exists files_client_insert on files;
create policy files_client_insert on files
  for insert to authenticated with check (client_id = app_profile_client_id());

drop policy if exists files_admin_write on files;
create policy files_admin_write on files
  for all to authenticated using (app_is_admin()) with check (app_is_admin());

drop policy if exists files_owner_delete on files;
create policy files_owner_delete on files
  for delete to authenticated using (client_id = app_profile_client_id());

-- Private storage bucket: never public, never predictable URLs.
insert into storage.buckets (id, name, public)
values ('client-files', 'client-files', false)
on conflict (id) do nothing;

-- Helper: does the current user have access to a path's client folder?
create or replace function nf_can_access_file(path text) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(app_is_admin(), false) or (
    app_profile_client_id() is not null
    and (storage.foldername(path))[1] = app_profile_client_id()
  )
  $$;

drop policy if exists nf_client_files_read on storage.objects;
create policy nf_client_files_read on storage.objects
  for select to authenticated using (
    bucket_id = 'client-files' and nf_can_access_file(name)
  );

drop policy if exists nf_client_files_insert on storage.objects;
create policy nf_client_files_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'client-files'
    and app_profile_client_id() is not null
    and (storage.foldername(name))[1] = app_profile_client_id()
  );

drop policy if exists nf_client_files_delete on storage.objects;
create policy nf_client_files_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'client-files' and nf_can_access_file(name)
  );


-- =========================================================
-- 5. EVENT ENGINE (§8, §9, §46, §54)
-- Events become notifications (respecting preferences) and activity
-- records inside the database — no dependence on browser JavaScript.
-- =========================================================

-- Does this user want notifications of this kind?
create or replace function nf_user_wants(p_user uuid, p_kind text) returns boolean
  language sql stable security definer set search_path = public as $$
    select coalesce((
      select case p_kind
        when 'project_updates' then project_updates
        when 'leads'           then leads
        when 'appointments'    then appointments
        when 'billing'         then billing
        when 'support'         then support
        when 'marketing'       then marketing
        else system
      end
      from notification_preferences where user_id = p_user
    ), true)
  $$;

-- Notify every portal profile of a client, honouring their preferences.
create or replace function nf_notify_client(
  p_client_id text, p_kind text, p_title text,
  p_body text, p_href text, p_priority text default 'normal'
) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if p_client_id is null then return; end if;
  insert into notifications (user_id, kind, title, body, href, entity_type, entity_id)
  select p.id, p_kind, p_title, p_body, p_href, 'client', p_client_id
  from profiles p
  where p.client_id = p_client_id and p.role = 'client'
    and nf_user_wants(p.id, p_kind);
end $$;

-- Notify every admin + super admin (admins always receive system events).
create or replace function nf_notify_admins(
  p_kind text, p_title text, p_body text, p_href text, p_priority text default 'normal'
) returns void
  language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, title, body, href, entity_type, entity_id)
  select p.id, p_kind, p_title, p_body, p_href, 'system', null
  from profiles p
  where p.role in ('admin','super_admin');
end $$;

-- Write an activity record (audit trail, §9, §54). Human descriptions
-- only — never secrets.
create or replace function nf_log_activity(
  p_type text, p_label text, p_detail text, p_actor text, p_actor_role text,
  p_entity_type text, p_entity_id text, p_client_id text
) returns void
  language plpgsql security definer set search_path = public as $$
begin
  insert into activity (type, label, detail, actor, actor_role, entity_type, entity_id, client_id)
  values (p_type, p_label, p_detail, p_actor, p_actor_role, p_entity_type, p_entity_id, p_client_id);
exception when others then
  -- Audit logging must never break the underlying business write.
  null;
end $$;

-- ── Lead created → admins (§23) ──
create or replace function on_lead_created() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform nf_notify_admins(
    'lead', 'New lead',
    coalesce(new.contact_name, 'Unknown') || ' — ' || coalesce(new.business_name, 'direct enquiry'),
    '/app/leads'
  );
  perform nf_log_activity(
    'lead.created', 'Lead created',
    coalesce(new.business_name, new.contact_name),
    coalesce(new.contact_name, 'Website'), 'system',
    'lead', new.id, new.client_id
  );
  return new;
end $$;

drop trigger if exists leads_event_engine on leads;
create trigger leads_event_engine after insert on leads
  for each row execute function on_lead_created();

-- ── Requests: created → admins; status change → client ──
create or replace function on_request_created() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform nf_notify_admins('request', 'New client request', new.title, '/app/requests');
  perform nf_log_activity('request.created', 'Request submitted', new.title,
    'Client', 'client', 'client_request', new.id, new.client_id);
  return new;
end $$;

drop trigger if exists requests_created on client_requests;
create trigger requests_created after insert on client_requests
  for each row execute function on_request_created();

-- ── Support tickets: created → admins; status change → client (§33, §34) ──
create or replace function on_ticket_created() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform nf_notify_admins('message', 'New support ticket', new.subject, '/app/support');
  perform nf_log_activity('ticket.created', 'Support ticket created', new.subject,
    'Client', 'client', 'ticket', new.id, new.client_id);
  return new;
end $$;

drop trigger if exists tickets_created on tickets;
create trigger tickets_created after insert on tickets
  for each row execute function on_ticket_created();

create or replace function on_ticket_status() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform nf_notify_client(new.client_id, 'support', 'Support ticket update',
      new.subject || ' is now ' || replace(new.status, '_', ' '),
      '/portal/support');
    perform nf_log_activity('ticket.updated', 'Support ticket updated',
      new.subject || ': ' || old.status || ' → ' || new.status,
      'System', 'system', 'ticket', new.id, new.client_id);
  end if;
  return new;
end $$;

drop trigger if exists tickets_status on tickets;
create trigger tickets_status after update of status on tickets
  for each row execute function on_ticket_status();

-- ── Bookings: created → admins; status change → client (§29) ──
create or replace function on_booking_created() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform nf_notify_admins('system', 'New appointment',
    coalesce(new.customer_name, 'Unknown') || ' — ' || coalesce(new.service, 'booking'),
    '/app/calendar');
  perform nf_log_activity('booking.created', 'Appointment booked',
    coalesce(new.customer_name, 'Unknown'),
    'System', 'system', 'booking', new.id, new.client_id);
  return new;
end $$;

drop trigger if exists bookings_created on bookings;
create trigger bookings_created after insert on bookings
  for each row execute function on_booking_created();

create or replace function on_booking_status() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform nf_notify_client(new.client_id, 'appointments', 'Appointment update',
      coalesce(new.customer_name, 'Appointment') || ' is now ' || replace(new.status, '_', ' '),
      '/portal/bookings');
    perform nf_log_activity('booking.updated', 'Appointment status changed',
      old.status || ' → ' || new.status,
      'System', 'system', 'booking', new.id, new.client_id);
  end if;
  return new;
end $$;

drop trigger if exists bookings_status on bookings;
create trigger bookings_status after update of status on bookings
  for each row execute function on_booking_status();

-- ── Billing: invoices + payments (§31, §32) ──
create or replace function on_invoice_status() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'paid' then
      perform nf_notify_client(new.client_id, 'billing', 'Payment received',
        'Invoice ' || new.number || ' has been marked as paid.', '/portal/invoices');
      perform nf_notify_admins('billing', 'Invoice paid', new.number, '/app/invoices');
    elsif new.status = 'open' then
      perform nf_notify_client(new.client_id, 'billing', 'Invoice issued',
        'Invoice ' || new.number || ' is ready and due ' || to_char(new.due_at, 'DD Mon YYYY'),
        '/portal/invoices');
    end if;
    perform nf_log_activity('invoice.updated', 'Invoice status changed',
      new.number || ': ' || old.status || ' → ' || new.status,
      'System', 'system', 'invoice', new.id, new.client_id);
  end if;
  return new;
end $$;

drop trigger if exists invoices_status on invoices;
create trigger invoices_status after update of status on invoices
  for each row execute function on_invoice_status();

create or replace function on_payment_recorded() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'succeeded' then
    perform nf_notify_client(new.client_id, 'billing', 'Payment recorded',
      'A payment was recorded on your account.', '/portal/invoices');
    perform nf_notify_admins('billing', 'Payment received', null, '/app/payments');
  end if;
  perform nf_log_activity('payment.recorded', 'Payment recorded',
    new.amount::text || ' ' || new.currency || ' — ' || new.status,
    'System', 'system', 'payment', new.id, new.client_id);
  return new;
end $$;

drop trigger if exists payments_recorded on payments;
create trigger payments_recorded after insert on payments
  for each row execute function on_payment_recorded();

-- ── Tasks: assigned → assignee; completion → audit trail (§13) ──
create or replace function on_task_event() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.assignee_id is not null then
      insert into notifications (user_id, kind, title, body, href, entity_type, entity_id)
      values (new.assignee_id, 'task', 'Task assigned', new.title,
        '/app/tasks', 'task', new.id);
    end if;
    perform nf_log_activity('task.created', 'Task created', new.title,
      'System', 'system', 'task', new.id, new.client_id);
  else
    if new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id then
      insert into notifications (user_id, kind, title, body, href, entity_type, entity_id)
      values (new.assignee_id, 'task', 'Task assigned', new.title,
        '/app/tasks', 'task', new.id);
    end if;
    if new.status = 'done' and old.status is distinct from 'done' then
      perform nf_log_activity('task.completed', 'Task completed', new.title,
        'System', 'system', 'task', new.id, new.client_id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tasks_event_engine on tasks;
create trigger tasks_event_engine after insert or update on tasks
  for each row execute function on_task_event();

-- ── Client status changes → audit + client notice (§21, §54) ──
create or replace function on_client_status() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform nf_log_activity('client.status_changed', 'Client status changed',
      old.status || ' → ' || new.status,
      'System', 'system', 'client', new.id, new.id);
    if new.status = 'paused' or new.status = 'churned' then
      perform nf_notify_client(new.id, 'system', 'Account status change',
        'Your NorthForge account status is now: ' || new.status || '. Contact support if this is unexpected.',
        '/portal/support');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists clients_status_engine on clients;
create trigger clients_status_engine after update of status on clients
  for each row execute function on_client_status();

-- ── Announcements published → notify addressed clients (§18) ──
create or replace function on_announcement_published() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_client record;
begin
  if new.audience = 'internal_admins' then
    perform nf_notify_admins('system', 'Announcement', new.title, null);
    return new;
  end if;

  for v_client in
    select c.id from clients c
    where new.audience = 'all_clients'
       or (new.audience = 'selected_clients' and new.client_ids ? c.id)
  loop
    perform nf_notify_client(v_client.id, 'system', 'Announcement', new.title, '/portal/announcements');
  end loop;
  return new;
end $$;

drop trigger if exists announcements_engine on announcements;
create trigger announcements_engine after insert on announcements
  for each row execute function on_announcement_published();

-- ── Milestones: status change → audit trail ──
create or replace function on_milestone_status() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform nf_log_activity('milestone.updated', 'Milestone updated',
      new.title || ': ' || old.status || ' → ' || new.status,
      'System', 'system', 'milestone', new.id, new.client_id);
  end if;
  return new;
end $$;

drop trigger if exists milestones_engine on milestones;
create trigger milestones_engine after update of status on milestones
  for each row execute function on_milestone_status();



create or replace function on_request_status() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform nf_notify_client(new.client_id, 'support', 'Request update',
      new.title || ' is now ' || replace(new.status, '_', ' '),
      '/portal/requests');
    perform nf_log_activity('request.updated', 'Request status changed',
      new.title || ': ' || old.status || ' → ' || new.status,
      'System', 'system', 'client_request', new.id, new.client_id);
  end if;
  return new;
end $$;

drop trigger if exists requests_status on client_requests;
create trigger requests_status after update of status on client_requests
  for each row execute function on_request_status();
