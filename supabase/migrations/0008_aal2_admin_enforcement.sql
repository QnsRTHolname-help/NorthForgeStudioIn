-- ═══════════════════════════════════════════════════════════════
-- 0008 — Server-enforced second factor for privileged accounts
--
-- Two hardening rules, both enforced in the DATABASE (the real boundary):
--
--   1. Privileged activity logging now records the authenticator
--      assurance level, so an audit can prove which sessions were
--      two-factor.
--
--   2. Admin write access to CLIENT BUSINESS DATA requires AAL2 — a
--      session verified with a second factor. Password-only (AAL1)
--      sessions, including a stolen cookie, can read nothing admin-only
--      and write nothing at all.
--
-- Idempotent: safe to run repeatedly (mirrors 0002/0003 style).
-- Users without any MFA factor: admins simply enrol once in Settings →
-- Two-factor authentication; clients are unaffected (client SELECT
-- policies stay first-factor).
-- ═══════════════════════════════════════════════════════════════

-- ── Assurance helper ───────────────────────────────────────────
-- AAL2 = the session presented a verified second factor. For sessions
-- created before MFA enrolment this is false until the next sign-in —
-- by design: it forces a fresh two-factor sign-in.
create or replace function app_aal2() returns boolean
  language sql stable as $$
    -- The authenticator assurance level rides in the JWT's top-level
    -- `aal` claim (documented Supabase MFA pattern: auth.jwt() ->> 'aal').
    select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  $$;

-- ── Privileged tables: AAL2 required for ANY access by admins ──
-- Replace the admin read arm of each scope policy with one that also
-- demands a two-factor-verified session. Client rows remain readable by
-- their owner at AAL1 (the portal keeps working for MFA-off clients).

drop policy if exists leads_scope on leads;
create policy leads_scope on leads
  for select using (
    (app_is_admin() and app_aal2())
    or app_can_see(client_id)
  );

drop policy if exists proposals_scope on proposals;
create policy proposals_scope on proposals
  for select using (
    (app_is_admin() and app_aal2())
    or app_can_see(client_id)
  );

drop policy if exists projects_scope on projects;
create policy projects_scope on projects
  for select using (
    (app_is_admin() and app_aal2())
    or app_can_see(client_id)
  );

drop policy if exists websites_scope on websites;
create policy websites_scope on websites
  for select using (
    (app_is_admin() and app_aal2())
    or app_can_see(client_id)
  );

drop policy if exists bookings_scope on bookings;
create policy bookings_scope on bookings
  for select using (
    (app_is_admin() and app_aal2())
    or app_can_see(client_id)
  );

drop policy if exists subscriptions_scope on subscriptions;
create policy subscriptions_scope on subscriptions
  for select using (
    (app_is_admin() and app_aal2())
    or app_can_see(client_id)
  );

drop policy if exists invoices_scope on invoices;
create policy invoices_scope on invoices
  for select using (
    (app_is_admin() and app_aal2())
    or app_can_see(client_id)
  );

drop policy if exists payments_scope on payments;
create policy payments_scope on payments
  for select using (
    (app_is_admin() and app_aal2())
    or app_can_see(client_id)
  );

-- Client business records: admins need AAL2 to enumerate them.
drop policy if exists clients_self_or_admin on clients;
create policy clients_self_or_admin on clients
  for select using (
    (app_is_admin() and app_aal2())
    or id = app_profile_client_id()
  );

-- Audit trail: admin reads require AAL2 here too.
drop policy if exists activity_scope on activity;
create policy activity_scope on activity
  for select using (
    (app_is_admin() and app_aal2())
    or app_can_see(client_id)
  );

-- ── Admin write policies: AAL2 required (all were app_is_admin-only) ──
drop policy if exists leads_admin_write on leads;
create policy leads_admin_write on leads
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

drop policy if exists followups_admin_write on follow_ups;
create policy followups_admin_write on follow_ups
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

drop policy if exists proposals_admin_write on proposals;
create policy proposals_admin_write on proposals
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

drop policy if exists projects_admin_write on projects;
create policy projects_admin_write on projects
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

drop policy if exists tasks_admin_write on tasks;
create policy tasks_admin_write on tasks
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

drop policy if exists websites_admin_write on websites;
create policy websites_admin_write on websites
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

drop policy if exists bookings_admin_write on bookings;
create policy bookings_admin_write on bookings
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

drop policy if exists subscriptions_admin_write on subscriptions;
create policy subscriptions_admin_write on subscriptions
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

drop policy if exists invoices_admin_write on invoices;
create policy invoices_admin_write on invoices
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

drop policy if exists payments_admin_write on payments;
create policy payments_admin_write on payments
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

drop policy if exists clients_admin_write on clients;
create policy clients_admin_write on clients
  for all using (app_is_admin() and app_aal2()) with check (app_is_admin() and app_aal2());

-- ── Role changes: super admin must present AAL2 ─────────────────
-- Guard from 0003, hardened: a stolen AAL1 super-admin session cannot
-- promote accounts.
create or replace function guard_profile_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- No JWT (SQL editor, service role): trusted operator provisioning.
  if auth.uid() is null then
    return new;
  end if;

  -- Super admin WITH a verified second factor: full control.
  if app_is_super_admin() and app_aal2() then
    return new;
  end if;

  -- Everyone else (clients, admins, and first-factor super admins):
  -- identity is locked.
  new.role = old.role;
  new.client_id = old.client_id;
  new.is_demo = old.is_demo;
  return new;
end $$;

-- ── Migration note ─────────────────────────────────────────────
-- ROLLBACK SAFETY: to revert, drop app_aal2() and recreate the policies
-- from migration 0001 (they are all plain `create policy` statements).
-- Existing admin sessions keep working at AAL1 until their next token
-- refresh; after that they must complete MFA (Settings → Two-factor).
