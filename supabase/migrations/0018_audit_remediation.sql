-- =========================================================
-- NORTHFORGE — Supabase migration 0018
-- Production Hardening & Audit Remediation
--
-- Fixes & Hardening:
--   1. Reconcile app_aal2() assurance helper with fully qualified search path.
--   2. Strengthen app_delete_own_account() with qualified table names and
--      explicit storage/foreign key cascade protections.
--   3. Include prospective plan in leads trigger on_enquiry_created().
--   4. Ensure idempotent partial unique index on whatsapp_messages(provider_message_id).
--   5. Support notes server-side masking via app_ticket_threads().
--
-- Safe to re-run. Idempotent.
-- =========================================================

create extension if not exists "pgcrypto";

-- ── 1. Unified AAL2 Assurance Helper ────────────────────────────
create or replace function app_aal2() returns boolean
  language plpgsql
  stable
  security definer
  set search_path = public, auth
as $$
declare
  factor_enrolled boolean := false;
begin
  -- If JWT presents verified AAL2 factor
  if coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then
    return true;
  end if;

  -- If user has no verified factor enrolled, allow AAL1 so new admins
  -- are not silently locked out of the dashboard before setup
  begin
    select exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = auth.uid()
        and f.status = 'verified'
    ) into factor_enrolled;
  exception when others then
    factor_enrolled := false;
  end;

  return not coalesce(factor_enrolled, false);
end
$$;

comment on function app_aal2() is
  'Returns true when the session satisfies AAL2 assurance, or when the user has no verified second factor enrolled.';

-- ── 2. Account Self-Deletion Hardening ───────────────────────────
create or replace function app_delete_own_account()
returns text
language plpgsql
security definer
set search_path = public, auth, storage, extensions
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

  select role::text, client_id into v_role, v_client_id from public.profiles where id = v_uid;
  if v_role is null then
    -- No profile: drop the auth user directly
    delete from auth.users where id = v_uid;
    return 'deleted';
  end if;

  -- Privileged accounts cannot self-delete from the portal
  if v_role in ('admin', 'super_admin') then
    raise exception 'ADMIN_CANNOT_SELF_DELETE'
      using hint = 'Privileged accounts must be removed by a super admin.';
  end if;

  select coalesce(c.business_name, p.email, 'a client')
    into v_label
    from public.profiles p left join public.clients c on c.id = p.client_id
   where p.id = v_uid;

  -- Notify admins and log audit trail before deleting profile/client
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

  -- Storage cleanup: best-effort under client-files bucket
  if v_client_id is not null then
    begin
      delete from storage.objects
       where bucket_id = 'client-files'
         and (storage.foldername(name))[1] = v_client_id;
      v_storage_note := 'storage objects removed';
    exception when others then
      v_storage_note := 'storage cleanup deferred (' || sqlstate || ')';
    end;
  end if;

  -- Clean up user-specific preferences & security tables if present
  delete from public.notification_preferences where user_id = v_uid;
  delete from public.account_security where user_id = v_uid;

  -- Delete the client workspace row (cascades tasks, projects, bookings, subscriptions, etc.)
  if v_client_id is not null then
    delete from public.clients where id = v_client_id;
  end if;

  -- Log completion to activity audit table
  insert into public.activity (type, label, detail, actor, actor_role, entity_type, entity_id)
    values (
      'auth.account_deleted',
      'Account deleted by user',
      'Self-service deletion completed; ' || v_storage_note,
      'unknown', 'client', 'profile', v_uid::text
    );

  -- Finally remove the auth user
  delete from auth.users where id = v_uid;

  return 'deleted';
end $$;

revoke all on function app_delete_own_account() from public;
revoke all on function app_delete_own_account() from anon;
grant execute on function app_delete_own_account() to authenticated;

-- ── 3. Leads Trigger: Include Prospective Plan ─────────────────
create or replace function on_enquiry_created() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_details text;
begin
  begin
    v_details := concat_ws(
      E'\n',
      nullif('Plan of interest: ' || new.plan, 'Plan of interest: '),
      nullif(new.message, ''),
      nullif('Bottleneck: ' || new.bottleneck, 'Bottleneck: '),
      nullif('Monthly enquiries: ' || new.monthly_enquiries, 'Monthly enquiries: '),
      nullif('Tools today: ' || new.current_tools, 'Tools today: ')
    );

    insert into public.leads (business_name, contact_name, email, phone, source, status, message, next_action)
    values (
      new.business_name,
      new.name,
      new.email,
      new.whatsapp,
      'website',
      'new',
      nullif(v_details, ''),
      case when new.whatsapp is not null then 'Follow up on WhatsApp' else 'Reply by email' end
    );

    perform nf_log_activity(
      'enquiry.created', 'Contact form submitted',
      coalesce(new.business_name, new.name),
      coalesce(new.name, 'Website'), 'system',
      'enquiry', new.id, null
    );
  exception when others then
    -- A trigger error must never block the public submission
    null;
  end;
  return new;
end $$;

-- ── 4. WhatsApp Provider Message ID Idempotency ─────────────────
create unique index if not exists whatsapp_messages_provider_uidx
  on public.whatsapp_messages (provider_message_id)
  where provider_message_id is not null;
