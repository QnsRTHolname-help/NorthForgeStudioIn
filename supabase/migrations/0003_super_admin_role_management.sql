-- =========================================================
-- NORTHFORGE — Supabase migration 0003
--
-- Spec §7: least-privilege role management.
--
-- Before this migration, guard_profile_update() locked role/client_id for
-- non-admins only — meaning ANY admin could promote accounts to admin, or
-- demote another admin, from the browser. Role assignment is a
-- SUPER_ADMIN-only capability.
--
-- Changes:
--   1. app_is_super_admin()  — RLS helper mirroring app_is_admin()
--   2. guard_profile_update() — role/client_id/is_demo changes now require
--      a super_admin JWT; ordinary admins are locked like clients.
--      Service-role / SQL-editor provisioning stays allowed (no JWT).
--   3. activity logging for sign-in events (spec §6: track login) —
--      written by a security definer trigger so RLS never blocks it.
--
-- Non-destructive: CREATE OR REPLACE only. Safe to re-run.
-- =========================================================

-- ── 1. Super-admin helper (mirrors app_is_admin() from 0001) ──
create or replace function app_is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (
      select 1 from profiles where id = auth.uid() and role = 'super_admin'
    )
  $$;

-- ── 2. Least-privilege guard: only super_admins may change roles ──
create or replace function guard_profile_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- No JWT (SQL editor, service role): trusted operator provisioning.
  if auth.uid() is null then
    return new;
  end if;

  -- Super admin: full control.
  if app_is_super_admin() then
    return new;
  end if;

  -- Everyone else (clients AND ordinary admins): identity is locked.
  new.role = old.role;
  new.client_id = old.client_id;
  new.is_demo = old.is_demo;
  return new;
end $$;

-- ── 3. Activity logging for auth events (spec §6, never stores passwords) ──
create or replace function log_auth_activity() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_name text;
begin
  -- last_sign_in_at changes on every successful sign-in; created_at only
  -- once, at signup. Errors inside the trigger must never block auth.
  begin
    if tg_op = 'INSERT' then
      insert into activity (type, label, detail, actor, actor_role, entity_type, entity_id)
      values (
        'auth.signup', 'Account created', new.email,
        coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
        'client', 'profile', new.id::text
      );
    elsif new.last_sign_in_at is distinct from old.last_sign_in_at then
      -- The profile already exists at sign-in time (created by
      -- handle_new_user on INSERT), so read the real role from it.
      select p.role::text,
             coalesce(nullif(p.name, ''), split_part(new.email, '@', 1))
        into v_role, v_name
        from profiles p where p.id = new.id;
      insert into activity (type, label, detail, actor, actor_role, entity_type, entity_id)
      values (
        'auth.login', 'Signed in', new.email,
        coalesce(v_name, split_part(new.email, '@', 1)),
        coalesce(v_role, 'client'), 'profile', new.id::text
      );
    end if;
  exception when others then
    -- Audit logging must never break authentication.
    return null;
  end;
  return null; -- AFTER trigger, no row change intended
end $$;

drop trigger if exists auth_users_activity_log on auth.users;
create trigger auth_users_activity_log
  after insert or update of last_sign_in_at on auth.users
  for each row execute function log_auth_activity();

-- RLS: ordinary admins must not be able to rewrite audit rows.
-- (activity_admin_write from 0001 already limits writes to admins via
-- app_is_admin(); it is INSERT-only, so existing rows stay immutable.)
