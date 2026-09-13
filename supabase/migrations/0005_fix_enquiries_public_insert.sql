-- =========================================================
-- NORTHFORGE — Supabase migration 0005
--
-- Fix: public contact-form submissions were rejected with 42501
-- ("You don't have permission to perform this action.").
--
-- Root causes this migration closes:
--   1. The anonymous/authenticated INSERT policy on `enquiries` may be
--      missing or stale on the live project — re-created explicitly.
--   2. Table/usage GRANTs may be missing when the schema was created by a
--      role whose default privileges differ — re-granted explicitly.
--
-- Also (spec §8): a new contact-form submission now notifies every admin
-- through the event engine (nf_notify_admins from migration 0004) and is
-- written to the activity trail. The trigger is exception-guarded so it
-- can never block a submission.
--
-- Non-destructive: CREATE / CREATE OR REPLACE / GRANT only. Safe to re-run.
-- Depends on: migration 0004 (nf_notify_admins / nf_log_activity).
-- =========================================================

-- ── 1. Explicit privileges for the public contact form ──
grant usage on schema public to anon, authenticated;
grant insert on table public.enquiries to anon, authenticated;

alter table enquiries enable row level security;

drop policy if exists enquiries_public_insert on enquiries;
create policy enquiries_public_insert on enquiries
  for insert to anon, authenticated with check (true);

drop policy if exists enquiries_admin_select on enquiries;
create policy enquiries_admin_select on enquiries
  for select to authenticated using (app_is_admin());

-- ── 2. New contact submission → admin notification (spec §8) ──
create or replace function on_enquiry_created() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  begin
    perform nf_notify_admins(
      'lead',
      'New contact form submission',
      coalesce(new.name, 'Unknown') || coalesce(' — ' || new.business_name, ''),
      '/app/leads'
    );
    perform nf_log_activity(
      'enquiry.created', 'Contact form submitted',
      coalesce(new.business_name, new.name),
      coalesce(new.name, 'Website'), 'system',
      'enquiry', new.id, null
    );
  exception when others then
    -- Notification/audit failures must never block a public submission.
    null;
  end;
  return new;
end $$;

drop trigger if exists enquiries_event_engine on enquiries;
create trigger enquiries_event_engine after insert on enquiries
  for each row execute function on_enquiry_created();
