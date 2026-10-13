-- =========================================================
-- NORTHFORGE — Supabase migration 0017
-- Fix 42883 `function gen_random_bytes(integer) does not exist` in
-- `app_submit_enquiry` and `app_add_ticket_message`.
--
-- Root cause:
--   In Supabase Postgres, `pgcrypto` is installed in the `extensions`
--   schema (`extensions.gen_random_bytes`), not `public`. Both RPCs were
--   declared with `security definer set search_path = public`, so when
--   PL/pgSQL parsed the SQL statement containing `gen_random_bytes(6)`,
--   PostgreSQL raised 42883 (`function gen_random_bytes(integer) does not
--   exist`).
--
-- Fix:
--   1. Include `extensions` in `search_path` (`set search_path = public, extensions`).
--   2. Use built-in `pg_catalog.gen_random_uuid()` instead of `gen_random_bytes`
--      so random hex ID generation has zero extension dependency.
--
-- Non-destructive: CREATE OR REPLACE FUNCTION + GRANT only. Safe to re-run.
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
  language plpgsql security definer set search_path = public, extensions as $$
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

  -- Global throttle.
  select count(*) into v_count from enquiries
   where created_at > now() - interval '10 minutes';
  if v_count >= 40 then
    raise exception 'RATE_LIMITED' using hint = 'We are receiving a lot of enquiries right now — please try again shortly, or message us on WhatsApp.';
  end if;

  v_id := case when coalesce(p_id, '') ~ '^eq_[0-9a-f]{12}$' then p_id else null end;

  insert into enquiries (
    id, name, business_name, email, whatsapp, business_type,
    current_tools, bottleneck, monthly_enquiries, message, plan
  ) values (
    coalesce(v_id, 'eq_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
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

revoke all on function app_submit_enquiry(
  text, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function app_submit_enquiry(
  text, text, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

create or replace function app_add_ticket_message(
  p_ticket_id text,
  p_body text,
  p_internal boolean default false,
  p_status text default null
) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
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

  v_internal := case when v_is_admin then coalesce(p_internal, false) else false end;

  v_message := jsonb_build_object(
    'id',         'msg-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
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
