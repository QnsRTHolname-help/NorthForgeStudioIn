-- =========================================================
-- NORTHFORGE — Supabase migration 0016
-- Two fixes surfaced by real use of the portal and the admin inbox.
--
-- Sections
--   1. Admin (and client) ticket replies ALWAYS failed
--   2. Email one-time code as a client's second factor (opt-in)
--
-- Non-destructive: one function is replaced, one table is created, no
-- existing row is read, moved or deleted.
--
-- Safe to re-run.
-- ROLLBACK is listed under each section.
-- Depends on: 0001 (profiles, app_user_id, set_updated_at), 0013/0014
--             (app_ticket_threads, app_add_ticket_message).
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. SUPPORT REPLIES NEVER SENT
--
-- `app_add_ticket_message` (0014) declared `v_ticket jsonb` and then wrote
-- `returning t.id into v_ticket`. `tickets.id` is TEXT, so plpgsql attempted
-- the assignment cast text → json. 'tc_ab12cd34ef56' is not valid JSON, so
-- Postgres raised 22P02 (invalid_text_representation) and aborted the whole
-- SECURITY DEFINER transaction on EVERY call.
--
-- Effect: no reply could be added to any ticket, by anyone. The admin inbox
-- showed a failure for "send reply to the client" and the client's reply path
-- failed the same way. The fix is a text variable for the returned id, plus a
-- NULL guard on the re-read so a vanished ticket reports a precise error
-- instead of returning NULL.
--
-- 0014 has been corrected in place as well, so a fresh install never runs the
-- broken body. This section is what repairs a database that already applied
-- 0014.
--
-- ROLLBACK: re-create app_add_ticket_message from 0014 (which is the bug).
-- =========================================================

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
  v_ticket_id text;
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
   returning t.id into v_ticket_id;

  select thread into v_ticket
    from app_ticket_threads(p_ticket_id) as thread
   limit 1;

  if v_ticket is null then
    raise exception 'TICKET_NOT_FOUND' using hint = 'That ticket is not on your account.';
  end if;

  return v_ticket;
end $$;

revoke all on function app_add_ticket_message(text, text, boolean, text) from public;
revoke all on function app_add_ticket_message(text, text, boolean, text) from anon;
grant execute on function app_add_ticket_message(text, text, boolean, text) to authenticated;

-- =========================================================
-- 2. EMAIL ONE-TIME CODE AS A CLIENT'S SECOND FACTOR
--
-- Clients can already enrol a TOTP authenticator app (Settings → Security,
-- Supabase MFA). Not every business owner wants another app, so this adds the
-- option they actually asked for: a 6-digit code sent to their email at
-- sign-in, on top of their password.
--
-- WHY A SEPARATE TABLE, not a column on `profiles`
-- `profiles` is protected by guard_profile_update (0008/0014), which pins every
-- column the server owns. A client's own second-factor switch would have had to
-- be exempted from that guard — i.e. it would have to be a column ANY client
-- can rewrite with a direct PostgREST PATCH. Keeping the flag in its own table
-- with `user_id = auth.uid()` forever means:
--   • the only row a person can touch is their own (RLS, not app code), and
--   • there is no escalation to guard against: switching your own second factor
--     is exactly the action this table exists to record.
-- The row is optional; a missing row means "off".
--
-- WHAT THIS IS NOT
-- This does not elevate the session to AAL2, because Supabase MFA has no email
-- factor. It is an application-level checkpoint: the login flow refuses to
-- finish until the emailed code is verified. Admin surfaces continue to require
-- a real AAL2 factor (app_aal2()), unchanged.
--
-- ROLLBACK: drop table if exists account_security;
-- =========================================================

create table if not exists account_security (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  email_mfa_enabled boolean not null default false,
  email_mfa_set_at  timestamptz,
  updated_at        timestamptz not null default now()
);

alter table account_security enable row level security;

-- One policy for the whole lifecycle: a person may read, set and clear their
-- own row, and nothing else. `for all` plus both USING and WITH CHECK means a
-- forged user_id is rejected on insert and on update.
drop policy if exists account_security_own on account_security;
create policy account_security_own on account_security
  for all to authenticated
  using (user_id = app_user_id())
  with check (user_id = app_user_id());

drop trigger if exists account_security_updated_at on account_security;
create trigger account_security_updated_at before update on account_security
  for each row execute function set_updated_at();

-- =========================================================
-- VERIFY
--
--   -- 1. the reply function compiles and returns a thread
--   select prosrc like '%v_ticket_id%' as fixed
--     from pg_proc where proname = 'app_add_ticket_message';
--   -- 2. as a signed-in admin, a reply now returns the updated ticket:
--   select app_add_ticket_message('<ticket id>', 'Testing replies', false);
--   -- 3. the security table is private to its owner
--   select policyname, cmd, qual from pg_policies
--    where tablename = 'account_security';
-- =========================================================