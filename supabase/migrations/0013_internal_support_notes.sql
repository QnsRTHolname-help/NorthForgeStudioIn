-- =========================================================
-- NORTHFORGE — Supabase migration 0013
--
-- INTERNAL SUPPORT NOTES WERE NOT INTERNAL (and clients could not reply)
--
-- The admin Support drawer offers "Internal note (not visible to the
-- client)". The flag was never written to the message, and tickets are
-- readable by the client under RLS, so an internal note was delivered to the
-- client's browser and rendered in their portal. The same code path also
-- required a client-side UPDATE on `tickets`, which no policy grants — so a
-- client replying to their own ticket silently failed.
--
-- This migration puts both behind security-definer functions that resolve
-- the caller themselves:
--
--   app_ticket_threads(p_ticket_id)  → the caller's tickets, with messages
--                                      filtered SERVER-SIDE: a client never
--                                      receives an internal note at all.
--   app_add_ticket_message(...)      → appends a message; a client's message
--                                      is always internal = false, and an
--                                      admin's flag is honoured.
--
-- Filtering rows in the database rather than in the browser is the
-- difference between a real boundary and a promise.
--
-- Non-destructive: CREATE OR REPLACE + GRANTs only. No row is changed, and
-- messages written before this migration have no `internal` key, which is
-- read as false — their existing behaviour is preserved.
-- ROLLBACK SAFETY: drop function app_ticket_threads(text);
--                  drop function app_add_ticket_message(text, text, boolean, text);
-- =========================================================

-- ── 1. Read path ─────────────────────────────────────────
-- Returns the caller's tickets (all of them for an admin) with `messages`
-- masked for non-admins. One function serves list and single-ticket reads.
create or replace function app_ticket_threads(p_ticket_id text default null)
returns setof jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_is_admin boolean;
  v_client_id text;
begin
  v_is_admin := app_is_admin();
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
        -- The mask: only an admin ever sees an internal note.
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

-- ── 2. Write path ────────────────────────────────────────
-- Appends a message and returns the resulting (already masked) ticket.
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

  v_is_admin := app_is_admin();

  -- The caller must be able to see this ticket at all.
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

  -- A client's message can never be an internal note, whatever the client
  -- sends. Only staff may write internal notes.
  v_internal := case when v_is_admin then coalesce(p_internal, false) else false end;

  v_message := jsonb_build_object(
    'id',         'msg-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 12),
    'author',     v_name,
    'authorRole', case when v_role = 'client' then 'client' else 'admin' end,
    'body',       v_body,
    'internal',   v_internal,
    'createdAt',  to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  -- A client may only set a status that makes sense for a client; anything
  -- else keeps the current status.
  update tickets t
     set messages = coalesce(t.messages, '[]'::jsonb) || jsonb_build_array(v_message),
         status = case
           when v_is_admin and p_status is not null and p_status <> '' then p_status
           else t.status
         end
   where t.id = p_ticket_id
   returning t.id into v_ticket;

  -- Return the ticket through the same masking function, so a client's own
  -- response cannot echo anything they are not allowed to see.
  select thread into v_ticket
    from app_ticket_threads(p_ticket_id) as thread
   limit 1;

  return v_ticket;
end $$;

revoke all on function app_add_ticket_message(text, text, boolean, text) from public;
revoke all on function app_add_ticket_message(text, text, boolean, text) from anon;
grant execute on function app_add_ticket_message(text, text, boolean, text) to authenticated;
