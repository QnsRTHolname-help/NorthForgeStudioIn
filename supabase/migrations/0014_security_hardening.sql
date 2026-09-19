-- =========================================================
-- NORTHFORGE — Supabase migration 0014
-- Security + correctness hardening pass.
--
-- Everything here is server-side by construction: RLS policies, triggers,
-- RPCs and REVOKEs. Nothing in this file relies on the browser behaving.
--
-- Sections
--   1. Account deletion was IMPOSSIBLE (storage.objects has no `path`)
--   2. A client could rewrite their own clients row (mass assignment)
--   3. A client could self-approve age verification
--   4. Internal notification/audit functions were public RPCs
--   5. Second-factor (AAL2) was only enforced on some admin tables
--   6. Public contact form had no server-side abuse control
--   7. WhatsApp webhook retries could duplicate messages
--   8. Out-of-order delivery receipts could downgrade a message
--   9. The 10 MB upload limit existed only in the browser
--
-- Non-destructive to data: no row is deleted except exact duplicate
-- WhatsApp rows that would otherwise make the new unique index impossible
-- (section 7). Every other statement is CREATE OR REPLACE / CREATE TRIGGER
-- / ADD COLUMN IF NOT EXISTS / GRANT / REVOKE / policy replacement.
--
-- Safe to re-run.
-- ROLLBACK SAFETY is listed at the bottom of each section.
-- Depends on: 0001–0013 (app_aal2, app_is_admin, nf_notify_*, tickets,
-- enquiries.plan).
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. ACCOUNT DELETION NEVER WORKED
--
-- `app_delete_own_account()` (0009, re-created in 0012) read the storage
-- path column as `path` / `path[1]` / `array_agg(path)`. `storage.objects`
-- has NO column named `path` — the object key is `name`, and the folder is
-- `storage.foldername(name)`. So every call raised 42703 and the whole
-- security-definer transaction rolled back: a client pressing "Delete
-- account" was told the deletion failed, forever.
--
-- Two independent fixes so this cannot regress into "deletion is
-- impossible":
--   a. use the real column (`name` + `storage.foldername`), and
--   b. treat storage cleanup as best-effort. The bytes live in Supabase
--      Storage, not in Postgres, so a failure there must not hold the
--      account hostage. Once the profile and client row are gone the
--      objects are unreachable anyway: the read policy keys off
--      app_profile_client_id(), which is null afterwards.
--
-- ROLLBACK: re-run the app_delete_own_account() body from 0012.
-- =========================================================

create or replace function app_delete_own_account()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_role text;
  v_client_id text;
  v_label text;
  v_storage_note text := 'no client workspace';
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Sign in before deleting an account.';
  end if;

  select role::text, client_id into v_role, v_client_id from profiles where id = v_uid;
  if v_role is null then
    -- No profile: nothing business-side to remove, just drop the auth user.
    delete from auth.users where id = v_uid;
    return 'deleted';
  end if;

  -- Admins and super admins cannot self-delete from the portal. A privileged
  -- account is off-boarded by a super admin, so there is no public path that
  -- removes an operator.
  if v_role in ('admin', 'super_admin') then
    raise exception 'ADMIN_CANNOT_SELF_DELETE'
      using hint = 'Privileged accounts must be removed by a super admin.';
  end if;

  select coalesce(c.business_name, p.email, 'a client')
    into v_label
    from profiles p left join clients c on c.id = p.client_id
   where p.id = v_uid;

  -- Invoices and payments are deliberately NOT deleted: the `on delete set
  -- null` foreign keys detach them and the clients_snapshot_financials
  -- trigger (0012) has already copied the business name onto each row.

  -- Tell the team BEFORE the account disappears.
  perform nf_notify_admins(
    'system',
    'Account deleted by client',
    coalesce(v_label, 'A client') || ' deleted their account',
    '/app/activity'
  );

  perform nf_log_activity(
    'auth.account_deletion_started', 'Account deletion started',
    'Client confirmed self-service deletion',
    'client', 'client', 'profile', v_uid::text, v_client_id
  );

  -- Storage objects have no foreign key for Postgres to cascade, so the
  -- client's folder is emptied explicitly. Paths are `{client_id}/…`, and
  -- the folder is derived from `name` — NOT from a column called `path`.
  if v_client_id is not null then
    begin
      delete from storage.objects
       where bucket_id = 'client-files'
         and (storage.foldername(name))[1] = v_client_id;
      v_storage_note := 'storage objects removed';
    exception when others then
      -- Recorded, not fatal: the account must still be erasable.
      v_storage_note := 'storage cleanup deferred (' || sqlstate || ')';
    end;
  end if;

  -- Remove the client workspace row. Business tables reference it with
  -- `on delete cascade`, so leads, projects, subscriptions, bookings,
  -- files, whatsapp_messages, requests, tickets and follow-ups go with it.
  if v_client_id is not null then
    delete from clients where id = v_client_id;
  end if;

  -- The audit trail survives the deletion because it is written first.
  insert into activity (type, label, detail, actor, actor_role, entity_type, entity_id)
    values (
      'auth.account_deleted',
      'Account deleted by user',
      'Self-service deletion completed; ' || v_storage_note,
      'unknown', 'client', 'profile', v_uid::text
    );

  delete from auth.users where id = v_uid;

  return 'deleted';
end $$;

revoke all on function app_delete_own_account() from public;
revoke all on function app_delete_own_account() from anon;
grant execute on function app_delete_own_account() to authenticated;


-- =========================================================
-- 2. A CLIENT COULD REWRITE THEIR OWN BUSINESS RECORD
--
-- `clients_self_update` is `using (id = app_profile_client_id())` with no
-- column restriction, and `clients` has no `guard_client_update` trigger.
-- Any signed-in client could therefore POST straight to PostgREST and set
-- server-owned columns on their own row: `plan_id` (give yourself the top
-- tier), `status` (mark yourself 'active'), `is_demo`, `notes`,
-- `onboarding_step` / `onboarding_completed`, `email`.
--
-- A narrow RPC would not have been enough: it only protects callers who
-- choose to use it, and the attack is a direct table write. This is a
-- BEFORE UPDATE trigger, so it locks the columns on EVERY path — PostgREST,
-- an RPC, or any future code — mirroring guard_profile_update, which
-- already protects `profiles` the same way.
--
-- Client-editable by design: business_name, contact_name, phone,
-- business_type, city, state, website_url.
--
-- ROLLBACK: drop trigger clients_guard_update on clients;
--           drop function guard_client_update();
-- =========================================================

create or replace function guard_client_update() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- No JWT (SQL editor, service role): trusted operator provisioning.
  if auth.uid() is null then
    return new;
  end if;

  -- An operator with a second factor may change anything.
  if app_is_admin() and app_aal2() then
    return new;
  end if;

  -- Everyone else: everything the operator or the server owns is pinned to
  -- its previous value. A client's UPDATE can therefore only ever move the
  -- fields the portal actually edits, whatever JSON it sends.
  new.id                   = old.id;
  new.email                = old.email;
  new.plan_id              = old.plan_id;
  new.status               = old.status;
  new.onboarding_step      = old.onboarding_step;
  new.onboarding_completed = old.onboarding_completed;
  new.notes                = old.notes;
  new.is_demo              = old.is_demo;
  new.created_at           = old.created_at;
  new.updated_at           = old.updated_at;

  return new;
end $$;

drop trigger if exists clients_guard_update on clients;
create trigger clients_guard_update before update on clients
  for each row execute function guard_client_update();


-- =========================================================
-- 3. A CLIENT COULD SELF-APPROVE THE AGE GATE
--
-- 0012 stores the age check as `profiles.age_verified`. `profiles_self_update`
-- is also unrestricted, and guard_profile_update (0008) pinned only
-- role/client_id/is_demo — so `PATCH /profiles?id=eq.<me> {"age_verified":true}`
-- passed the gate without ever confirming it on the signup form.
--
-- Also pinned: `last_login_at` (set by the system on sign-in).
-- `email` is deliberately NOT pinned here: sync_profile_email() copies it
-- from auth.users on an email change, and pinning it would silently undo a
-- legitimate change. It is not an authorization input anywhere.
--
-- ROLLBACK: re-run the guard_profile_update() body from 0008.
-- =========================================================

create or replace function guard_profile_update() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- No JWT (SQL editor, service role): trusted operator provisioning.
  if auth.uid() is null then
    return new;
  end if;

  -- Super admin WITH a verified second factor: full control.
  if app_is_super_admin() and app_aal2() then
    return new;
  end if;

  -- Everyone else — clients, admins, and first-factor super admins —
  -- keeps the fields that decide identity and trust.
  new.id              = old.id;
  new.role            = old.role;
  new.client_id       = old.client_id;
  new.is_demo         = old.is_demo;
  new.last_login_at   = old.last_login_at;
  new.created_at      = old.created_at;
  new.updated_at      = old.updated_at;

  -- The age gate result is server-owned and can never be self-modified
  -- after signup, however the request arrives.
  new.age_verified    = old.age_verified;
  new.age_verified_at = old.age_verified_at;

  return new;
end $$;


-- =========================================================
-- 4. INTERNAL FUNCTIONS WERE PUBLIC RPCs
--
-- Postgres grants EXECUTE on a new function to PUBLIC, and PostgREST
-- exposes every `public`-schema function with EXECUTE as
-- `POST /rest/v1/rpc/<name>`. None of these were revoked, so an ANONYMOUS
-- visitor could call:
--
--   nf_notify_admins(…)  → insert a notification for every admin. Unlimited
--                          notification spam, and a way to bury a real
--                          security alert.
--   nf_notify_client(…)  → same, for any client id.
--   nf_log_activity(…)   → forge audit-trail rows. The audit trail is only
--                          worth having if it cannot be written by the
--                          party it records.
--   nf_user_wants(…)     → read any user's notification preferences.
--
-- These are internal plumbing: every caller is a SECURITY DEFINER trigger
-- or RPC, which executes with the definer's (owner's) rights, so revoking
-- them from clients does not break the event engine — it only removes the
-- public RPC surface.
--
-- NOT revoked, on purpose: the RLS predicate helpers (app_is_admin,
-- app_can_see, app_profile_client_id, app_aal2, app_is_super_admin,
-- nf_can_access_file). They are evaluated inside policies as the querying
-- role; revoking EXECUTE from `anon`/`authenticated` would make every
-- policy that calls them raise "permission denied for function" instead of
-- returning a filtered result. They leak nothing: each answers a question
-- about the caller.
--
-- ROLLBACK: grant execute on function <name>(<args>) to public;
-- =========================================================

revoke all on function nf_notify_admins(text, text, text, text, text) from public;
revoke all on function nf_notify_admins(text, text, text, text, text) from anon;
revoke all on function nf_notify_admins(text, text, text, text, text) from authenticated;

revoke all on function nf_notify_client(text, text, text, text, text, text) from public;
revoke all on function nf_notify_client(text, text, text, text, text, text) from anon;
revoke all on function nf_notify_client(text, text, text, text, text, text) from authenticated;

revoke all on function nf_log_activity(text, text, text, text, text, text, text, text) from public;
revoke all on function nf_log_activity(text, text, text, text, text, text, text, text) from anon;
revoke all on function nf_log_activity(text, text, text, text, text, text, text, text) from authenticated;

revoke all on function nf_user_wants(uuid, text) from public;
revoke all on function nf_user_wants(uuid, text) from anon;
revoke all on function nf_user_wants(uuid, text) from authenticated;


-- =========================================================
-- 5. SECOND-FACTOR ENFORCEMENT HAD GAPS
--
-- 0008 required AAL2 for admin access to leads, proposals, projects,
-- websites, bookings, subscriptions, invoices, payments, clients and
-- activity. These tables were left behind, so an AAL1 (password-only, e.g.
-- a stolen session) admin session could still read and write them:
--
--   tickets, client_requests, client_requests activity, whatsapp_messages,
--   whatsapp_templates, workflows, workflow_nodes, milestones, files,
--   announcements, website_analytics, outreach_sequences, enquiries,
--   email_outbox, webhooks, webhook_deliveries, api_keys, ai_*
--
-- This matters most for the support inbox: tickets hold what clients write
-- to the studio, and the internal notes on them.
--
-- app_aal2() (0010) returns true for an account with NO verified factor, so
-- this cannot re-create the "empty dashboard" problem 0010 fixed: it only
-- bites once an operator has actually enrolled a factor.
--
-- ROLLBACK: re-create each policy from 0001/0004 with the plain
--           `app_is_admin()` arms.
-- =========================================================

-- ── Support tickets ──
drop policy if exists tickets_scope on tickets;
create policy tickets_scope on tickets
  for select to authenticated using (
    (app_is_admin() and app_aal2()) or app_can_see(client_id)
  );

drop policy if exists tickets_admin_write on tickets;
create policy tickets_admin_write on tickets
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── Client requests ──
drop policy if exists requests_scope on client_requests;
create policy requests_scope on client_requests
  for select to authenticated using (
    (app_is_admin() and app_aal2()) or app_can_see(client_id)
  );

drop policy if exists requests_admin_write on client_requests;
create policy requests_admin_write on client_requests
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── WhatsApp ──
drop policy if exists whatsapp_scope on whatsapp_messages;
create policy whatsapp_scope on whatsapp_messages
  for select to authenticated using (
    (app_is_admin() and app_aal2()) or app_can_see(client_id)
  );

drop policy if exists whatsapp_admin_write on whatsapp_messages;
create policy whatsapp_admin_write on whatsapp_messages
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

drop policy if exists whatsapp_templates_admin on whatsapp_templates;
create policy whatsapp_templates_admin on whatsapp_templates
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── Workflows ──
drop policy if exists workflows_admin on workflows;
create policy workflows_admin on workflows
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

drop policy if exists workflow_nodes_admin on workflow_nodes;
create policy workflow_nodes_admin on workflow_nodes
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── Milestones ──
drop policy if exists milestones_scope on milestones;
create policy milestones_scope on milestones
  for select to authenticated using (
    (app_is_admin() and app_aal2()) or app_can_see(client_id)
  );

drop policy if exists milestones_admin_write on milestones;
create policy milestones_admin_write on milestones
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── Files ──
drop policy if exists files_scope on files;
create policy files_scope on files
  for select to authenticated using (
    (app_is_admin() and app_aal2()) or app_can_see(client_id)
  );

drop policy if exists files_admin_write on files;
create policy files_admin_write on files
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── Announcements ──
drop policy if exists announcements_client_read on announcements;
create policy announcements_client_read on announcements
  for select to authenticated using (
    (app_is_admin() and app_aal2())
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
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── Website analytics ──
drop policy if exists analytics_scope on website_analytics;
create policy analytics_scope on website_analytics
  for select to authenticated using (
    (app_is_admin() and app_aal2())
    or exists (
      select 1 from websites w
       where w.id = website_analytics.website_id and app_can_see(w.client_id)
    )
  );

drop policy if exists analytics_admin_write on website_analytics;
create policy analytics_admin_write on website_analytics
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── Sales outreach ──
drop policy if exists outreach_admin_only on outreach_sequences;
create policy outreach_admin_only on outreach_sequences
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── Audit trail: an AAL1 session must not be able to append to it ──
drop policy if exists activity_admin_write on activity;
create policy activity_admin_write on activity
  for insert to authenticated with check (app_is_admin() and app_aal2());

-- ── Contact-form inbox ──
drop policy if exists enquiries_admin_select on enquiries;
create policy enquiries_admin_select on enquiries
  for select to authenticated using (app_is_admin() and app_aal2());

-- ── Operations tables (secrets, outbound webhooks, API keys) ──
drop policy if exists email_outbox_admin on email_outbox;
create policy email_outbox_admin on email_outbox
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

drop policy if exists webhooks_admin on webhooks;
create policy webhooks_admin on webhooks
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

drop policy if exists webhook_deliveries_admin on webhook_deliveries;
create policy webhook_deliveries_admin on webhook_deliveries
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

drop policy if exists api_keys_admin on api_keys;
create policy api_keys_admin on api_keys
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── AI assistant tables (schema reserved for the Copilot) ──
drop policy if exists ai_assistants_admin on ai_assistants;
create policy ai_assistants_admin on ai_assistants
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- ── Onboarding drafts: the admin arm needs AAL2, the owner arm does not ──
drop policy if exists onboarding_scope on onboarding_drafts;
create policy onboarding_scope on onboarding_drafts
  for all to authenticated
  using ((app_is_admin() and app_aal2()) or user_id = app_user_id())
  with check ((app_is_admin() and app_aal2()) or user_id = app_user_id());

-- ── Support RPCs must honour the same rule they bypass ──
-- These are SECURITY DEFINER, so they do NOT go through the table policies
-- above: an AAL1 admin session could still read every ticket, internal
-- notes included, through app_ticket_threads(). The admin arm now requires
-- the same assurance level as the table it reads.
create or replace function app_ticket_threads(p_ticket_id text default null)
returns setof jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_is_admin boolean;
  v_client_id text;
begin
  v_is_admin := app_is_admin() and app_aal2();
  v_client_id := app_profile_client_id();

  return query
    select jsonb_build_object(
      'id',         t.id,
      'client_id',  t.client_id,
      'subject',    t.subject,
      'status',     t.status,
      'priority',   t.priority,
      'category',   t.category,
      'created_at', t.created_at,
      'updated_at', t.updated_at,
      'is_demo',    coalesce(t.is_demo, false),
      'messages',   coalesce((
        select jsonb_agg(m order by coalesce(m ->> 'createdAt', ''))
        from jsonb_array_elements(coalesce(t.messages, '[]'::jsonb)) as m
        -- The mask: only an AAL2 admin ever sees an internal note.
        where v_is_admin
           or coalesce((m ->> 'internal')::boolean, false) is not true
      ), '[]'::jsonb)
    )
    from tickets t
    where (p_ticket_id is null or t.id = p_ticket_id)
      and (v_is_admin or t.client_id = v_client_id)
    order by t.created_at desc;
end $$;

revoke all on function app_ticket_threads(text) from public;
revoke all on function app_ticket_threads(text) from anon;
grant execute on function app_ticket_threads(text) to authenticated;

create or replace function app_add_ticket_message(
  p_ticket_id text,
  p_body text,
  p_internal boolean default false,
  p_status text default null
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
  v_is_admin boolean;
  v_name text;
  v_role text;
  v_internal boolean;
  v_body text;
  v_message jsonb;
  v_ticket jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Sign in before replying to a ticket.';
  end if;

  select coalesce(nullif(p.name, ''), p.email, 'NorthForge'), p.role::text
    into v_name, v_role
    from profiles p where p.id = v_uid;

  -- Staff rights at AAL2 only; at AAL1 an admin is, for this function,
  -- an ordinary authenticated user with no client.
  v_is_admin := app_is_admin() and app_aal2();

  if not exists (
    select 1 from tickets t
    where t.id = p_ticket_id
      and (v_is_admin or t.client_id = app_profile_client_id())
  ) then
    raise exception 'TICKET_NOT_FOUND' using hint = 'That ticket is not on your account.';
  end if;

  v_body := btrim(coalesce(p_body, ''));
  if v_body = '' then
    raise exception 'EMPTY_MESSAGE' using hint = 'Write something before sending.';
  end if;
  if length(v_body) > 5000 then
    v_body := left(v_body, 5000);
  end if;

  -- A client's message can never be an internal note, whatever it sends.
  v_internal := case when v_is_admin then coalesce(p_internal, false) else false end;

  v_message := jsonb_build_object(
    'id',         'msg-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 12),
    'author',     v_name,
    'authorRole', case when v_role = 'client' then 'client' else 'admin' end,
    'body',       v_body,
    'internal',   v_internal,
    'createdAt',  to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  update tickets t
     set messages = coalesce(t.messages, '[]'::jsonb) || jsonb_build_array(v_message),
         status = case
           when v_is_admin and p_status is not null and p_status <> '' then p_status
           else t.status
         end
   where t.id = p_ticket_id
   returning t.id into v_ticket;

  select thread into v_ticket
    from app_ticket_threads(p_ticket_id) as thread
   limit 1;

  return v_ticket;
end $$;

revoke all on function app_add_ticket_message(text, text, boolean, text) from public;
revoke all on function app_add_ticket_message(text, text, boolean, text) from anon;
grant execute on function app_add_ticket_message(text, text, boolean, text) to authenticated;


-- =========================================================
-- 6. THE PUBLIC CONTACT FORM HAD NO SERVER-SIDE ABUSE CONTROL
--
-- `enquiries_public_insert` was `for insert to anon with check (true)`, and
-- every inserted row fires a trigger that creates a `leads` row and notifies
-- every admin. One script could therefore flood enquiries, leads and admin
-- notifications without limit, and a browser honeypot is not a boundary.
--
-- The insert policy and the table INSERT grant are removed, and the only
-- remaining write path is this SECURITY DEFINER RPC, which:
--   • validates and length-caps every field,
--   • rejects a malformed email,
--   • throttles per address (1/minute, 3/hour) and globally (40/10 minutes).
--
-- The client-side honeypot stays as a cheap speed bump; the throttle is the
-- actual control.
--
-- ROLLBACK: grant insert on table public.enquiries to anon, authenticated;
--           create policy enquiries_public_insert on enquiries
--             for insert to anon, authenticated with check (true);
--           drop function app_submit_enquiry(...);
-- =========================================================

create or replace function app_submit_enquiry(
  p_name text,
  p_email text,
  p_id text default null,
  p_business_name text default null,
  p_whatsapp text default null,
  p_business_type text default null,
  p_current_tools text default null,
  p_bottleneck text default null,
  p_monthly_enquiries text default null,
  p_message text default null,
  p_plan text default null
) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_email text;
  v_id text;
  v_count int;
begin
  v_name  := left(btrim(coalesce(p_name, '')), 120);
  v_email := lower(left(btrim(coalesce(p_email, '')), 200));

  if v_name = '' then
    raise exception 'VALIDATION' using hint = 'Enter your name.';
  end if;
  -- Deliberately permissive: this must accept real addresses, including
  -- non-Latin local parts, without pretending to be an RFC 5322 parser.
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[[:alpha:]]{2,}$' then
    raise exception 'VALIDATION' using hint = 'Enter a valid email address.';
  end if;

  -- Per-address throttle.
  select count(*) into v_count from enquiries
   where lower(email) = v_email and created_at > now() - interval '1 hour';
  if v_count >= 3 then
    raise exception 'RATE_LIMITED' using hint = 'We already have this enquiry — we will be in touch.';
  end if;

  select count(*) into v_count from enquiries
   where lower(email) = v_email and created_at > now() - interval '1 minute';
  if v_count >= 1 then
    raise exception 'RATE_LIMITED' using hint = 'Please wait a moment before sending another enquiry.';
  end if;

  -- Global throttle: stops a rotating-address flood from burying the inbox
  -- and the admin notification feed.
  select count(*) into v_count from enquiries
   where created_at > now() - interval '10 minutes';
  if v_count >= 40 then
    raise exception 'RATE_LIMITED' using hint = 'We are receiving a lot of enquiries right now — please try again shortly, or message us on WhatsApp.';
  end if;

  -- The visitor's own reference, when it looks like one we generated.
  v_id := case when coalesce(p_id, '') ~ '^eq_[0-9a-f]{12}$' then p_id else null end;

  insert into enquiries (
    id, name, business_name, email, whatsapp, business_type,
    current_tools, bottleneck, monthly_enquiries, message, plan
  ) values (
    coalesce(v_id, 'eq_' || substr(encode(gen_random_bytes(6), 'hex'), 1, 12)),
    v_name,
    nullif(left(btrim(coalesce(p_business_name, '')), 200), ''),
    v_email,
    nullif(left(btrim(coalesce(p_whatsapp, '')), 40), ''),
    nullif(left(btrim(coalesce(p_business_type, '')), 80), ''),
    nullif(left(btrim(coalesce(p_current_tools, '')), 300), ''),
    nullif(left(btrim(coalesce(p_bottleneck, '')), 300), ''),
    nullif(left(btrim(coalesce(p_monthly_enquiries, '')), 80), ''),
    nullif(left(btrim(coalesce(p_message, '')), 4000), ''),
    nullif(left(btrim(coalesce(p_plan, '')), 80), '')
  )
  returning id into v_id;

  return v_id;
end $$;

-- The public write path is now the function, not the table.
drop policy if exists enquiries_public_insert on enquiries;
revoke insert on table public.enquiries from anon, authenticated;

revoke all on function app_submit_enquiry(
  text, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function app_submit_enquiry(
  text, text, text, text, text, text, text, text, text, text, text
) to anon, authenticated;


-- =========================================================
-- 7. WEBHOOK RETRIES COULD DUPLICATE MESSAGES
--
-- Meta retries a webhook when it does not see a 2xx quickly, so the same
-- `message.id` can arrive several times. Nothing stopped the second insert,
-- so one customer reply could appear two or three times in the inbox.
--
-- A partial unique index on the provider id makes a repeat a no-op: the
-- webhook (re-deployed with this migration) treats the resulting 23505 as
-- "already recorded" instead of logging an error. Nulls are not indexed, so
-- queued rows and rows with no provider id are unaffected.
--
-- Exact duplicates already in the table are removed first — the index
-- cannot be created over them, and two rows sharing one provider message id
-- are the same message, not two messages. The earliest row is kept.
--
-- ROLLBACK: drop index if exists whatsapp_messages_provider_uidx;
-- =========================================================

-- Why a send failed, so the inbox can say more than "failed". Written by
-- the whatsapp-send Edge Function; operators otherwise had to guess.
alter table whatsapp_messages add column if not exists failure_reason text;

delete from whatsapp_messages w
 using whatsapp_messages keep
 where w.provider_message_id is not null
   and w.provider_message_id = keep.provider_message_id
   and (w.created_at, w.id) > (keep.created_at, keep.id);

create unique index if not exists whatsapp_messages_provider_uidx
  on whatsapp_messages (provider_message_id)
  where provider_message_id is not null;

comment on index whatsapp_messages_provider_uidx is
  'One row per provider message id. Makes a repeated Meta webhook delivery a no-op instead of a duplicate inbox entry.';


-- =========================================================
-- 8. OUT-OF-ORDER DELIVERY RECEIPTS COULD DOWNGRADE A MESSAGE
--
-- Meta does not guarantee receipt ordering: a late `sent` can land after
-- `read`, which marked a read message as merely sent. Status may only move
-- forward through queued → sent → delivered → read; `failed` may always be
-- set or cleared.
--
-- ROLLBACK: drop trigger whatsapp_status_guard on whatsapp_messages;
--           drop function guard_whatsapp_status();
-- =========================================================

create or replace function guard_whatsapp_status() returns trigger
  language plpgsql
  set search_path = public
as $$
declare
  rank_old int;
  rank_new int;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Failure is always allowed to be set, and always allowed to be corrected.
  if new.status = 'failed' or old.status = 'failed' then
    return new;
  end if;

  rank_old := case old.status
    when 'queued' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3
    else 0 end;
  rank_new := case new.status
    when 'queued' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3
    else 0 end;

  if rank_new <= rank_old then
    new.status := old.status;
  end if;

  return new;
end $$;

drop trigger if exists whatsapp_status_guard on whatsapp_messages;
create trigger whatsapp_status_guard before update on whatsapp_messages
  for each row execute function guard_whatsapp_status();


-- =========================================================
-- 9. THE 10 MB UPLOAD LIMIT ONLY EXISTED IN THE BROWSER
--
-- The Files page checks the size before calling the Storage API, but
-- anything holding a session can call that API directly, so the limit was
-- advisory. Supabase enforces `file_size_limit` on the bucket itself.
--
-- MIME types are deliberately left unrestricted: the bucket is private,
-- downloads go out as attachments from the Supabase origin, and a narrow
-- allow-list would silently break legitimate client documents.
--
-- ROLLBACK: update storage.buckets set file_size_limit = null
--           where id = 'client-files';
-- =========================================================

update storage.buckets
   set file_size_limit = 10485760   -- 10 MiB, matching the portal
 where id = 'client-files';


-- =========================================================
-- VERIFY
--
--   -- the deletion function no longer touches a `path` column
--   select prosrc like '%storage.foldername(name)%' as uses_real_column,
--          prosrc like '%array_agg(path)%'          as stale_column
--     from pg_proc where proname = 'app_delete_own_account';
--
--   -- internal plumbing is no longer a public RPC
--   select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
--     from pg_proc p
--    where p.proname in ('nf_notify_admins','nf_notify_client','nf_log_activity','nf_user_wants');
--
--   -- the mass-assignment guards exist
--   select tgname from pg_trigger
--    where tgname in ('clients_guard_update','whatsapp_status_guard');
--
--   -- one row per provider message id
--   select indexname from pg_indexes where tablename = 'whatsapp_messages';
-- =========================================================
