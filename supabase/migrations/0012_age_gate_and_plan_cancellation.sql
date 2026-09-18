-- =========================================================
-- NORTHFORGE — Supabase migration 0012
--
-- Two features the product promised but did not yet store:
--
--   1. SELF-SERVICE PLAN CANCELLATION (spec §2–§4, §55)
--      A subscription can now be moved to a CANCELLATION_PENDING state
--      that stops the NEXT renewal while preserving every historical
--      record. Cancelling never deletes a subscription and never touches
--      an invoice that has already been issued.
--
--   2. AGE ATTESTATION AT SIGNUP (spec §10–§11)
--      Only the RESULT of the age check is stored (age_verified +
--      age_verified_at). No date of birth, and no identity document, is
--      collected for a basic eligibility check.
--
--   3. FINANCIAL RETENTION ON ACCOUNT CLOSURE (spec §7)
--      Invoices and payments are no longer cascade-deleted with the client
--      account. They are detached, keeping a snapshot of who they were for,
--      because an accounting record of money actually invoiced and paid is
--      not the customer's to have deleted.
--
-- Also re-creates app_delete_own_account() so an account deletion raises an
-- admin notification before the auth user is removed (spec §49).
--
-- Non-destructive: CREATE OR REPLACE / ALTER ... IF NOT EXISTS / additive
-- columns with defaults. Safe to re-run. No existing row is deleted.
-- ROLLBACK SAFETY:
--   alter table subscriptions drop constraint if exists subscriptions_status_check;
--   alter table subscriptions add constraint subscriptions_status_check
--     check (status in ('trialing','active','past_due','paused','cancelled'));
--   alter table subscriptions drop column if exists cancelled_at,
--     drop column if exists cancellation_reason, drop column if exists cancelled_by;
--   alter table profiles drop column if exists age_verified,
--     drop column if exists age_verified_at;
--   alter table invoices drop column if exists billed_to;
--   alter table payments drop column if exists billed_to;
--   (restore the original cascade FKs before dropping the columns)
--   drop function if exists app_cancel_own_subscription(text, text);
--   drop trigger if exists clients_snapshot_financials on clients;
--   drop function if exists snapshot_client_financial_attribution();
-- =========================================================

create extension if not exists "pgcrypto";

-- ── 1. Subscription lifecycle ─────────────────────────────
-- 'cancellation_pending' = stops renewing, access remains until cancel_at.
-- 'expired'              = the paid period ran out without a renewal.
-- 'cancelled'            = the subscription is ended.
alter table subscriptions drop constraint if exists subscriptions_status_check;
alter table subscriptions add constraint subscriptions_status_check
  check (status in ('trialing','active','past_due','paused','cancellation_pending','cancelled','expired'));

alter table subscriptions add column if not exists cancelled_at          timestamptz;
alter table subscriptions add column if not exists cancellation_reason   text;
-- Who ended it: 'client' | 'admin' | 'system'. Kept as text so the audit
-- trail cannot be rewritten by the party that was acted upon.
alter table subscriptions add column if not exists cancelled_by          text;

comment on column subscriptions.cancel_at is
  'The date the subscription stops. For a client cancellation this is the end of the already-paid period (or now when nothing is outstanding).';

-- ── 2. Age attestation (result only — no date of birth) ───
alter table profiles add column if not exists age_verified     boolean not null default false;
alter table profiles add column if not exists age_verified_at  timestamptz;

comment on column profiles.age_verified is
  'Self-attested age eligibility at signup. Stores the RESULT only — no date of birth or identity document is collected.';

-- Re-create the signup provisioner to record the attestation the client
-- gave on the registration form. Everything else is unchanged: a public
-- signup can still only ever create role 'client'.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  requested_role text;
  business text;
  new_client_id text;
  age_ok boolean;
begin
  requested_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'client');

  -- Hard rule: public signup can never self-assign a privileged role.
  if requested_role not in ('client') then
    requested_role := 'client';
  end if;

  -- Tolerant boolean read: metadata is attacker-controlled, so anything
  -- that is not clearly affirmative is treated as "not verified" rather
  -- than raising and failing the signup.
  age_ok := lower(coalesce(new.raw_user_meta_data ->> 'age_confirmed', '')) in ('true','t','1','yes','on');

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

  insert into public.profiles (id, email, name, role, client_id, phone, age_verified, age_verified_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    requested_role::user_role,
    new_client_id,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    age_ok,
    case when age_ok then now() else null end
  )
  on conflict (id) do nothing;

  -- A new client signup is an event the team needs to see (spec §49).
  -- Notifying must never be able to fail the signup itself.
  begin
    perform nf_notify_admins(
      'system',
      'New client signup',
      coalesce(business, new.email) || ' — account created',
      '/app/clients'
    );
  exception when others then
    null;
  end;

  return new;
end $$;

-- ── 3. Client self-service plan cancellation (spec §2–§4) ──
-- The browser can only SELECT its own subscription (RLS), so ending one
-- must go through a security-definer function that resolves the caller
-- from auth.uid(). The only input is WHICH of the caller's own
-- subscriptions to end — never a client id, so one client can never
-- cancel another client's plan (spec §60).
--
-- What it deliberately does NOT do:
--   • It does not delete the subscription row (history is preserved).
--   • It does not void, delete or "cancel" an invoice that has already
--     been issued. Future renewal is stopped; existing invoices keep their
--     own status and remain a financial record.
create or replace function app_cancel_own_subscription(
  p_subscription_id text,
  p_reason text default null
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
  v_role text;
  v_client_id text;
  v_sub subscriptions%rowtype;
  v_effective timestamptz;
  v_status text;
  v_reason text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Sign in before changing a subscription.';
  end if;

  select role::text, client_id into v_role, v_client_id from profiles where id = v_uid;
  if v_role is null or v_role <> 'client' or v_client_id is null then
    raise exception 'NOT_A_CLIENT' using hint = 'Only a client account can cancel its own plan here.';
  end if;

  select * into v_sub from subscriptions si
    where si.id = p_subscription_id
      and si.client_id = v_client_id
    for update;

  if not found then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using hint = 'That subscription is not on your account.';
  end if;

  if v_sub.status in ('cancelled','expired') then
    raise exception 'ALREADY_CANCELLED' using hint = 'This subscription is already ended.';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  -- Guard against an essay being posted into the column.
  if v_reason is not null and length(v_reason) > 500 then
    v_reason := left(v_reason, 500);
  end if;

  -- Nothing more is owed for the current period: end now. Otherwise the
  -- plan stays usable until the date already paid for.
  if v_sub.renews_at is not null and v_sub.renews_at > now() then
    v_effective := v_sub.renews_at;
    v_status := 'cancellation_pending';
  else
    v_effective := now();
    v_status := 'cancelled';
  end if;

  update subscriptions
     set status = v_status,
         cancel_at = v_effective,
         cancelled_at = now(),
         cancellation_reason = v_reason,
         cancelled_by = 'client'
   where id = v_sub.id;

  -- The client gets a confirmation they can point at later…
  perform nf_notify_client(
    v_client_id,
    'billing',
    'Plan cancelled',
    case
      when v_status = 'cancellation_pending'
        then 'Your plan will not renew. Access continues until ' ||
             to_char(v_effective at time zone 'Asia/Kolkata', 'DD Mon YYYY') || '.'
      else 'Your plan has been cancelled. No further billing will be raised.'
    end,
    '/portal/subscription'
  );

  -- …and the team is told, with a link straight to the record.
  perform nf_notify_admins(
    'billing',
    'Subscription cancelled',
    'A client cancelled their plan (reason: ' || coalesce(v_reason, 'not given') || ')',
    '/app/subscriptions'
  );

  perform nf_log_activity(
    'subscription.cancelled', 'Subscription cancelled',
    'Client requested cancellation via the portal',
    'client', 'client', 'subscription', v_sub.id, v_client_id
  );

  return jsonb_build_object(
    'id', v_sub.id,
    'status', v_status,
    'effective_at', v_effective,
    'reason', v_reason
  );
end $$;

revoke all on function app_cancel_own_subscription(text, text) from public;
revoke all on function app_cancel_own_subscription(text, text) from anon;
grant execute on function app_cancel_own_subscription(text, text) to authenticated;

-- ── 4. Financial records survive account deletion (spec §7) ──
--
-- `invoices.client_id` and `payments.client_id` used to be
-- `on delete cascade`, so closing an account silently destroyed the
-- accounting record of money that was actually invoiced and paid. That is
-- both an audit hole and, for a business, a legal problem.
--
-- Invoices and payments are now detached instead of deleted: closing an
-- account keeps them, unattached to any client row. Only admins can read a
-- row with a null client_id (invoices_scope → app_can_see(null) is false for
-- clients), so a closed account's financial history is retained for the
-- operator and invisible to everyone else.
--
-- `billed_to` snapshots the business name at the moment of detachment so the
-- retained invoice is still attributable — a foreign key that just became
-- null would otherwise leave an accountant holding an unnamed invoice.
alter table invoices add column if not exists billed_to text;
alter table payments add column if not exists billed_to text;

-- Backfill what we can still resolve, so existing rows are attributable too.
update invoices i set billed_to = c.business_name
  from clients c where c.id = i.client_id and i.billed_to is null;
update payments p set billed_to = c.business_name
  from clients c where c.id = p.client_id and p.billed_to is null;

alter table invoices alter column client_id drop not null;
alter table invoices drop constraint if exists invoices_client_id_fkey;
alter table invoices add constraint invoices_client_id_fkey
  foreign key (client_id) references clients(id) on delete set null;

alter table payments alter column client_id drop not null;
alter table payments drop constraint if exists payments_client_id_fkey;
alter table payments add constraint payments_client_id_fkey
  foreign key (client_id) references clients(id) on delete set null;

comment on column invoices.billed_to is
  'Business name at the time the invoice was raised. Kept so a retained invoice (client_id set to null after account closure) stays attributable.';

-- Attribution is captured BEFORE the client row disappears, whichever path
-- deleted it — the client's own self-service deletion or an admin removing
-- the account. (An AFTER-DELETE hook could not do this: by then the client
-- row is already gone, so there would be no name left to read.)
create or replace function snapshot_client_financial_attribution() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update invoices set billed_to = coalesce(billed_to, old.business_name) where client_id = old.id;
  update payments set billed_to = coalesce(billed_to, old.business_name) where client_id = old.id;
  -- Returning a row keeps the delete; returning null would silently cancel it.
  return old;
end $$;

drop trigger if exists clients_snapshot_financials on clients;
create trigger clients_snapshot_financials before delete on clients
  for each row execute function snapshot_client_financial_attribution();

-- ── 5. Account deletion — tell the admins first (spec §49) ──
-- Same function as 0009 with two additions: an admin notification before
-- the auth user (and therefore the profile that could receive it) is
-- removed, and a note that invoice/payment rows are retained by the foreign
-- keys changed in section 4. Everything else is unchanged: business rows
-- cascade with the client, the auth user is removed last, one transaction.
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
  v_object_paths text[];
  v_label text;
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

  if v_role in ('admin', 'super_admin') then
    raise exception 'ADMIN_CANNOT_SELF_DELETE'
      using hint = 'Privileged accounts must be removed by a super admin.';
  end if;

  select coalesce(c.business_name, p.email, 'a client')
    into v_label
    from profiles p left join clients c on c.id = p.client_id
   where p.id = v_uid;

  -- Invoices and payments are NOT deleted here: the `on delete set null`
  -- foreign keys detach them, and the clients_snapshot_financials trigger
  -- (section 4) has already copied the business name onto each retained row.

  -- Tell the team BEFORE the account disappears (spec §49).
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

  -- Storage: objects have no FK for the DB to cascade, so the client
  -- folder is emptied explicitly (paths are `{client_id}/…`).
  if v_client_id is not null then
    select coalesce(array_agg(path), '{}') into v_object_paths
      from storage.objects
      where bucket_id = 'client-files'
        and path[1] = v_client_id;

    if array_length(v_object_paths, 1) > 0 then
      delete from storage.objects
        where bucket_id = 'client-files'
          and path[1] = v_client_id;
    end if;
  end if;

  -- Remove the client workspace row. Most business tables reference it with
  -- `on delete cascade`, so leads, projects, subscriptions, bookings, files,
  -- whatsapp_messages, requests, tickets and follow-ups are erased with it.
  -- Invoices and payments are the deliberate exception: they are detached by
  -- `on delete set null` so the financial record survives (section 4).
  if v_client_id is not null then
    delete from clients where id = v_client_id;
  end if;

  -- Audit trail survives the deletion because it is written first.
  insert into activity (type, label, detail, actor, actor_role, entity_type, entity_id)
    values ('auth.account_deleted', 'Account deleted by user', 'Self-service deletion completed', 'unknown', 'client', 'profile', v_uid::text);

  delete from auth.users where id = v_uid;

  return 'deleted';
end $$;

revoke all on function app_delete_own_account() from public;
revoke all on function app_delete_own_account() from anon;
grant execute on function app_delete_own_account() to authenticated;
